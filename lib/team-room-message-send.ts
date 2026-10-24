import type {SupabaseClient} from '@supabase/supabase-js'

export type SentTeamMessage = {
  id: string
  sender_user_id: string
  body: string
  message_kind: string | null
  metadata: Record<string, unknown> | null
  created_at: string | null
  edited_at: string | null
  deleted_at: string | null
  reply_to_message_id: string | null
}

const columns = 'id,sender_user_id,body,message_kind,metadata,created_at,edited_at,deleted_at,reply_to_message_id'
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Omission preserves the website contract; an explicitly invalid key never becomes a new send.
export function parseTeamMessageSendId(value: unknown): string | null | false {
  if (value === undefined) return null
  return typeof value === 'string' && uuidV4.test(value) ? value.toLowerCase() : false
}

/** Call only after checking current team access and validating the reply target. */
export async function insertTeamMessage(service: SupabaseClient, input: {
  conversationId: string
  senderUserId: string
  body: string
  announcement: boolean
  replyToMessageId: string | null
  clientMessageId: string | null
}): Promise<
  | {ok: true; message: SentTeamMessage; replayed: boolean}
  | {ok: false; status: 409 | 500; message: string}
> {
  const kind = input.announcement ? 'announcement' : 'message'
  const inserted = await service.from('internal_messages').insert({
    ...(input.clientMessageId ? {id: input.clientMessageId} : {}),
    conversation_id: input.conversationId,
    sender_user_id: input.senderUserId,
    body: input.body,
    message_kind: kind,
    reply_to_message_id: input.replyToMessageId,
  }).select(columns).single()
  if (!inserted.error && inserted.data) {
    return {ok: true, message: inserted.data as SentTeamMessage, replayed: false}
  }
  if (inserted.error?.code !== '23505' || !input.clientMessageId) {
    return {ok: false, status: 500, message: 'Could not confirm your message. Try again with the same send.'}
  }

  // The primary key arbitrates simultaneous retries. Never return another sender's or room's row.
  const existing = await service.from('internal_messages').select(columns)
    .eq('id', input.clientMessageId)
    .eq('conversation_id', input.conversationId)
    .eq('sender_user_id', input.senderUserId)
    .maybeSingle()
  if (existing.error) {
    return {ok: false, status: 500, message: 'Could not confirm your message. Try again with the same send.'}
  }
  const message = existing.data as SentTeamMessage | null
  if (!message || message.deleted_at || message.edited_at || message.body !== input.body
    || message.message_kind !== kind || message.reply_to_message_id !== input.replyToMessageId) {
    return {ok: false, status: 409, message: 'This send has already been used. Refresh the conversation before sending again.'}
  }
  return {ok: true, message, replayed: true}
}
