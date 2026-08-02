import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import webpush from 'web-push'

type TeamRoomPushPayload = {
  title: string
  body: string
  href: string
  tag?: string
}

type PushSubscriptionRow = {
  id: string
  endpoint: string
  p256dh: string
  auth_key: string
}

let configured = false

export async function sendTeamRoomPush(
  service: SupabaseClient,
  profileIds: string[],
  payload: TeamRoomPushPayload,
) {
  const recipients = Array.from(new Set(profileIds.filter(Boolean)))
  if (!recipients.length || !configureWebPush()) return { sent: 0, removed: 0 }

  const { data } = await service
    .from('team_room_push_subscriptions')
    .select('id,endpoint,p256dh,auth_key')
    .in('profile_id', recipients)

  const subscriptions = (data ?? []) as PushSubscriptionRow[]
  if (!subscriptions.length) return { sent: 0, removed: 0 }

  const expiredIds: string[] = []
  let sent = 0
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth_key,
        },
      }, JSON.stringify({
        title: payload.title,
        body: payload.body,
        href: payload.href,
        tag: payload.tag || 'tenaceiq-team-room',
      }), {
        TTL: 60 * 60 * 12,
        urgency: 'high',
      })
      sent += 1
    } catch (error) {
      const statusCode = typeof error === 'object' && error && 'statusCode' in error
        ? Number((error as { statusCode?: unknown }).statusCode)
        : 0
      if (statusCode === 404 || statusCode === 410) expiredIds.push(subscription.id)
    }
  }))

  if (expiredIds.length) {
    await service.from('team_room_push_subscriptions').delete().in('id', expiredIds)
  }
  return { sent, removed: expiredIds.length }
}

function configureWebPush() {
  if (configured) return true
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim()
  if (!publicKey || !privateKey) return false
  webpush.setVapidDetails(
    process.env.WEB_PUSH_SUBJECT?.trim() || 'mailto:support@tenaceiq.com',
    publicKey,
    privateKey,
  )
  configured = true
  return true
}
