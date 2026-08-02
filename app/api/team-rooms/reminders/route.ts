import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabaseUrl } from '@/lib/supabase'
import { buildTeamRoomHref } from '@/lib/team-room'
import { parseReminderTargets } from '@/lib/team-room-match-flow'
import { sendTeamRoomPush } from '@/lib/team-room-push-server'

export const runtime = 'nodejs'

type DueScheduleRow = {
  id: string
  conversation_id: string
  message_id: string
  created_by_user_id: string
  targets: unknown
}

type NotificationRow = {
  id: string
  recipient_profile_id: string
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim()
  const authorization = request.headers.get('authorization') || ''
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, message: 'Reminder runner is not authorized.' }, { status: 401 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) return Response.json({ ok: false, message: 'Reminder runner is not configured.' }, { status: 503 })
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const { data, error } = await service
    .from('team_room_reminder_schedules')
    .select('id,conversation_id,message_id,created_by_user_id,targets')
    .eq('status', 'scheduled')
    .lte('reminder_at', new Date().toISOString())
    .order('reminder_at', { ascending: true })
    .limit(100)
  if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })

  let sent = 0
  let completed = 0
  for (const schedule of (data ?? []) as DueScheduleRow[]) {
    const result = await processSchedule(service, schedule, request.url)
    sent += result.sent
    completed += result.completed ? 1 : 0
  }
  return Response.json({ ok: true, schedules: completed, notifications: sent })
}

async function processSchedule(service: SupabaseClient, schedule: DueScheduleRow, requestUrl: string) {
  const now = new Date().toISOString()
  const { data: claimed } = await service
    .from('team_room_reminder_schedules')
    .update({ status: 'sent', sent_at: now, updated_at: now })
    .eq('id', schedule.id)
    .eq('status', 'scheduled')
    .select('id')
    .maybeSingle()
  if (!claimed) return { completed: false, sent: 0 }

  const targets = parseReminderTargets(schedule.targets)
  const [responsesResult, acknowledgmentsResult, messageResult, conversationResult] = await Promise.all([
    service.from('team_room_message_responses').select('profile_id,response').eq('message_id', schedule.message_id),
    service.from('team_room_lineup_acknowledgments').select('profile_id,lineup_version').eq('message_id', schedule.message_id),
    service.from('internal_messages').select('metadata').eq('id', schedule.message_id).maybeSingle(),
    service.from('internal_conversations').select('subject,metadata').eq('id', schedule.conversation_id).maybeSingle(),
  ])
  const responseByProfileId = new Map(((responsesResult.data ?? []) as Array<{ profile_id: string; response?: string }>).map((row) => [row.profile_id, row.response || ''] as const))
  const acknowledgedKeys = new Set(((acknowledgmentsResult.data ?? []) as Array<{ profile_id: string; lineup_version: number }>).map((row) => `${row.profile_id}:${row.lineup_version}`))
  const openTargets = targets.filter((target) => (
    (target.needsResponse && !responseByProfileId.has(target.profileId))
    || (target.needsMaybeFollowup && responseByProfileId.get(target.profileId) === 'maybe')
    || (target.needsAckVersion > 0 && !acknowledgedKeys.has(`${target.profileId}:${target.needsAckVersion}`))
  ))
  if (!openTargets.length) {
    await service.from('team_room_reminder_schedules').update({ notification_count: 0 }).eq('id', schedule.id)
    return { completed: true, sent: 0 }
  }

  const metadata = messageResult.data?.metadata && typeof messageResult.data.metadata === 'object'
    ? messageResult.data.metadata as Record<string, unknown>
    : {}
  const teamName = cleanText(conversationResult.data?.subject).replace(/ Team Room$/i, '') || 'Your team'
  const matchDate = cleanText(metadata.matchDate)
  const conversationMetadata = conversationResult.data?.metadata && typeof conversationResult.data.metadata === 'object'
    ? conversationResult.data.metadata as Record<string, unknown>
    : {}
  const href = buildTeamRoomHref({
    teamName: cleanText(conversationMetadata.teamName) || teamName,
    leagueName: cleanText(conversationMetadata.leagueName),
    flight: cleanText(conversationMetadata.flight),
  })
  const { data: notificationRows } = await service.from('internal_notifications').insert(openTargets.map((target) => ({
    recipient_profile_id: target.profileId,
    actor_user_id: schedule.created_by_user_id,
    notification_type: 'schedule',
    title: `${teamName} needs your reply`,
    body: matchDate ? `Open the ${matchDate} match card to finish your reply.` : 'Open the latest match card to finish your reply.',
    href,
    conversation_id: schedule.conversation_id,
  }))).select('id,recipient_profile_id')
  const notifications = (notificationRows ?? []) as NotificationRow[]
  const notificationBody = matchDate ? `Open the ${matchDate} match card to finish your reply.` : 'Open the latest match card to finish your reply.'
  await sendTeamRoomPush(service, openTargets.map((target) => target.profileId), {
    title: `${teamName} needs your reply`,
    body: notificationBody,
    href,
    tag: `team-room-${schedule.conversation_id}`,
  })

  await service.from('internal_messages').insert({
    conversation_id: schedule.conversation_id,
    sender_user_id: schedule.created_by_user_id,
    body: `Automatic reminder sent to ${openTargets.length} teammate${openTargets.length === 1 ? '' : 's'} who still need to reply.`,
    message_kind: 'system',
    metadata: { teamRoomReminder: true, matchMessageId: schedule.message_id, automatic: true },
  })
  await service.from('team_room_reminder_schedules').update({ notification_count: notifications.length }).eq('id', schedule.id)
  await service.from('internal_conversations').update({ updated_at: now }).eq('id', schedule.conversation_id)
  await sendOptInEmails(service, notifications, requestUrl, href)
  return { completed: true, sent: notifications.length }
}

