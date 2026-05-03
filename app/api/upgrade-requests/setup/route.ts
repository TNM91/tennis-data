import { createClient } from '@supabase/supabase-js'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const token = getBearerToken(request)
  if (!token) {
    return Response.json({ ok: false, message: 'Admin sign-in required.' }, { status: 401 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  })

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData.user) {
    return Response.json({ ok: false, message: 'Admin sign-in required.' }, { status: 401 })
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (profileError) {
    return Response.json({ ok: false, message: profileError.message }, { status: 500 })
  }

  if ((profile as { role?: string } | null)?.role !== 'admin') {
    return Response.json({ ok: false, message: 'Admin access required.' }, { status: 403 })
  }

  const requestTable = await supabase
    .from('upgrade_requests')
    .select('id', { count: 'exact', head: true })

  const profileEntitlements = await supabase
    .from('profiles')
    .select(
      'player_plus_subscription_active, player_plus_subscription_status, captain_subscription_active, captain_subscription_status, tiq_team_league_entry_enabled, tiq_individual_league_creator_enabled',
      { count: 'exact', head: true },
    )

  return Response.json({
    ok: true,
    checks: {
      upgradeRequestsTable: !requestTable.error,
      playerPlusEntitlements: !profileEntitlements.error,
      activationServiceKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
    messages: {
      upgradeRequestsTable: requestTable.error?.message ?? '',
      playerPlusEntitlements: profileEntitlements.error?.message ?? '',
      activationServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY
        ? ''
        : 'SUPABASE_SERVICE_ROLE_KEY is required for one-click activation.',
    },
  })
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get('authorization')
  return authHeader?.toLowerCase().startsWith('bearer ')
    ? authHeader.slice('bearer '.length).trim()
    : ''
}
