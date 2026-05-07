'use client'

import { normalizeUserRole, type UserRole } from '@/lib/roles'
import { notifyConversationParticipants, notifyInternalAdmins } from '@/lib/internal-notifications'
import { supabase } from '@/lib/supabase'

export type InternalConversationType = 'direct' | 'support' | 'league' | 'system'
export type InternalConversationStatus = 'open' | 'waiting_on_user' | 'waiting_on_admin' | 'closed'
export type InternalSupportCategory = 'billing' | 'league' | 'result' | 'data' | 'account' | 'general'

export type InternalIdentity = {
  userId: string
  email: string
  role: UserRole
  displayName: string
  tiqPublicId: string
  tiqAdminId: string
  identityColumnsAvailable: boolean
}

export type InternalConversation = {
  id: string
  conversationType: InternalConversationType
  subject: string
  status: InternalConversationStatus
  createdByUserId: string
  assignedAdminUserId: string | null
  relatedEntityType: string
  relatedEntityId: string
  metadata: Record<string, string>
  createdAt: string
  updatedAt: string
  lastMessageBody: string
  lastMessageAt: string
  lastMessageSenderUserId: string
  lastReadAt: string
  isUnread: boolean
  participantCount: number
}

export type InternalMessage = {
  id: string
  conversationId: string
  senderUserId: string
  body: string
  messageKind: 'message' | 'support_note' | 'system'
  createdAt: string
}

export type InternalRecipient = {
  id: string
  displayName: string
  role: UserRole
  tiqPublicId: string
  tiqAdminId: string
  linkedPlayerId: string
}

type ProfileIdentityRow = {
  id?: string | null
  role?: string | null
  linked_player_name?: string | null
  linked_player_id?: string | null
  message_display_name?: string | null
  display_name?: string | null
  tiq_public_id?: string | null
  tiq_admin_id?: string | null
}

type ConversationRow = {
  id: string
  conversation_type: InternalConversationType | string | null
  subject: string | null
  status: InternalConversationStatus | string | null
  created_by_user_id: string
  assigned_admin_user_id: string | null
  related_entity_type: string | null
  related_entity_id: string | null
  metadata?: Record<string, string> | null
  created_at: string | null
  updated_at: string | null
}

type ParticipantRow = {
  conversation_id: string
  profile_id?: string | null
  last_read_at?: string | null
}

type MessageRow = {
  id: string
  conversation_id: string
  sender_user_id: string
  body: string | null
  message_kind: string | null
  created_at: string | null
}

function compactTiqId(userId: string) {
  return userId.replaceAll('-', '').slice(0, 10).toUpperCase()
}

function buildTiqPublicId(userId: string) {
  return `TIQ-${compactTiqId(userId)}`
}

function buildTiqAdminId(userId: string) {
  return `TIQ-ADMIN-${userId.replaceAll('-', '').slice(0, 8).toUpperCase()}`
}

function normalizeConversationStatus(value: string | null | undefined): InternalConversationStatus {
  if (value === 'waiting_on_user' || value === 'waiting_on_admin' || value === 'closed') return value
  return 'open'
}

function normalizeConversationType(value: string | null | undefined): InternalConversationType {
  if (value === 'support' || value === 'league' || value === 'system') return value
  return 'direct'
}

function normalizeMessageKind(value: string | null | undefined): InternalMessage['messageKind'] {
  if (value === 'support_note' || value === 'system') return value
  return 'message'
}

function normalizeMetadata(value: Record<string, string> | null | undefined): Record<string, string> {
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => typeof item === 'string' && item.trim())
      .map(([key, item]) => [key, item.trim()]),
  )
}

