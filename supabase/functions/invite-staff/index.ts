import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Verify the calling user is authenticated via their session JWT
  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { email, firstName, lastName, businessId } = await req.json()
  if (!email || !businessId) {
    return new Response(JSON.stringify({ error: 'Missing required fields: email, businessId' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Use service role for admin operations
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Verify caller is the owner or an Admin/Manager of this business
  const isOwner = user.id === businessId
  if (!isOwner) {
    const { data: callerStaff } = await supabaseAdmin
      .from('staff')
      .select('roles(name)')
      .eq('user_id', user.id)
      .eq('business_id', businessId)
      .maybeSingle()

    const role = callerStaff?.roles?.name
    if (role !== 'Admin' && role !== 'Manager') {
      return new Response(JSON.stringify({ error: 'Forbidden: only Admins or Managers can invite staff' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  // Check if an auth account already exists for this email.
  // Supabase silently skips inviteUserByEmail when the email is already registered,
  // so we need to handle both cases before calling it.
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const lookupRes   = await fetch(
    `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}&page=1&per_page=1`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  )
  const lookupJson = await lookupRes.json()
  const existingUser = lookupJson?.users?.[0]

  if (existingUser) {
    if (existingUser.email_confirmed_at) {
      // Confirmed account — they already have a password and can log in normally.
      // The pending staff row is already in the DB; they'll claim it on next login
      // via the invite link if resent, or the owner can share the app URL directly.
      return new Response(
        JSON.stringify({ error: 'This email already has a confirmed Pointbunny account. Ask them to log in — they will be added to your team automatically.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      // Unconfirmed / abandoned signup — delete the stale record so the invite
      // goes out clean with a fresh magic link.
      await supabaseAdmin.auth.admin.deleteUser(existingUser.id)
    }
  }

  const siteUrl = Deno.env.get('SITE_URL') ?? 'https://pointbunny.com'

  const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: {
      first_name: firstName ?? '',
      last_name:  lastName ?? '',
    },
    redirectTo: siteUrl,
  })

  if (inviteError) {
    return new Response(JSON.stringify({ error: inviteError.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
