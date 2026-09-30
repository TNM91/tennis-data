import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { buildLeagueWeeklyRecapEmail, normalizeLeagueWeeklyRecapDraft, validateLeagueWeeklyRecapDraft } from '@/lib/league-weekly-recap-delivery'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 60

type SessionRow = {
  id: string
  league_id: string
  public_token: string
  play_on: string
  recap: unknown
  league: { league_name: string; created_by_user_id: string | null } | null
}

type LeagueEntryRow = { created_by_user_id: string | null; player_name: string }

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const authorization = request.headers.get('authorization') || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!token) return Response.json({ ok: false, message: 'Sign in to manage this recap.' }, { status: 401 })

  const auth = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  const { data: authData, error: authError } = await auth.auth.getUser(token)
  if (authError || !authData.user) return Response.json({ ok: false, message: 'Your session has expired. Sign in again.' }, { status: 401 })

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) return Response.json({ ok: false, message: 'Recap delivery is not configured.' }, { status: 503 })
  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  const { sessionId } = await context.params
  const { data: session, error: sessionError } = await service
    .from('tiq_league_weekly_sessions')
    .select('id,league_id,public_token,play_on,recap,league:tiq_leagues!inner(league_name,created_by_user_id)')
    .eq('id', sessionId)
    .maybeSingle()
  if (sessionError) return Response.json({ ok: false, message: sessionError.message }, { status: 500 })
  if (!session) return Response.json({ ok: false, message: 'This weekly session was not found.' }, { status: 404 })
  const row = session as unknown as SessionRow
  if (!await canManageLeague(service, row, authData.user.id)) {
    return Response.json({ ok: false, message: 'Only the league owner or a delegate can manage this recap.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null) as { action?: unknown; recap?: unknown } | null
  const action = body?.action === 'send' ? 'send' : 'save'
  const draft = normalizeLeagueWeeklyRecapDraft(body?.recap)
  const validationError = validateLeagueWeeklyRecapDraft(draft)
  if (validationError) return Response.json({ ok: false, message: validationError }, { status: 400 })

  if (action === 'save') {
    const previousRecap = row.recap && typeof row.recap === 'object' ? row.recap as Record<string, unknown> : {}
    const savedDraft = {
      ...draft,
      ...(typeof previousRecap.sentAt === 'string' ? { sentAt: previousRecap.sentAt } : {}),
      ...(Number.isFinite(previousRecap.sentCount) ? { sentCount: Number(previousRecap.sentCount) } : {}),
      ...(Number.isFinite(previousRecap.emailCount) ? { emailCount: Number(previousRecap.emailCount) } : {}),
    }
    const { error } = await service.from('tiq_league_weekly_sessions').update({ recap: savedDraft, status: 'completed' }).eq('id', row.id)
    if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })
    return Response.json({ ok: true, recap: savedDraft, message: 'Recap draft saved.' })
  }

  if (!process.env.RESEND_API_KEY?.trim()) {
    return Response.json({ ok: false, message: 'Email delivery is not configured.' }, { status: 503 })
  }
  let result: Awaited<ReturnType<typeof sendRecap>>
  try {
    result = await sendRecap(service, row, draft, request.url)
  } catch (error) {
    return Response.json({ ok: false, message: error instanceof Error ? error.message : 'The recap could not be delivered.' }, { status: 500 })
  }
  const previousRecap = row.recap && typeof row.recap === 'object' ? row.recap as Record<string, unknown> : {}
  const recap = {
    ...draft,
    sentAt: new Date().toISOString(),
    sentCount: (Number(previousRecap.sentCount) || 0) + result.notifications,
    emailCount: (Number(previousRecap.emailCount) || 0) + result.emails,
  }
  const { error: updateError } = await service.from('tiq_league_weekly_sessions').update({ recap, status: 'completed' }).eq('id', row.id)
  if (updateError) return Response.json({ ok: false, message: updateError.message }, { status: 500 })
  return Response.json({
    ok: true,
    recap,
    ...result,
    message: result.notifications
      ? `Recap shared with ${result.notifications} ${result.notifications === 1 ? 'player' : 'players'}${result.emails ? ` · ${result.emails} ${result.emails === 1 ? 'email' : 'emails'} sent` : ''}.`
      : result.alreadySent
        ? 'This recap was already sent to every eligible player.'
        : 'Recap saved, but there are no linked players to notify.',
  })
}

async function canManageLeague(service: SupabaseClient, session: SessionRow, userId: string) {
  if (session.league?.created_by_user_id === userId) return true
  const { data } = await service.from('tiq_league_delegates').select('id').eq('league_id', session.league_id).eq('user_id', userId).maybeSingle()
  return Boolean(data)
}

