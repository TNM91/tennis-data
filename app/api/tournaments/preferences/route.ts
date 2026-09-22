import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  let body: { tournamentId?: unknown; token?: unknown; smsOptIn?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return Response.json({ ok: false, message: 'Preference request could not be read.' }, { status: 400 })
  }

  const tournamentId = cleanText(body.tournamentId, 160)
  const token = cleanText(body.token, 180)
  const smsOptIn = Boolean(body.smsOptIn)
  if (!tournamentId || token.length < 32) {
    return Response.json({ ok: false, message: 'Use the private alert link from your tournament entry.' }, { status: 401 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) {
    console.error('Tournament preference service key is missing')
    return Response.json({ ok: false, message: 'Tournament preferences are temporarily unavailable.' }, { status: 503 })
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const rateResult = await supabase.rpc('consume_api_rate_limit', {
    target_scope: 'tournament-preference',
    target_key_hash: hashValue(`${serviceKey}:${getClientAddress(request)}:${token}`),
    target_limit: 20,
    target_window_seconds: 3600,
  })
  if (rateResult.error || !rateResult.data) {
    if (rateResult.error) console.error('Tournament preference rate limit failed', rateResult.error)
    return Response.json({ ok: false, message: 'Too many preference attempts. Try again later.' }, { status: rateResult.error ? 503 : 429 })
  }

  try {
    const entryResult = await supabase
      .from('tiq_tournament_entries')
      .select('id,tournament_id,player_name,phone,status,preference_token_expires_at')
      .eq('tournament_id', tournamentId)
      .eq('preference_token_hash', hashValue(token))
      .gt('preference_token_expires_at', new Date().toISOString())
      .maybeSingle()
    if (entryResult.error) throw entryResult.error
    const entry = entryResult.data
    if (!entry) {
      return Response.json({ ok: false, message: 'This private alert link is invalid or expired.' }, { status: 401 })
    }

    const updatedAt = new Date().toISOString()
    const consentNote = smsOptIn
      ? 'Participant updated SMS preference from a private tournament link.'
      : 'Participant opted out from a private tournament link.'
    const entryUpdate = await supabase
      .from('tiq_tournament_entries')
      .update({ sms_opt_in: smsOptIn, consent_note: consentNote, updated_at: updatedAt })
      .eq('id', entry.id)
    if (entryUpdate.error) throw entryUpdate.error

    const contactUpdate = await supabase
      .from('tiq_tournament_contacts')
      .upsert({
        tournament_id: tournamentId,
        entrant_name: entry.player_name,
        phone: entry.phone,
        sms_opt_in: smsOptIn,
        consent_note: consentNote,
        updated_at: updatedAt,
      }, { onConflict: 'tournament_id,entrant_name' })
    if (contactUpdate.error) throw contactUpdate.error

    const eventInsert = await supabase.from('tiq_tournament_preference_events').insert({
      tournament_id: tournamentId,
      tournament_entry_id: entry.id,
      player_name: entry.player_name,
      phone: entry.phone,
      action: smsOptIn ? 'opt_in' : 'opt_out',
      source: 'tournament_preferences',
      consent_note: consentNote,
    })
    if (eventInsert.error) throw eventInsert.error

    return Response.json({
      ok: true,
      message: smsOptIn ? 'Tournament text alerts are on.' : 'Tournament text alerts are off.',
      phoneLastFour: cleanText(entry.phone, 32).replace(/\D/g, '').slice(-4),
    })
  } catch (error) {
    console.error('Tournament preference update failed', error)
    return Response.json({ ok: false, message: 'Tournament preference could not be saved.' }, { status: 500 })
  }
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : ''
}

function getClientAddress(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'unknown'
}

function hashValue(value: string) {
  return createHash('sha256').update(value).digest('hex')
}