async function sendOptInEmails(service: SupabaseClient, notifications: NotificationRow[], requestUrl: string, href: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey || !notifications.length) return
  const profileIds = notifications.map((notification) => notification.recipient_profile_id)
  const { data: preferences } = await service
    .from('internal_notification_preferences')
    .select('profile_id,email_fallback_enabled,schedule_alerts_enabled')
    .in('profile_id', profileIds)
  const emailIds = new Set(((preferences ?? []) as Array<{
    profile_id: string
    email_fallback_enabled: boolean | null
    schedule_alerts_enabled: boolean | null
  }>).filter((row) => row.email_fallback_enabled === true && row.schedule_alerts_enabled !== false).map((row) => row.profile_id))
  const notificationByProfileId = new Map(notifications.map((row) => [row.recipient_profile_id, row]))

  for (const profileId of emailIds) {
    const notification = notificationByProfileId.get(profileId)
    if (!notification) continue
    const { data: userResult } = await service.auth.admin.getUserById(profileId)
    const email = userResult.user?.email?.trim()
    if (!email) continue
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.TENACEIQ_EMAIL_FROM?.trim() || 'TenAceIQ <notifications@tenaceiq.com>',
        to: email,
        subject: 'Your team needs a match reply',
        html: `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a"><h1 style="font-size:20px">Your team needs your reply.</h1><p>Open the current TenAceIQ match card to confirm availability or acknowledge the latest lineup.</p><p><a href="${escapeAttribute(new URL(href, siteOrigin(requestUrl)).toString())}" style="color:#2563eb;font-weight:700">Open Team Chat</a></p></div>`,
      }),
    })
    await service.from('internal_notifications').update(response.ok
      ? { email_fallback_requested_at: nowIso(), email_fallback_sent_at: nowIso(), email_fallback_error: '' }
      : { email_fallback_requested_at: nowIso(), email_fallback_error: 'Automatic reminder email failed.' }
    ).eq('id', notification.id)
  }
}

function siteOrigin(requestUrl: string) {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim()
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
    || new URL(requestUrl).origin
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function escapeAttribute(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
}

function nowIso() {
  return new Date().toISOString()
}