async function sendRecap(service: SupabaseClient, session: SessionRow, draft: ReturnType<typeof normalizeLeagueWeeklyRecapDraft>, requestUrl: string) {
  const { data: entries, error } = await service.from('tiq_player_league_entries').select('created_by_user_id,player_name').eq('league_id', session.league_id).eq('entry_status', 'active')
  if (error) throw new Error(error.message)
  const recipients = Array.from(new Map(((entries || []) as LeagueEntryRow[])
    .filter((entry) => entry.created_by_user_id)
    .map((entry) => [entry.created_by_user_id as string, entry])).values())
  const profileIds = recipients.map((entry) => entry.created_by_user_id as string)
  const { data: preferenceRows } = profileIds.length
    ? await service.from('internal_notification_preferences').select('profile_id,email_fallback_enabled,schedule_alerts_enabled').in('profile_id', profileIds)
    : { data: [] }
  const emailEnabled = new Set(((preferenceRows || []) as Array<{ profile_id: string; email_fallback_enabled: boolean | null; schedule_alerts_enabled: boolean | null }>)
    .filter((row) => row.email_fallback_enabled === true && row.schedule_alerts_enabled !== false)
    .map((row) => row.profile_id))
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.trim()
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
    || new URL(requestUrl).origin
  const href = new URL(`/league-week/${session.public_token}`, origin).toString()
  const email = buildLeagueWeeklyRecapEmail({ leagueName: session.league?.league_name || 'League', playOn: session.play_on, draft, href })
  let emails = 0
  let notifications = 0
  let skipped = 0
  let alreadySent = 0

  for (let index = 0; index < recipients.length; index += 10) {
    const outcomes = await Promise.all(recipients.slice(index, index + 10).map(async (recipient) => {
      const profileId = recipient.created_by_user_id as string
      const { error: claimError } = await service.from('tiq_league_weekly_deliveries').insert({ session_id: session.id, recipient_profile_id: profileId, delivery_kind: 'recap' })
      if (claimError?.code === '23505') return { emails: 0, notifications: 0, skipped: 0, alreadySent: 1 }
      if (claimError) return { emails: 0, notifications: 0, skipped: 1, alreadySent: 0 }
      const { error: notificationError } = await service.from('internal_notifications').insert({
        recipient_profile_id: profileId,
        actor_user_id: session.league?.created_by_user_id,
        notification_type: 'schedule',
        title: draft.headline,
        body: draft.summary,
        href: `/league-week/${session.public_token}`,
      })
      const notificationCount = notificationError ? 0 : 1
      if (!emailEnabled.has(profileId)) {
        await markDelivery(service, session.id, profileId, 'skipped', 'Member email alerts are not enabled.')
        return { emails: 0, notifications: notificationCount, skipped: 1, alreadySent: 0 }
      }
      const { data: userData } = await service.auth.admin.getUserById(profileId)
      const address = userData.user?.email?.trim()
      if (!address) {
        await markDelivery(service, session.id, profileId, 'skipped', 'No member email is available.')
        return { emails: 0, notifications: notificationCount, skipped: 1, alreadySent: 0 }
      }
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY?.trim()}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `weekly-recap/${session.id}/${profileId}`,
        },
        body: JSON.stringify({ from: process.env.TENACEIQ_EMAIL_FROM?.trim() || 'TenAceIQ <notifications@tenaceiq.com>', to: address, subject: email.subject, html: email.html, text: email.text }),
      })
      const payload = await response.json().catch(() => null) as { id?: string; message?: string } | null
      if (response.ok) {
        await service.from('tiq_league_weekly_deliveries').update({ delivery_status: 'sent', provider_message_id: payload?.id || '', sent_at: new Date().toISOString(), error_message: '' }).eq('session_id', session.id).eq('recipient_profile_id', profileId).eq('delivery_kind', 'recap')
        return { emails: 1, notifications: notificationCount, skipped: 0, alreadySent: 0 }
      }
      await markDelivery(service, session.id, profileId, 'failed', payload?.message || 'Resend could not deliver this recap.')
      return { emails: 0, notifications: notificationCount, skipped: 1, alreadySent: 0 }
    }))
    for (const outcome of outcomes) {
      emails += outcome.emails
      notifications += outcome.notifications
      skipped += outcome.skipped
      alreadySent += outcome.alreadySent
    }
  }
  return { emails, notifications, skipped, alreadySent }
}

function markDelivery(service: SupabaseClient, sessionId: string, profileId: string, status: 'failed' | 'skipped', message: string) {
  return service.from('tiq_league_weekly_deliveries').update({ delivery_status: status, error_message: message }).eq('session_id', sessionId).eq('recipient_profile_id', profileId).eq('delivery_kind', 'recap')
}
