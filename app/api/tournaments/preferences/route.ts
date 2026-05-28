import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type TournamentRow = {
  id: string
  name: string | null
  entrants: string[] | null
  contacts: Record<string, Partial<{
    name: string
    phone: string
    smsOptIn: boolean
    consentNote: string
    updatedAt: string
  }>> | null
  is_public: boolean | null
}

function cleanText(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function cleanPhone(value: unknown) {
  return cleanText(value).replace(/[^\d+().\-\s]/g, '').replace(/\s+/g, ' ').trim()
}

function comparable(value: unknown) {
  return cleanText(value).toLowerCase()
}

function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!supabaseUrl || !serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for tournament preference updates.')
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export async function POST(request: NextRequest) {
  let body: {
    tournamentId?: string
    playerName?: string
    phone?: string
    smsOptIn?: boolean
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, message: 'Preference request could not be read.' }, { status: 400 })
  }

  const tournamentId = cleanText(body.tournamentId)
  const playerName = cleanText(body.playerName)
  const phone = cleanPhone(body.phone)
  const smsOptIn = Boolean(body.smsOptIn)

  if (!tournamentId || !playerName || !phone) {
    return NextResponse.json({ ok: false, message: 'Enter your tournament name and phone number.' }, { status: 400 })
  }

  try {
    const supabase = getServiceClient()
    const tournamentResult = await supabase
      .from('tiq_tournaments')
      .select('id,name,entrants,contacts,is_public')
      .eq('id', tournamentId)
      .maybeSingle()

    if (tournamentResult.error) throw tournamentResult.error

    const tournament = tournamentResult.data as TournamentRow | null
    if (!tournament?.is_public) {
      return NextResponse.json({ ok: false, message: 'Tournament preferences are not available.' }, { status: 404 })
    }

    const entriesResult = await supabase
      .from('tiq_tournament_entries')
      .select('id,player_name,phone,status')
      .eq('tournament_id', tournamentId)

    if (entriesResult.error) throw entriesResult.error

    const matchedEntry = (entriesResult.data || []).find((entry) => (
      comparable(entry.player_name) === comparable(playerName)
      && cleanPhone(entry.phone) === phone
    ))

    if (!matchedEntry) {
      return NextResponse.json({ ok: false, message: 'We could not match that name and phone for this tournament.' }, { status: 404 })
    }

    const updatedAt = new Date().toISOString()
    const consentNote = smsOptIn
      ? 'Participant updated SMS preference from tournament link.'
      : 'Participant opted out from tournament link.'

    const entryUpdate = await supabase
      .from('tiq_tournament_entries')
      .update({
        sms_opt_in: smsOptIn,
        consent_note: consentNote,
        updated_at: updatedAt,
      })
      .eq('id', matchedEntry.id)

    if (entryUpdate.error) throw entryUpdate.error

    const contacts = { ...(tournament.contacts || {}) }
    const entrantName = (tournament.entrants || []).find((entrant) => comparable(entrant) === comparable(playerName)) || playerName
    contacts[entrantName] = {
      ...(contacts[entrantName] || {}),
      name: entrantName,
      phone,
      smsOptIn,
      consentNote,
      updatedAt,
    }

    const tournamentUpdate = await supabase
      .from('tiq_tournaments')
      .update({ contacts, updated_at: updatedAt })
      .eq('id', tournamentId)

    if (tournamentUpdate.error) throw tournamentUpdate.error

    const eventInsert = await supabase
      .from('tiq_tournament_preference_events')
      .insert({
        tournament_id: tournamentId,
        tournament_entry_id: matchedEntry.id,
        player_name: entrantName,
        phone,
        action: smsOptIn ? 'opt_in' : 'opt_out',
        source: 'tournament_preferences',
        consent_note: consentNote,
      })

    if (eventInsert.error) throw eventInsert.error

    return NextResponse.json({
      ok: true,
      message: smsOptIn ? 'Tournament text alerts are on.' : 'Tournament text alerts are off.',
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'Tournament preference could not be saved.',
    }, { status: 500 })
  }
}
