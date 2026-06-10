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

  const siteUrl = Deno.env.get('SITE_URL') ?? 'https://pointbunny.com'

  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: {
      first_name: firstName ?? '',
      last_name:  lastName ?? '',
      is_staff:   true,
    },
    redirectTo: siteUrl,
  })

  if (inviteError) {
    const alreadyExists = /already registered|already been invited/i.test(inviteError.message)
    if (alreadyExists) {
      return new Response(
        JSON.stringify({ error: 'This email already has a Pointbunny account. Ask them to log in and they will appear on your team.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    return new Response(JSON.stringify({ error: inviteError.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Claim the pending staff row now using service role so the invited user can find it
  // by user_id on first login. Without this, RLS blocks them from reading a row where
  // user_id IS NULL, causing loadBusinessContext to fall through to _initBusiness.
  if (inviteData?.user?.id) {
    await supabaseAdmin
      .from('staff')
      .update({ user_id: inviteData.user.id })
      .eq('email', email)
      .eq('business_id', businessId)
      .is('user_id', null)
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
