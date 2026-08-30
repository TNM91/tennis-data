import { createClient } from '@supabase/supabase-js'
import {
  CAPTAIN_PILOT_CAMPAIGN_KEY,
  getCaptainPilotAvailability,
  normalizeCaptainPilotTeamKey,
} from '@/lib/captain-pilot'
import { PAID_CHECKOUT_ENABLED, PAID_CHECKOUT_PAUSED_MESSAGE } from '@/lib/paid-checkout'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'
import { buildUpgradePricingSnapshot } from '@/lib/upgrade-requests'

export const runtime = 'nodejs'

type ClaimBody = {
  captainName?: unknown
  clubOrArea?: unknown
  teamName?: unknown
  feedbackFocus?: unknown
}

type ExistingRedemption = {
  id: string
  upgrade_request_id: string | null
  status: string | null
}

export async function POST(request: Request) {
  if (!PAID_CHECKOUT_ENABLED) {
    return Response.json({ ok: false, code: 'checkout_paused', message: PAID_CHECKOUT_PAUSED_MESSAGE }, { status: 503 })
  }

  if (getCaptainPilotAvailability() !== 'active') {
    return Response.json({ ok: false, message: 'The Fall Captain Pilot is not accepting new claims right now.' }, { status: 409 })
  }

  const token = getBearerToken(request)
  if (!token) return Response.json({ ok: false, message: 'Sign in before claiming the pilot.' }, { status: 401 })

  const user = await getRequesterUser(token)
  if (!user.userId || !user.email) return Response.json({ ok: false, message: 'Sign in before claiming the pilot.' }, { status: 401 })

  let body: ClaimBody
  try {
    body = (await request.json()) as ClaimBody
  } catch {
    return Response.json({ ok: false, message: 'Invalid pilot claim.' }, { status: 400 })
  }

  const captainName = cleanString(body.captainName)
  const clubOrArea = cleanString(body.clubOrArea)
  const teamName = cleanString(body.teamName)
  const feedbackFocus = cleanString(body.feedbackFocus)
  const teamKey = normalizeCaptainPilotTeamKey(teamName)
  if (!captainName || !teamName || !teamKey || !feedbackFocus) {
    return Response.json({ ok: false, message: 'Add your name, team, and the captain problem you want us to improve.' }, { status: 400 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return Response.json({ ok: false, message: 'Pilot claims are not configured yet.' }, { status: 500 })

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const { data: existing, error: existingError } = await supabase
    .from('captain_pilot_redemptions')
    .select('id, upgrade_request_id, status')
    .eq('campaign_key', CAPTAIN_PILOT_CAMPAIGN_KEY)
    .eq('profile_id', user.userId)
    .maybeSingle()
  if (existingError) return Response.json({ ok: false, message: 'Your pilot claim could not be loaded.' }, { status: 500 })

  const redemption = existing as ExistingRedemption | null
  if (redemption?.status === 'converted') {
    return Response.json({ ok: true, alreadyActive: true, requestId: redemption.upgrade_request_id })
  }

  if (redemption?.upgrade_request_id) {
    return Response.json({ ok: true, requestId: redemption.upgrade_request_id, resumed: true })
  }

  let redemptionId = redemption?.id ?? ''
  if (!redemptionId) {
    const { data: inserted, error: insertError } = await supabase
      .from('captain_pilot_redemptions')
      .insert({
        campaign_key: CAPTAIN_PILOT_CAMPAIGN_KEY,
        profile_id: user.userId,
        captain_name: captainName,
        captain_email: user.email.toLowerCase(),
        club_or_area: clubOrArea,
        team_name: teamName,
        team_key: teamKey,
        feedback_focus: feedbackFocus,
        status: 'claimed',
      })
      .select('id')
      .single()

    if (insertError || !inserted?.id) {
      if (insertError?.code === '23505') {
        return Response.json({ ok: false, message: 'This captain or team has already claimed the Fall Captain Pilot.' }, { status: 409 })
      }
      return Response.json({ ok: false, message: 'Your pilot claim could not be saved.' }, { status: 500 })
    }
    redemptionId = String(inserted.id)
  }

  const pricing = buildUpgradePricingSnapshot('captain')
  const { data: upgradeRequest, error: requestError } = await supabase
    .from('upgrade_requests')
    .insert({
      plan_id: 'captain',
      plan_name: pricing.planName,
      price_label: pricing.priceLabel,
      billing_amount_cents: pricing.billingAmountCents,
      billing_currency: pricing.billingCurrency,
      billing_interval: pricing.billingInterval,
      checkout_mode: pricing.checkoutMode,
      quantity_mode: pricing.quantityMode,
      entitlement_grant: pricing.entitlementGrant,
      discount_rules: pricing.discountRules,
      requester_name: captainName,
      requester_email: user.email.toLowerCase(),
      requester_user_id: user.userId,
      organization: clubOrArea,
      goal: `Fall Captain Pilot: ${feedbackFocus}`,
      next_href: '/captain',
      source: 'captain_pilot_2026',
    })
    .select('id')
    .single()

  if (requestError || !upgradeRequest?.id) {
    return Response.json({ ok: false, message: 'Your pilot access could not be prepared.' }, { status: 500 })
  }

  const { error: linkError } = await supabase
    .from('captain_pilot_redemptions')
    .update({ upgrade_request_id: upgradeRequest.id, status: 'claimed', updated_at: new Date().toISOString() })
    .eq('id', redemptionId)
    .is('upgrade_request_id', null)
  if (linkError) return Response.json({ ok: false, message: 'Your pilot access could not be linked.' }, { status: 500 })

  return Response.json({ ok: true, requestId: upgradeRequest.id })
}

async function getRequesterUser(token: string) {
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await supabase.auth.getUser(token)
  if (error) return { userId: undefined, email: undefined }
  return { userId: data.user?.id, email: data.user?.email ?? undefined }
}

function getBearerToken(request: Request) {
  const header = request.headers.get('authorization')
  return header?.toLowerCase().startsWith('bearer ') ? header.slice('bearer '.length).trim() : ''
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 500) : ''
}
