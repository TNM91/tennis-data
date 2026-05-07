'use client'

import { supabase } from '@/lib/supabase'
import {
  getInternalNotificationPreferencesForProfiles,
  notificationTypeEnabled,
} from '@/lib/internal-notification-preferences'

export type InternalNotificationType = 'message' | 'schedule' | 'support' | 'system'

export type InternalNotification = {
  id: string
  recipientProfileId: string
  actorUserId: string
  notificationType: InternalNotificationType
  title: string
  body: string
  href: string
  conversationId: string
  scheduleEventId: string
  readAt: string
  createdAt: string
}

type NotificationRow = {
  id?: string | null
  recipient_profile_id?: string | null
  actor_user_id?: string | null
  notification_type?: string | null
  title?: string | null
  body?: string | null
  href?: string | null
  conversation_id?: string | null
  schedule_event_id?: string | null
  read_at?: string | null
  email_fallback_requested_at?: string | null
  email_fallback_sent_at?: string | null
  email_fallback_error?: string | null
  created_at?: string | null
}

type ParticipantRow = {
  profile_id?: string | null
}

function cleanText(value: string | null | undefined) {
  return (value || '').trim()
}

function normalizeNotificationType(value: string | null | undefined): InternalNotificationType {
  if (value === 'schedule' || value === 'support' || value === 'system') return value
  return 'message'
}

function toNotification(row: NotificationRow): InternalNotification | null {
  const id = cleanText(row.id)
  const recipientProfileId = cleanText(row.recipient_profile_id)
  if (!id || !recipientProfileId) return null

  return {
    id,
    recipientProfileId,
    actorUserId: cleanText(row.actor_user_id),
    notificationType: normalizeNotificationType(row.notification_type),
    title: cleanText(row.title),
    body: cleanText(row.body),
    href: cleanText(row.href),
    conversationId: cleanText(row.conversation_id),
    scheduleEventId: cleanText(row.schedule_event_id),
    readAt: cleanText(row.read_at),
    createdAt: cleanText(row.created_at),
  }
}

export async function listInternalNotifications(userId: string, options: { unreadOnly?: boolean; limit?: number } = {}) {
  let query = supabase
    .from('internal_notifications')
    .select('id, recipient_profile_id, actor_user_id, notification_type, title, body, href, conversation_id, schedule_event_id, read_at, created_at')
    .eq('recipient_profile_id', userId)
    .order('created_at', { ascending: false })
    .limit(options.limit ?? 20)

  if (options.unreadOnly) query = query.is('read_at', null)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data || []) as NotificationRow[])
    .map(toNotification)
    .filter((item): item is InternalNotification => Boolean(item))
}

export async function countUnreadInternalNotifications(userId: string) {
  const { count, error } = await supabase
    .from('internal_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_profile_id', userId)
    .is('read_at', null)

  if (error) return 0
  return count ?? 0
}

export async function markInternalNotificationRead(notificationId: string, userId: string) {
  const { error } = await supabase
    .from('internal_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('recipient_profile_id', userId)

  if (error) throw new Error(error.message)
}

export async function markAllInternalNotificationsRead(userId: string) {
  const { error } = await supabase
    .from('internal_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_profile_id', userId)
    .is('read_at', null)

  if (error) throw new Error(error.message)
}

export async function createInternalNotifications(input: {
  recipientProfileIds: string[]
  actorUserId: string
  notificationType: InternalNotificationType
  title: string
  body: string
  href: string
  conversationId?: string | null
  scheduleEventId?: string | null
}) {
  const recipientProfileIds = Array.from(
    new Set(input.recipientProfileIds.map(cleanText).filter((id) => id && id !== input.actorUserId)),
  )
  if (!recipientProfileIds.length) return

  const preferences = await getInternalNotificationPreferencesForProfiles(recipientProfileIds)
  const enabledRecipientProfileIds = recipientProfileIds.filter((recipientProfileId) => {
    const recipientPreferences = preferences.get(recipientProfileId)
    return !recipientPreferences || notificationTypeEnabled(recipientPreferences, input.notificationType)
  })

  if (!enabledRecipientProfileIds.length) return

  const { data, error } = await supabase.from('internal_notifications').insert(
    enabledRecipientProfileIds.map((recipientProfileId) => ({
      recipient_profile_id: recipientProfileId,
      actor_user_id: input.actorUserId,
      notification_type: input.notificationType,
      title: input.title,
      body: input.body,
      href: input.href,
      conversation_id: input.conversationId || null,
      schedule_event_id: input.scheduleEventId || null,
    })),
  ).select('id')

  if (error) throw new Error(error.message)

  const notificationIds = ((data || []) as Array<{ id?: string | null }>)
    .map((row) => cleanText(row.id))
    .filter(Boolean)
  const emailRecipientProfileIds = enabledRecipientProfileIds.filter((recipientProfileId) => {
    const recipientPreferences = preferences.get(recipientProfileId)
    return recipientPreferences?.emailFallbackEnabled
  })

  if (notificationIds.length && emailRecipientProfileIds.length) {
    await requestEmailFallbackForNotifications(notificationIds).catch(() => undefined)
  }
}

async function requestEmailFallbackForNotifications(notificationIds: string[]) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) return

  await fetch('/api/internal-notifications/email-fallback', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ notificationIds }),
  })
}

export async function notifyConversationParticipants(input: {
  conversationId: string
  actorUserId: string
  notificationType: InternalNotificationType
  title: string
  body: string
  href?: string
  scheduleEventId?: string | null
}) {
  const { data, error } = await supabase
    .from('internal_conversation_participants')
    .select('profile_id')
    .eq('conversation_id', input.conversationId)

  if (error) return
  const recipientProfileIds = ((data || []) as ParticipantRow[])
    .map((row) => cleanText(row.profile_id))
    .filter(Boolean)

  await createInternalNotifications({
    recipientProfileIds,
    actorUserId: input.actorUserId,
    notificationType: input.notificationType,
    title: input.title,
    body: input.body,
    href: input.href || `/messages?thread=${encodeURIComponent(input.conversationId)}`,
    conversationId: input.conversationId,
    scheduleEventId: input.scheduleEventId,
  }).catch(() => undefined)
}

export async function notifyInternalAdmins(input: {
  actorUserId: string
  title: string
  body: string
  href: string
  conversationId?: string | null
}) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(20)

  if (error) return
  const recipientProfileIds = ((data || []) as Array<{ id?: string | null }>)
    .map((row) => cleanText(row.id))
    .filter(Boolean)

  await createInternalNotifications({
    recipientProfileIds,
    actorUserId: input.actorUserId,
    notificationType: 'support',
    title: input.title,
    body: input.body,
    href: input.href,
    conversationId: input.conversationId,
  }).catch(() => undefined)
}