function toConversation(
  row: ConversationRow,
  lastMessage: MessageRow | null,
  participantCount: number,
  options: {
    currentUserId: string
    currentUserRole: UserRole
    lastReadAt?: string | null
  },
): InternalConversation {
  const lastMessageAt = lastMessage?.created_at || row.updated_at || row.created_at || ''
  const lastMessageSenderUserId = lastMessage?.sender_user_id || ''
  const lastReadAt = options.lastReadAt || ''
  const isAdminUnread =
    options.currentUserRole === 'admin' &&
    normalizeConversationType(row.conversation_type) === 'support' &&
    normalizeConversationStatus(row.status) !== 'closed' &&
    normalizeConversationStatus(row.status) !== 'waiting_on_user' &&
    lastMessageSenderUserId !== options.currentUserId
  const isParticipantUnread =
    Boolean(lastMessageSenderUserId) &&
    lastMessageSenderUserId !== options.currentUserId &&
    (!lastReadAt || new Date(lastMessageAt).getTime() > new Date(lastReadAt).getTime())

  return {
    id: row.id,
    conversationType: normalizeConversationType(row.conversation_type),
    subject: row.subject || 'Conversation',
    status: normalizeConversationStatus(row.status),
    createdByUserId: row.created_by_user_id,
    assignedAdminUserId: row.assigned_admin_user_id || null,
    relatedEntityType: row.related_entity_type || '',
    relatedEntityId: row.related_entity_id || '',
    metadata: normalizeMetadata(row.metadata),
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || row.created_at || '',
    lastMessageBody: lastMessage?.body || '',
    lastMessageAt,
    lastMessageSenderUserId,
    lastReadAt,
    isUnread: isAdminUnread || isParticipantUnread,
    participantCount,
  }
}

function normalizeSupportCategory(value: string | null | undefined): InternalSupportCategory {
  if (value === 'billing' || value === 'league' || value === 'result' || value === 'data' || value === 'account') return value
  return 'general'
}

function toMessage(row: MessageRow): InternalMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderUserId: row.sender_user_id,
    body: row.body || '',
    messageKind: normalizeMessageKind(row.message_kind),
    createdAt: row.created_at || '',
  }
}

export async function getInternalIdentity(): Promise<InternalIdentity | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const user = session?.user
  if (!user) return null

  const fallbackPublicId = buildTiqPublicId(user.id)
  const fallbackAdminId = buildTiqAdminId(user.id)
  let identityColumnsAvailable = true

  const richProfile = await supabase
    .from('profiles')
    .select('id, role, linked_player_id, linked_player_name, message_display_name, tiq_public_id, tiq_admin_id')
    .eq('id', user.id)
    .maybeSingle()

  let profile = (richProfile.data ?? null) as ProfileIdentityRow | null
  if (richProfile.error) {
    identityColumnsAvailable = false
    const legacyProfile = await supabase
      .from('profiles')
      .select('id, role, linked_player_id, linked_player_name')
      .eq('id', user.id)
      .maybeSingle()

    profile = (legacyProfile.data ?? null) as ProfileIdentityRow | null
  }

  const role = normalizeUserRole(profile?.role ?? 'member')
  const tiqPublicId = profile?.tiq_public_id?.trim() || fallbackPublicId
  const tiqAdminId = role === 'admin' ? profile?.tiq_admin_id?.trim() || fallbackAdminId : ''
  const displayName = profile?.message_display_name?.trim() || profile?.linked_player_name?.trim() || user.email || tiqPublicId

  if (identityColumnsAvailable && (!profile?.tiq_public_id || !profile?.message_display_name || (role === 'admin' && !profile?.tiq_admin_id))) {
    const payload: Record<string, string> = { tiq_public_id: tiqPublicId }
    if (role === 'admin') payload.tiq_admin_id = tiqAdminId
    if (!profile?.message_display_name) payload.message_display_name = displayName
    await supabase.from('profiles').update(payload).eq('id', user.id)
  }

  return {
    userId: user.id,
    email: user.email ?? '',
    role,
    displayName,
    tiqPublicId,
    tiqAdminId,
    identityColumnsAvailable,
  }
}

