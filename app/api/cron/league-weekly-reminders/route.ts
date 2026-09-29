import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabaseUrl } from '@/lib/supabase'
import { normalizeLeagueWeeklySettings, type LeagueWeeklyCourt } from '@/lib/league-weekly-format'
import { buildLeagueWeeklyEmail, findLeagueWeeklyPlayerCourt, getLeagueWeeklyDeliveryKind, type LeagueWeeklyDeliveryKind } from '@/lib/league-weekly-reminders'

export const runtime = 'nodejs'
export const maxDuration = 60

type WeeklySessionRow = {
  id: string
  public_token: string
  play_on: string
  status: string
  assignments: unknown
  league: {
    id: string
    league_name: string
    default_facility: string
    schedule_time_zone: string
    weekly_settings: unknown
    created_by_user_id: string | null
  } | null
}

type LeagueEntryRow = {
  created_by_user_id: string | null
  player_name: string
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false, message: 'Weekly league reminder runner is not authorized.' }, { status: 401 })
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) return Response.json({ ok: false, message: 'Weekly league reminders are not configured.' }, { status: 503 })
  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  const now = new Date()
  const start = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10)
  const end = new Date(now.getTime() + 7 * 86_400_000).toISOString().slice(0, 10)
  const { data, error } = await service
    .from('tiq_league_weekly_sessions')
    .select('id,public_token,play_on,status,assignments,league:tiq_leagues!inner(id,league_name,default_facility,schedule_time_zone,weekly_settings,created_by_user_id)')
    .gte('play_on', start)
    .lte('play_on', end)
    .in('status', ['collecting', 'published', 'completed'])
    .limit(100)
  if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })

  let notifications = 0
  let emails = 0
  let skipped = 0
  for (const row of (data || []) as unknown as WeeklySessionRow[]) {
    const league = row.league
    if (!league || !normalizeLeagueWeeklySettings(league.weekly_settings as never).emailRemindersEnabled) continue
    const kind = getLeagueWeeklyDeliveryKind({ now, timeZone: league.schedule_time_zone, playOn: row.play_on, status: row.status })
    if (!kind) continue
    const result = await deliverSession(service, row, kind, request.url)
    notifications += result.notifications
    emails += result.emails
    skipped += result.skipped
  }
  return Response.json({ ok: true, notifications, emails, skipped })
}

async function deliverSession(service: SupabaseClient, session: WeeklySessionRow, kind: LeagueWeeklyDeliveryKind, requestUrl: string) {
  const league = session.league
  if (!league) return { notifications: 0, emails: 0, skipped: 0 }
  const { data: entries, error } = await service
    .from('tiq_player_league_entries')
    .select('created_by_user_id,player_name')
    .eq('league_id', league.id)
    .eq('entry_status', 'active')
  if (error) return { notifications: 0, emails: 0, skipped: 0 }
  const assignments = Array.isArray(session.assignments) ? session.assignments as LeagueWeeklyCourt[] : []
  const recipients = Array.from(new Map(((entries || []) as LeagueEntryRow[])
    .filter((entry) => entry.created_by_user_id && (kind !== 'court_plan' || findLeagueWeeklyPlayerCourt(assignments, entry.player_name)))
    .map((entry) => [entry.created_by_user_id as string, entry])).values())
  const preferences = await loadEmailPreferences(service, recipients.map((entry) => entry.created_by_user_id as string))
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.trim()
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
    || new URL(requestUrl).origin
  const href = new URL(`/league-week/${session.public_token}`, origin).toString()
  let notifications = 0
  let emails = 0
  let skipped = 0

  for (const recipient of recipients) {
    const profileId = recipient.created_by_user_id as string
    const { error: claimError } = await service.from('tiq_league_weekly_deliveries').insert({
      session_id: session.id,
      recipient_profile_id: profileId,
      delivery_kind: kind,
    })
    if (claimError?.code === '23505') continue
    if (claimError) { skipped += 1; continue }

    const email = buildLeagueWeeklyEmail({
      kind,
      leagueName: league.league_name,
      playOn: session.play_on,
      playerName: recipient.player_name,
      facility: league.default_facility,
      assignments,
      href,
    })
    await service.from('internal_notifications').insert({
      recipient_profile_id: profileId,
      actor_user_id: league.created_by_user_id,
      notification_type: 'schedule',
      title: email.heading,
      body: email.body,
      href: `/league-week/${session.public_token}`,
    })
    notifications += 1

    if (!preferences.has(profileId) || !process.env.RESEND_API_KEY?.trim()) {
      skipped += 1
      await service.from('tiq_league_weekly_deliveries').update({ delivery_status: 'skipped', error_message: 'Member email alerts are not enabled.' }).eq('session_id', session.id).eq('recipient_profile_id', profileId).eq('delivery_kind', kind)
      continue
    }
    const { data: userData } = await service.auth.admin.getUserById(profileId)
    const address = userData.user?.email?.trim()
    if (!address) {
      skipped += 1
      await service.from('tiq_league_weekly_deliveries').update({ delivery_status: 'skipped', error_message: 'No member email is available.' }).eq('session_id', session.id).eq('recipient_profile_id', profileId).eq('delivery_kind', kind)
      continue
    }
    const response = await sendEmail(address, email)
    const providerPayload = await response.json().catch(() => null) as { id?: string; message?: string } | null
    await service.from('tiq_league_weekly_deliveries').update(response.ok ? {
      delivery_status: 'sent', provider_message_id: providerPayload?.id || '', sent_at: new Date().toISOString(), error_message: '',
    } : {
      delivery_status: 'failed', error_message: providerPayload?.message || 'Resend could not deliver this weekly email.',
    }).eq('session_id', session.id).eq('recipient_profile_id', profileId).eq('delivery_kind', kind)
    if (response.ok) emails += 1
    else skipped += 1
  }
  return { notifications, emails, skipped }
}

async function loadEmailPreferences(service: SupabaseClient, profileIds: string[]) {
  if (!profileIds.length) return new Set<string>()
  const { data } = await service.from('internal_notification_preferences').select('profile_id,email_fallback_enabled,schedule_alerts_enabled').in('profile_id', profileIds)
  return new Set(((data || []) as Array<{ profile_id: string; email_fallback_enabled: boolean | null; schedule_alerts_enabled: boolean | null }>)
    .filter((row) => row.email_fallback_enabled === true && row.schedule_alerts_enabled !== false)
    .map((row) => row.profile_id))
}

function sendEmail(to: string, email: ReturnType<typeof buildLeagueWeeklyEmail>) {
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY?.trim()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.TENACEIQ_EMAIL_FROM?.trim() || 'TenAceIQ <notifications@tenaceiq.com>',
      to,
      subject: email.subject,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a"><h1 style="font-size:20px">${escapeHtml(email.heading)}</h1><p>${escapeHtml(email.body)}</p><p><a href="${escapeHtml(email.href)}" style="color:#126044;font-weight:700">${escapeHtml(email.cta)}</a></p><p style="font-size:12px;color:#64748b">Manage email alerts in your TenAceIQ notification settings.</p></div>`,
    }),
  })
}

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}
