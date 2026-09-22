import { createClient } from '@supabase/supabase-js'
import { CAPTAIN_PILOT_CAMPAIGN_KEY } from '@/lib/captain-pilot'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const token = getBearerToken(request)
  if (!token) return Response.json({ ok: false, message: 'Sign in to review your Captain Pilot.' }, { status: 401 })

  const auth = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: authData, error: authError } = await auth.auth.getUser(token)
  if (authError || !authData.user?.id) {
    return Response.json({ ok: false, message: 'Sign in to review your Captain Pilot.' }, { status: 401 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) return Response.json({ ok: false, message: 'Captain Pilot status is not configured.' }, { status: 500 })
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data, error } = await service
    .from('captain_pilot_redemptions')
    .select('status, upgrade_request_id, trial_ends_at, billing_status')
    .eq('campaign_key', CAPTAIN_PILOT_CAMPAIGN_KEY)
    .eq('profile_id', authData.user.id)
    .maybeSingle()

  if (error) return Response.json({ ok: false, message: 'Captain Pilot status could not be loaded.' }, { status: 500 })
  if (!data) return Response.json({ ok: true, pilot: null })

  return Response.json({
    ok: true,
    pilot: {
      active: data.status === 'converted',
      requestId: data.upgrade_request_id,
      trialEndsAt: data.trial_ends_at,
      billingRequired: data.billing_status !== 'collected',
      billingStatus: data.billing_status,
    },
  })
}

function getBearerToken(request: Request) {
  const header = request.headers.get('authorization')
  return header?.toLowerCase().startsWith('bearer ') ? header.slice('bearer '.length).trim() : ''
}