function toInternalRecipient(row: ProfileIdentityRow): InternalRecipient | null {
  const userId = row.id || ''
  if (!userId) return null

  return {
    id: userId,
    displayName: row.display_name?.trim() || row.message_display_name?.trim() || row.linked_player_name?.trim() || row.tiq_admin_id || row.tiq_public_id || userId,
    role: normalizeUserRole(row.role ?? 'member'),
    tiqPublicId: row.tiq_public_id || buildTiqPublicId(userId),
    tiqAdminId: row.tiq_admin_id || '',
    linkedPlayerId: row.linked_player_id || '',
  }
}

async function findRecipientByExactId(value: string): Promise<InternalRecipient | null> {
  const normalized = value.trim()
  const profileSelect = 'id, role, linked_player_id, linked_player_name, message_display_name, tiq_public_id, tiq_admin_id'
  const directorySelect = 'id, role, linked_player_id, display_name, tiq_public_id, tiq_admin_id'
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)
  let byId = isUuid
    ? await supabase
        .from('internal_message_directory')
        .select(directorySelect)
        .eq('id', normalized)
        .limit(1)
        .maybeSingle()
    : await supabase
        .from('internal_message_directory')
        .select(directorySelect)
        .or(`tiq_public_id.eq.${normalized.toUpperCase()},tiq_admin_id.eq.${normalized.toUpperCase()}`)
        .limit(1)
        .maybeSingle()

  if (byId.error) {
    byId = isUuid
      ? await supabase
          .from('profiles')
          .select(profileSelect)
          .eq('id', normalized)
          .limit(1)
          .maybeSingle()
      : await supabase
          .from('profiles')
          .select(profileSelect)
          .or(`tiq_public_id.eq.${normalized.toUpperCase()},tiq_admin_id.eq.${normalized.toUpperCase()}`)
          .limit(1)
          .maybeSingle()
  }

  if (byId.error || !byId.data) return null

  return toInternalRecipient(byId.data as ProfileIdentityRow)
}

export async function findInternalRecipientByProfileId(profileId: string): Promise<InternalRecipient | null> {
  return findRecipientByExactId(profileId)
}

export async function findInternalRecipientByPlayerId(playerId: string): Promise<InternalRecipient | null> {
  const normalized = playerId.trim()
  if (!normalized) return null

  const directorySelect = 'id, role, linked_player_id, display_name, tiq_public_id, tiq_admin_id'
  const profileSelect = 'id, role, linked_player_id, linked_player_name, message_display_name, tiq_public_id, tiq_admin_id'
  let result = await supabase
    .from('internal_message_directory')
    .select(directorySelect)
    .eq('linked_player_id', normalized)
    .limit(1)
    .maybeSingle()

  if (result.error) {
    result = await supabase
      .from('profiles')
      .select(profileSelect)
      .eq('linked_player_id', normalized)
      .limit(1)
      .maybeSingle()
  }

  if (result.error || !result.data) return null
  return toInternalRecipient(result.data as ProfileIdentityRow)
}

export async function resolveInternalRecipient(input: {
  profileId?: string | null
  playerId?: string | null
  nameOrId?: string | null
}): Promise<InternalRecipient | null> {
  if (input.profileId?.trim()) {
    const profileMatch = await findInternalRecipientByProfileId(input.profileId)
    if (profileMatch) return profileMatch
  }

  if (input.playerId?.trim()) {
    const playerMatch = await findInternalRecipientByPlayerId(input.playerId)
    if (playerMatch) return playerMatch
  }

  if (input.nameOrId?.trim()) return findInternalRecipient(input.nameOrId)
  return null
}

export async function findInternalRecipient(value: string): Promise<InternalRecipient | null> {
  const normalized = value.trim()
  if (!normalized) return null

  const exact = await findRecipientByExactId(normalized)
  if (exact) return exact

  const matches = await searchInternalRecipients(normalized)
  return matches[0] ?? null
}

