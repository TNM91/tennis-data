'use client'

import { supabase } from './supabase'

function cleanText(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

export async function notifyEntryStatus(input: {
  recipientProfileId: string
  actorUserId: string
  title: string
  body: string
  href: string
}) {
  const recipientProfileId = cleanText(input.recipientProfileId)
  const actorUserId = cleanText(input.actorUserId)
  if (!recipientProfileId || !actorUserId || recipientProfileId === actorUserId) return

  const { error } = await supabase.from('internal_notifications').insert({
    recipient_profile_id: recipientProfileId,
    actor_user_id: actorUserId,
    notification_type: 'system',
    title: cleanText(input.title),
    body: cleanText(input.body),
    href: cleanText(input.href),
  })

  if (error) throw new Error(error.message)
}
