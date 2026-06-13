import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify the calling user is authenticated via their session JWT
  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );
  const {
    data: { user },
    error: userError,
  } = await supabaseUser.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { email, firstName, lastName, businessId, sendInvite = true } =
    await req.json();
  if (!email || !businessId) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: email, businessId" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Use service role for admin operations
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Verify caller is the owner or an Admin/Manager of this business
  const isOwner = user.id === businessId;
  if (!isOwner) {
    const { data: callerStaff } = await supabaseAdmin
      .from("staff")
      .select("roles(name)")
      .eq("user_id", user.id)
      .eq("business_id", businessId)
      .maybeSingle();

    const role = callerStaff?.roles?.name;
    if (role !== "Admin" && role !== "Manager") {
      return new Response(
        JSON.stringify({
          error: "Forbidden: only Admins or Managers can invite staff",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  }

  // Single-membership rule: a person belongs to one business at a time. If this email
  // is already an active member of any business, block the invite. The owner can't see
  // staff rows at other businesses (RLS), so this cross-business check must run with the
  // service role here. An active member = a claimed row (user_id set) that is_active.
  // Soft-deleted (removed) rows and unclaimed pending invites do not count, so a removed
  // staff member can be re-invited and someone can hold pending invites before joining.
  const normalizedEmail = String(email).toLowerCase().trim();
  const { data: activeMemberships } = await supabaseAdmin
    .from("staff")
    .select("business_id")
    .eq("email", normalizedEmail)
    .not("user_id", "is", null)
    .eq("is_active", true);

  if (activeMemberships && activeMemberships.length > 0) {
    const onThisTeam = activeMemberships.some((r) => r.business_id === businessId);
    return new Response(
      JSON.stringify({
        error: onThisTeam
          ? "This person is already on your team."
          : "This email already belongs to another business's team. They must be removed from that team before they can join yours.",
      }),
      {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // A reactivated member who already has an account does not need a fresh invite email.
  if (!sendInvite) {
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const siteUrl = Deno.env.get("SITE_URL") ?? "https://pointbunny.com";

  const { error: inviteError } =
    await supabaseAdmin.auth.admin.inviteUserByEmail(normalizedEmail, {
      data: {
        first_name: firstName ?? "",
        last_name: lastName ?? "",
        role: "staff",
      },
      redirectTo: siteUrl,
    });

  if (inviteError) {
    // Supabase phrases this several ways ("already been registered", "already
    // registered", "already been invited", code "email_exists"), so match loosely.
    const alreadyExists =
      /already.*(registered|invited)|email[_\s-]?exists/i.test(
        inviteError.message,
      );
    if (alreadyExists) {
      // The membership check above already cleared this email of any active membership,
      // so the account simply exists without belonging to a team. We can't email an
      // invite link to an existing account, so report existingAccount and let the app
      // keep the pending staff row. The person joins by accepting it on their next login
      // (the consent step in loadBusinessContext), not via an email link.
      return new Response(
        JSON.stringify({ success: true, existingAccount: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    return new Response(JSON.stringify({ error: inviteError.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