export async function searchInternalRecipients(value: string, currentUserId?: string): Promise<InternalRecipient[]> {
  const normalized = value.trim()
  if (normalized.length < 2) return []

  const exact = await findRecipientByExactId(normalized)
  const byName = await supabase
    .from('internal_message_directory')
    .select('id, role, linked_player_id, display_name, tiq_public_id, tiq_admin_id')
    .ilike('display_name', `%${normalized}%`)
    .order('display_name', { ascending: true })
    .limit(8)

  const rows = byName.error ? [] : ((byName.data ?? []) as ProfileIdentityRow[])
  const map = new Map<string, InternalRecipient>()

  if (exact && exact.id !== currentUserId) {
    map.set(exact.id, exact)
  }

  for (const row of rows) {
    const recipient = toInternalRecipient(row)
    if (recipient && recipient.id !== currentUserId) {
      map.set(recipient.id, recipient)
    }
  }

  return Array.from(map.values()).slice(0, 8)
}

export async function saveInternalDisplayName(userId: string, displayName: string) {
  const cleanName = displayName.trim()
  if (cleanName.length < 2) throw new Error('Use at least two characters for your messaging name.')
  if (cleanName.length > 80) throw new Error('Keep your messaging name under 80 characters.')

  const { error } = await supabase
    .from('profiles')
    .update({ message_display_name: cleanName })
    .eq('id', userId)

  if (error) throw new Error(error.message)
  return cleanName
}

export async function listInternalConversations(identity: InternalIdentity): Promise<InternalConversation[]> {
  let conversationRows: ConversationRow[] = []
  const conversationSelect = 'id, conversation_type, subject, status, created_by_user_id, assigned_admin_user_id, related_entity_type, related_entity_id, metadata, created_at, updated_at'

  if (identity.role === 'admin') {
    const { data, error } = await supabase
      .from('internal_conversations')
      .select(conversationSelect)
      .order('updated_at', { ascending: false })
      .limit(80)

    if (error) throw new Error(error.message)
    conversationRows = (data ?? []) as ConversationRow[]
  } else {
    const participantResult = await supabase
      .from('internal_conversation_participants')
      .select('conversation_id')
      .eq('profile_id', identity.userId)
      .limit(120)

    if (participantResult.error) throw new Error(participantResult.error.message)
    const ids = Array.from(new Set(((participantResult.data ?? []) as ParticipantRow[]).map((row) => row.conversation_id)))
    if (ids.length === 0) return []

    const { data, error } = await supabase
      .from('internal_conversations')
      .select(conversationSelect)
      .in('id', ids)
      .order('updated_at', { ascending: false })

    if (error) throw new Error(error.message)
    conversationRows = (data ?? []) as ConversationRow[]
  }

  const conversationIds = conversationRows.map((row) => row.id)
  if (conversationIds.length === 0) return []

  const [messagesResult, participantsResult] = await Promise.all([
    supabase
      .from('internal_messages')
      .select('id, conversation_id, sender_user_id, body, message_kind, created_at')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false })
      .limit(300),
    supabase
      .from('internal_conversation_participants')
      .select('conversation_id, profile_id, last_read_at')
      .in('conversation_id', conversationIds),
  ])

  if (messagesResult.error) throw new Error(messagesResult.error.message)
  if (participantsResult.error) throw new Error(participantsResult.error.message)

  const latestByConversation = new Map<string, MessageRow>()
  for (const message of (messagesResult.data ?? []) as MessageRow[]) {
    if (!latestByConversation.has(message.conversation_id)) {
      latestByConversation.set(message.conversation_id, message)
    }
  }

  const participantCount = new Map<string, number>()
  const currentUserReads = new Map<string, string>()
  for (const participant of (participantsResult.data ?? []) as ParticipantRow[]) {
    participantCount.set(participant.conversation_id, (participantCount.get(participant.conversation_id) ?? 0) + 1)
    if (participant.profile_id === identity.userId) {
      currentUserReads.set(participant.conversation_id, participant.last_read_at || '')
    }
  }

  return conversationRows.map((row) =>
    toConversation(
      row,
      latestByConversation.get(row.id) ?? null,
      participantCount.get(row.id) ?? 0,
      {
        currentUserId: identity.userId,
        currentUserRole: identity.role,
        lastReadAt: currentUserReads.get(row.id) || '',
      },
    ),
  )
}

