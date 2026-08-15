import { createHash, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'

type EntryBody = {
  tournamentId?: unknown
  playerName?: unknown
  email?: unknown
  phone?: unknown
  selfRating?: unknown
  smsOptIn?: unknown
  consentNote?: unknown
}

export async function POST(request: Request) {
  let body: EntryBody
  try {
    body = (await request.json()) as EntryBody
  } catch {
    return Response.json({ ok: false, message: 'Entry request could not be read.' }, { status: 400 })
  }

  const tournamentId = cleanText(body.tournamentId, 160)
  const playerName = cleanText(body.playerName, 120)
  const email = cleanEmail(body.email)
  const phone = cleanPhone(body.phone)
  const selfRating = normalizeSelfRating(body.selfRating)
  const smsOptIn = Boolean(body.smsOptIn)
  const consentNote = cleanText(body.consentNote, 300)
  if (!tournamentId || !playerName) {
    return Response.json({ ok: false, message: 'Enter your name before submitting.' }, { status: 400 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) {
    console.error('Tournament entry service key is missing')
    return Response.json({ ok: false, message: 'Tournament entry is temporarily unavailable.' }, { status: 503 })
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const rateKey = hashValue(`${serviceKey}:${getClientAddress(request)}:${tournamentId}`)
  const rateResult = await supabase.rpc('consume_api_rate_limit', {
    target_scope: 'tournament-entry',
    target_key_hash: rateKey,
    target_limit: 8,
    target_window_seconds: 3600,
  })
  if (rateResult.error) {
    console.error('Tournament entry rate limit failed', rateResult.error)
    return Response.json({ ok: false, message: 'Tournament entry is temporarily unavailable.' }, { status: 503 })
  }
  if (!rateResult.data) {
    return Response.json({ ok: false, message: 'Too many entry attempts. Try again later.' }, { status: 429 })
  }

  const tournamentResult = await supabase
    .from('tiq_tournaments')
    .select('id,is_public,status')
    .eq('id', tournamentId)
    .maybeSingle()
  if (tournamentResult.error) {
    console.error('Tournament entry lookup failed', tournamentResult.error)
    return Response.json({ ok: false, message: 'Tournament entry is temporarily unavailable.' }, { status: 503 })
  }
  if (!tournamentResult.data?.is_public || tournamentResult.data.status === 'completed') {
    return Response.json({ ok: false, message: 'This tournament is not accepting entries.' }, { status: 404 })
  }

  const preferenceToken = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString()
  const result = await supabase
    .from('tiq_tournament_entries')
    .insert({
      tournament_id: tournamentId,
      player_name: playerName,
      email,
      phone,
      self_rating: selfRating,
      sms_opt_in: smsOptIn,
      consent_note: consentNote,
      status: 'pending',
      preference_token_hash: hashValue(preferenceToken),
      preference_token_expires_at: expiresAt,
    })
    .select('id,tournament_id,player_name,self_rating,sms_opt_in,status,created_at,updated_at')
    .single()

  if (result.error) {
    console.error('Tournament entry insert failed', result.error)
    return Response.json({ ok: false, message: 'The entry could not be submitted.' }, { status: 500 })
  }

  return Response.json({
    ok: true,
    entry: result.data,
    preferenceHref: `/tournaments/${encodeURIComponent(tournamentId)}/preferences?token=${encodeURIComponent(preferenceToken)}`,
  })
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : ''
}

function cleanEmail(value: unknown) {
  const email = cleanText(value, 254).toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ''
}

function cleanPhone(value: unknown) {
  return cleanText(value, 32).replace(/[^\d+().\-\s]/g, '')
}

function normalizeSelfRating(value: unknown) {
  const rating = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(rating)) return 3.5
  return Math.min(7, Math.max(1, Math.round(rating * 2) / 2))
}

function getClientAddress(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'unknown'
}

function hashValue(value: string) {
  return createHash('sha256').update(value).digest('hex')
}
