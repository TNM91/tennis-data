import { createClient } from '@supabase/supabase-js'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'
import { getCaptainAvailabilityServiceClient, isUuid } from '@/lib/captain-availability-request-server'
import { getWeeklyCommunicationRecipients, isWeeklyCommunicationKind, WEEKLY_COMMUNICATION_LABELS } from '@/lib/league-weekly-communications'
import type { LeagueWeeklyCourt } from '@/lib/league-weekly-format'

export const runtime = 'nodejs'

async function authorize(request: Request, sessionId: string) {
  const authorization = request.headers.get('authorization') || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!token) return { response: Response.json({ message: 'Sign in to send league updates.' }, { status: 401 }) }
  if (!isUuid(sessionId)) return { response: Response.json({ message: 'This weekly session is invalid.' }, { status: 400 }) }
  const auth = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await auth.auth.getUser(token)
  if (error || !data.user) return { response: Response.json({ message: 'Sign in again to manage weekly updates.' }, { status: 401 }) }
  const service = getCaptainAvailabilityServiceClient()
  const { data: session, error: sessionError } = await service.from('tiq_league_weekly_sessions').select('id,league_id,public_token,play_on,response_deadline,status,roster,assignments').eq('id', sessionId).maybeSingle()
  if (sessionError) throw sessionError
  if (!session) return { response: Response.json({ message: 'This weekly session was not found.' }, { status: 404 }) }
  const { data: league } = await service.from('tiq_leagues').select('league_name,created_by_user_id').eq('id', session.league_id).maybeSingle()
  if (!league) return { response: Response.json({ message: 'This league was not found.' }, { status: 404 }) }
  if (league.created_by_user_id !== data.user.id) {
    const { data: delegate } = await service.from('tiq_league_delegates').select('user_id').eq('league_id', session.league_id).eq('user_id', data.user.id).maybeSingle()
    if (!delegate) return { response: Response.json({ message: 'Only the owner or a delegate can send league updates.' }, { status: 403 }) }
  }
  return { service, session, league, userId: data.user.id }
}

export async function GET(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const context = await authorize(request, (await params).sessionId)
    if (context.response) return context.response
    const { data, error } = await context.service.from('internal_notifications').select('title,created_at').eq('href', `/league-week/${context.session.public_token}`).order('created_at', { ascending: false }).limit(500)
    if (error) throw error
    const receipts = Object.fromEntries(Object.entries(WEEKLY_COMMUNICATION_LABELS).map(([kind, label]) => {
      const rows = (data || []).filter((row) => row.title === `${context.league.league_name}: ${label}`)
      const lastSent = rows[0]?.created_at || ''
      return [kind, { lastSent, count: rows.filter((row) => lastSent && row.created_at === lastSent).length }]
    }))
    const { data: revisions } = await context.service.from('tiq_league_weekly_plan_revisions').select('id,affected_names,created_at').eq('session_id', context.session.id).is('notified_at', null).order('created_at', { ascending: false })
    return Response.json({ receipts, revision: revisions?.length ? { ...revisions[0], affected_names: [...new Set(revisions.flatMap(revision => revision.affected_names || []))] } : null })
  } catch {
    return Response.json({ message: 'Weekly delivery status could not be loaded.' }, { status: 503 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const context = await authorize(request, (await params).sessionId)
    if (context.response) return context.response
    const body = await request.json().catch(() => null) as { kind?: unknown; message?: unknown; revisionId?: unknown } | null
    if (!isWeeklyCommunicationKind(body?.kind)) return Response.json({ message: 'Choose a weekly update.' }, { status: 400 })
    const kind = body.kind
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 2000) : ''
    if (!message) return Response.json({ message: 'Write your update before sending.' }, { status: 400 })
    if (kind === 'reminder' && (context.session.status !== 'collecting' || (context.session.response_deadline && Date.parse(context.session.response_deadline) <= Date.now()))) return Response.json({ message: 'Replies are already closed for this week.' }, { status: 409 })
    if ((kind === 'roster' || kind === 'courts') && !['published', 'completed'].includes(context.session.status)) return Response.json({ message: 'Publish the confirmed court plan before sending it.' }, { status: 409 })
    let affectedNames: string[] = []
    let revisionIds: string[] = []
    if (kind === 'change') {
      const { data: revisions, error } = await context.service.from('tiq_league_weekly_plan_revisions').select('id,affected_names,after_plan').eq('session_id', context.session.id).is('notified_at', null).order('created_at', { ascending: false })
      const revision = revisions?.[0]
      if (error || !revision || revision.id !== body?.revisionId || JSON.stringify(revision.after_plan) !== JSON.stringify(context.session.assignments)) return Response.json({ message: 'Refresh and choose the latest saved court change before sending.' }, { status: 409 })
      affectedNames = [...new Set((revisions || []).flatMap(item => item.affected_names || []))]
      revisionIds = (revisions || []).map(item => item.id)
    }
    const [{ data: entries, error: entriesError }, { data: replies, error: repliesError }] = await Promise.all([
      context.service.from('tiq_player_league_entries').select('player_name,created_by_user_id').eq('league_id', context.session.league_id).eq('entry_status', 'active'),
      context.service.from('tiq_league_weekly_responses').select('player_name').eq('session_id', context.session.id),
    ])
    if (entriesError || repliesError) throw entriesError || repliesError
    const recipients = getWeeklyCommunicationRecipients({ kind, affectedNames, entries: entries || [], repliedNames: (replies || []).map((reply) => reply.player_name), roster: Array.isArray(context.session.roster) ? context.session.roster : [], assignments: Array.isArray(context.session.assignments) ? context.session.assignments as LeagueWeeklyCourt[] : [] })
    if (!recipients.length) return Response.json({ count: 0, message: 'No linked players need this update. Copy the message for your text group instead.' })
    const sentAt = new Date().toISOString()
    const { error } = await context.service.from('internal_notifications').insert(recipients.map((profileId) => ({ recipient_profile_id: profileId, actor_user_id: context.userId, notification_type: 'schedule', title: `${context.league.league_name}: ${WEEKLY_COMMUNICATION_LABELS[kind]}`, body: message, href: `/league-week/${context.session.public_token}`, created_at: sentAt })))
    if (error) throw error
    if (revisionIds.length) await context.service.from('tiq_league_weekly_plan_revisions').update({ notified_at: sentAt }).in('id', revisionIds).eq('session_id', context.session.id)
    return Response.json({ count: recipients.length, lastSent: sentAt, message: `Update sent to ${recipients.length} linked ${recipients.length === 1 ? 'player' : 'players'} in TiQ.` })
  } catch {
    return Response.json({ message: 'This weekly update could not be sent. Please try again.' }, { status: 503 })
  }
}