export async function listInternalMessages(conversationId: string): Promise<InternalMessage[]> {
  const { data, error } = await supabase
    .from('internal_messages')
    .select('id, conversation_id, sender_user_id, body, message_kind, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(300)

  if (error) throw new Error(error.message)
  return ((data ?? []) as MessageRow[]).map(toMessage)
}

export async function createSupportConversation(
  identity: InternalIdentity,
  subject: string,
  body: string,
  options?: {
    category?: string | null
    entityType?: string | null
    entityId?: string | null
  },
) {
  const cleanSubject = subject.trim() || 'Support request'
  const cleanBody = body.trim()
  if (!cleanBody) throw new Error('Add a message before opening support.')
  const category = normalizeSupportCategory(options?.category)
  const entityType = (options?.entityType || '').trim()
  const entityId = (options?.entityId || '').trim()

  const { data, error } = await supabase
    .from('internal_conversations')
    .insert({
      conversation_type: 'support',
      subject: cleanSubject,
      status: 'waiting_on_admin',
      created_by_user_id: identity.userId,
      related_entity_type: category,
      related_entity_id: entityId || entityType || identity.tiqPublicId,
      metadata: {
        category,
        entityType,
        entityId,
      },
    })
    .select('id, conversation_type, subject, status, created_by_user_id, assigned_admin_user_id, related_entity_type, related_entity_id, metadata, created_at, updated_at')
    .single()

  if (error) throw new Error(error.message)
  const conversation = data as ConversationRow

  await supabase.from('internal_conversation_participants').insert({
    conversation_id: conversation.id,
    profile_id: identity.userId,
    participant_role: identity.role === 'admin' ? 'admin' : 'member',
  })

  await sendInternalMessage(conversation.id, identity.userId, cleanBody)
  await notifyInternalAdmins({
    actorUserId: identity.userId,
    title: 'New support request',
    body: `${cleanSubject} opened in TenAceIQ support.`,
    href: `/messages?thread=${encodeURIComponent(conversation.id)}`,
    conversationId: conversation.id,
  })
  return conversation.id
}

export async function createDirectConversation(
  identity: InternalIdentity,
  recipient: InternalRecipient,
  subject: string,
  body: string,
) {
  const cleanBody = body.trim()
  if (!cleanBody) throw new Error('Add a message before starting the conversation.')
  if (recipient.id === identity.userId) throw new Error('Choose another TenAceIQ user to message.')

  const { data, error } = await supabase
    .from('internal_conversations')
    .insert({
      conversation_type: 'direct',
      subject: subject.trim() || `Message with ${recipient.displayName}`,
      status: 'open',
      created_by_user_id: identity.userId,
    })
    .select('id, conversation_type, subject, status, created_by_user_id, assigned_admin_user_id, related_entity_type, related_entity_id, metadata, created_at, updated_at')
    .single()

  if (error) throw new Error(error.message)
  const conversation = data as ConversationRow

  const participants = [
    {
      conversation_id: conversation.id,
      profile_id: identity.userId,
      participant_role: identity.role === 'admin' ? 'admin' : 'member',
    },
    {
      conversation_id: conversation.id,
      profile_id: recipient.id,
      participant_role: recipient.role === 'admin' ? 'admin' : 'member',
    },
  ]

  const participantResult = await supabase.from('internal_conversation_participants').insert(participants)
  if (participantResult.error) throw new Error(participantResult.error.message)

  await sendInternalMessage(conversation.id, identity.userId, cleanBody)
  return conversation.id
}

export async function createLeagueConversation(
  identity: InternalIdentity,
  input: {
    leagueId: string
    leagueName: string
    subject: string
    body: string
    participantPlayerIds?: string[]
    participantProfileIds?: string[]
    participantNames?: string[]
    entityType?: string
    entityId?: string
    metadata?: Record<string, string>
  },
) {
  const cleanBody = input.body.trim()
  if (!cleanBody) throw new Error('Add a message before opening the league room.')

  const profileIds = new Set<string>([identity.userId])
  for (const profileId of input.participantProfileIds || []) {
    if (profileId.trim()) profileIds.add(profileId.trim())
  }

  for (const playerId of input.participantPlayerIds || []) {
    const recipient = await findInternalRecipientByPlayerId(playerId)
    if (recipient) profileIds.add(recipient.id)
  }

  for (const name of input.participantNames || []) {
    const recipient = await findInternalRecipient(name)
    if (recipient) profileIds.add(recipient.id)
  }

  const { data, error } = await supabase
    .from('internal_conversations')
    .insert({
      conversation_type: 'league',
      subject: input.subject.trim() || `${input.leagueName} league room`,
      status: 'open',
      created_by_user_id: identity.userId,
      related_entity_type: input.entityType || 'tiq_league',
      related_entity_id: input.entityId || input.leagueId,
      metadata: {
        entityType: input.entityType || 'tiq_league',
        entityId: input.entityId || input.leagueId,
        leagueName: input.leagueName,
        ...input.metadata,
      },
    })
    .select('id, conversation_type, subject, status, created_by_user_id, assigned_admin_user_id, related_entity_type, related_entity_id, metadata, created_at, updated_at')
    .single()

  if (error) throw new Error(error.message)
  const conversation = data as ConversationRow

  const participants = Array.from(profileIds).map((profileId) => ({
    conversation_id: conversation.id,
    profile_id: profileId,
    participant_role: profileId === identity.userId && identity.role === 'admin' ? 'admin' : 'member',
  }))

  const participantResult = await supabase.from('internal_conversation_participants').insert(participants)
  if (participantResult.error) throw new Error(participantResult.error.message)

  await sendInternalMessage(conversation.id, identity.userId, cleanBody)
  return conversation.id
}

export async function sendInternalMessage(
  conversationId: string,
  senderUserId: string,
  body: string,
  options?: {
    notificationType?: 'message' | 'schedule' | 'support' | 'system'
    notificationTitle?: string
    notificationBody?: string
    scheduleEventId?: string | null
  },
) {
  const cleanBody = body.trim()
  if (!cleanBody) throw new Error('Add a message first.')

  const { error } = await supabase.from('internal_messages').insert({
    conversation_id: conversationId,
    sender_user_id: senderUserId,
    body: cleanBody,
    message_kind: 'message',
  })

  if (error) throw new Error(error.message)

  await supabase
    .from('internal_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId)

  await notifyConversationParticipants({
    conversationId,
    actorUserId: senderUserId,
    notificationType: options?.notificationType || 'message',
    title: options?.notificationTitle || 'New TenAceIQ message',
    body: options?.notificationBody || 'Open Messages to reply.',
    scheduleEventId: options?.scheduleEventId,
  })
}

export async function markInternalConversationRead(conversationId: string, userId: string) {
  const timestamp = new Date().toISOString()
  const { error } = await supabase
    .from('internal_conversation_participants')
    .update({ last_read_at: timestamp })
    .eq('conversation_id', conversationId)
    .eq('profile_id', userId)

  if (error) return false
  return true
}

export async function countUnreadInternalConversations(identity: InternalIdentity): Promise<number> {
  const conversations = await listInternalConversations(identity)
  return conversations.filter((conversation) => conversation.isUnread).length
}
