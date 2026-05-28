import { createClient } from '@supabase/supabase-js'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'
import { getTiqTournamentMessagingProviderState } from '@/lib/tiq-tournament-messaging'

export const runtime = 'nodejs'

type AlertRow = {
  id: string
  tournament_id: string
  message: string
  status: string
  recipient_count: number | null
  opted_in_count: number | null
}

type TournamentRow = {
  id: string
  name: string | null
  contacts: Record<string, Partial<{
    name: string
    phone: string
    smsOptIn: boolean
    consentNote: string
  }>> | null
  created_by_user_id: string | null
}

type AlertPreviewBody = {
  alertId?: unknown
}

function cleanText(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function cleanPhone(value: unknown) {
  return cleanText(value).replace(/[^\d+().\-\s]/g, '').replace(/\s+/g, ' ').trim()
}

export async function POST(request: Request) {
  const token = getBearerToken(request)
  if (!token) {
    return Response.json({ ok: false, message: 'Sign in to preview tournament alert delivery.' }, { status: 401 })
  }

  const requester = await getRequesterUser(token)
  if (!requester.userId) {
    return Response.json({ ok: false, message: 'Sign in to preview tournament alert delivery.' }, { status: 401 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) {
    return Response.json({ ok: false, message: 'Alert preview is missing Supabase service access.' }, { status: 500 })
  }

  let body: AlertPreviewBody
  try {
    body = (await request.json()) as AlertPreviewBody
  } catch {
    return Response.json({ ok: false, message: 'Invalid alert preview request.' }, { status: 400 })
  }

  const alertId = cleanText(body.alertId)
  if (!alertId) {
    return Response.json({ ok: false, message: 'Choose a queued alert to preview.' }, { status: 400 })
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  try {
    const providerState = getTiqTournamentMessagingProviderState()
    const alertResult = await supabase
      .from('tiq_tournament_alerts')
      .select('id,tournament_id,message,status,recipient_count,opted_in_count')
      .eq('id', alertId)
      .maybeSingle()

    if (alertResult.error) throw alertResult.error
    const alert = alertResult.data as AlertRow | null
    if (!alert) {
      return Response.json({ ok: false, message: 'Alert draft was not found.' }, { status: 404 })
    }
    if (alert.status !== 'queued') {
      return Response.json({ ok: false, message: 'Only queued alerts can be delivery-previewed.' }, { status: 400 })
    }

    const tournamentResult = await supabase
      .from('tiq_tournaments')
      .select('id,name,contacts,created_by_user_id')
      .eq('id', alert.tournament_id)
      .maybeSingle()

    if (tournamentResult.error) throw tournamentResult.error
    const tournament = tournamentResult.data as TournamentRow | null
    if (!tournament || tournament.created_by_user_id !== requester.userId) {
      return Response.json({ ok: false, message: 'You can only preview alerts for tournaments you created.' }, { status: 403 })
    }

    const contactRows = Object.entries(tournament.contacts || {})
      .map(([entrantName, contact]) => {
        const phone = cleanPhone(contact.phone)
        const smsOptIn = Boolean(contact.smsOptIn)
        return {
          entrantName,
          phone,
          consentNote: cleanText(contact.consentNote),
          smsOptIn,
          skipReason: phone ? smsOptIn ? '' : 'missing consent' : 'missing phone',
        }
      })

    const recipients = contactRows
      .filter((recipient) => recipient.smsOptIn && recipient.phone)
      .map((recipient) => ({
        entrantName: recipient.entrantName,
        phone: recipient.phone,
        consentNote: recipient.consentNote,
      }))

    const skippedRecipients = contactRows
      .filter((recipient) => recipient.skipReason)
      .map((recipient) => ({
        entrantName: recipient.entrantName,
        phone: recipient.phone,
        reason: recipient.skipReason,
      }))

    return Response.json({
      ok: true,
      mode: providerState.mode,
      provider: providerState.provider,
      tournamentName: tournament.name || 'Tournament',
      message: alert.message,
      expectedRecipientCount: alert.recipient_count || 0,
      optedInCount: recipients.length,
      recipients,
      skippedRecipients,
      note: providerState.previewNote,
    })
  } catch (error) {
    return Response.json(
      { ok: false, message: error instanceof Error ? error.message : 'Alert delivery preview failed.' },
      { status: 500 },
    )
  }
}

async function getRequesterUser(token: string) {
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
  const { data, error } = await supabase.auth.getUser(token)

  if (error) return { userId: undefined }
  return { userId: data.user?.id }
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get('authorization')
  return authHeader?.toLowerCase().startsWith('bearer ')
    ? authHeader.slice('bearer '.length).trim()
    : ''
}
