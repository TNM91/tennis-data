'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react'
import SiteShell from '@/app/components/site-shell'
import PlayerSuitePanel from '@/app/components/player-suite-panel'
import { useAuth } from '@/app/components/auth-provider'
import {
  cancelInternalScheduleEvent,
  listInternalScheduleEventsForConversation,
  listInternalScheduleResponses,
  saveInternalScheduleResponse,
  updateInternalScheduleEvent,
  type InternalScheduleEvent,
  type InternalScheduleResponse,
  type InternalScheduleResponseStatus,
} from '@/lib/internal-scheduling'
import {
  listInternalNotifications,
  markAllInternalNotificationsRead,
  markInternalNotificationRead,
  type InternalNotification,
} from '@/lib/internal-notifications'
import {
  createDirectConversation,
  createSupportConversation,
  getInternalIdentity,
  listInternalConversations,
  listInternalMessages,
  markInternalConversationRead,
  resolveInternalRecipient,
  saveInternalDisplayName,
  sendInternalMessage,
  searchInternalRecipients,
  updateInternalConversationOps,
  type InternalConversation,
  type InternalConversationStatus,
  type InternalIdentity,
  type InternalMessage,
  type InternalRecipient,
} from '@/lib/internal-messages'
import {
  getInternalNotificationPreferences,
  saveInternalNotificationPreferences,
  type InternalNotificationPreferences,
  type InternalNotificationPreferencePatch,
} from '@/lib/internal-notification-preferences'
import type { CoachStudentLink } from '@/lib/coach-storage'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

type ComposeMode = 'support' | 'direct'
type SupportFilter = 'all' | 'billing' | 'league' | 'result' | 'data' | 'account' | 'general'
type InboxFilter = 'all' | 'pinned' | 'needs_reply' | 'unread' | 'support' | 'direct' | 'league' | 'schedule'
type AlertFilter = 'all' | 'unread' | 'message' | 'support' | 'schedule' | 'system'

type MessagePrefill = {
  mode: ComposeMode
  recipient: string
  recipientProfileId: string
  recipientPlayerId: string
  subject: string
  body: string
  category: SupportFilter
  entityType: string
  entityId: string
  assignmentId: string
  assignmentTitle: string
  assignmentFocus: string
  threadId: string
}

type CoachMessageContact = {
  linkId: string
  relationship: 'coach' | 'student'
  profileId: string
  name: string
  identitySlug: string
  levelLabel: string
  status: CoachStudentLink['status']
}

type CalendarQuickAddCandidate = {
  title: string
  date: string
  time: string
  location: string
  sourceLabel: string
}

function formatMessageTime(value: string) {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function conversationTypeLabel(type: InternalConversation['conversationType']) {
  if (type === 'support') return 'Support'
  if (type === 'league') return 'League'
  if (type === 'system') return 'System'
  return 'Direct'
}

function supportCategoryLabel(value: string) {
  if (value === 'billing') return 'Billing'
  if (value === 'league') return 'League'
  if (value === 'result') return 'Result'
  if (value === 'data') return 'Data issue'
  if (value === 'account') return 'Account'
  return 'General'
}

function normalizeSupportFilter(value: string | null): SupportFilter {
  if (value === 'billing' || value === 'league' || value === 'result' || value === 'data' || value === 'account') return value
  return 'general'
}

function statusLabel(status: InternalConversation['status']) {
  if (status === 'waiting_on_admin') return 'Waiting on admin'
  if (status === 'waiting_on_user') return 'Waiting on user'
  if (status === 'closed') return 'Closed'
  return 'Open'
}

function supportStatusCopy(conversation: InternalConversation, role: InternalIdentity['role']) {
  if (conversation.status === 'closed') return 'Resolved. Reopen it if more help is needed.'
  if (conversation.status === 'waiting_on_admin') {
    return role === 'admin'
      ? 'Needs an admin reply.'
      : 'We are reviewing this and will reply here.'
  }
  if (conversation.status === 'waiting_on_user') {
    return role === 'admin'
      ? 'Waiting on the user.'
      : 'We replied and are waiting on you.'
  }
  return 'Open support thread.'
}

function conversationNeedsReply(conversation: InternalConversation, identity: InternalIdentity) {
  if (conversation.conversationType === 'support') {
    if (identity.role === 'admin') return conversation.status === 'waiting_on_admin'
    return conversation.status === 'waiting_on_user' || conversation.isUnread
  }
  return conversation.isUnread
}

function isScheduleConversation(conversation: InternalConversation) {
  const entityType = conversation.metadata.entityType || conversation.relatedEntityType
  return entityType === 'tiq_schedule_item' || entityType === 'schedule_match'
}

function conversationMatchesInboxFilter(
  conversation: InternalConversation,
  identity: InternalIdentity,
  filter: InboxFilter,
) {
  if (filter === 'needs_reply') return conversationNeedsReply(conversation, identity)
  if (filter === 'unread') return conversation.isUnread
  if (filter === 'support') return conversation.conversationType === 'support'
  if (filter === 'direct') return conversation.conversationType === 'direct'
  if (filter === 'league') return conversation.conversationType === 'league'
  if (filter === 'schedule') return isScheduleConversation(conversation)
  return true
}

function conversationMatchesThreadSearch(
  conversation: InternalConversation,
  identity: InternalIdentity,
  query: string,
) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true

  const searchable = [
    conversation.subject,
    conversation.lastMessageBody,
    conversationTypeLabel(conversation.conversationType),
    statusLabel(conversation.status),
    conversation.conversationType === 'support' ? supportCategoryLabel(conversation.relatedEntityType) : '',
    conversation.conversationType === 'support' ? supportStatusCopy(conversation, identity.role) : '',
    conversation.relatedEntityType,
    conversation.relatedEntityId,
    conversation.metadata.entityType,
    conversation.metadata.entityId,
    conversation.metadata.leagueName,
    conversation.metadata.assignmentTitle,
    conversation.metadata.assignmentFocus,
  ].join(' ').toLowerCase()

  return searchable.includes(normalized)
}

function inboxFilterLabel(filter: InboxFilter) {
  if (filter === 'pinned') return 'Pinned'
  if (filter === 'needs_reply') return 'Needs reply'
  if (filter === 'unread') return 'Unread'
  if (filter === 'support') return 'Support'
  if (filter === 'direct') return 'Direct'
  if (filter === 'league') return 'League'
  if (filter === 'schedule') return 'Scheduling'
  return 'All'
}

function alertFilterLabel(filter: AlertFilter) {
  if (filter === 'unread') return 'Unread'
  if (filter === 'message') return 'Messages'
  if (filter === 'support') return 'Support'
  if (filter === 'schedule') return 'Schedule'
  if (filter === 'system') return 'System'
  return 'All'
}

function notificationMatchesAlertFilter(notification: InternalNotification, filter: AlertFilter) {
  if (filter === 'unread') return !notification.readAt
  if (filter === 'all') return true
  return notification.notificationType === filter
}

function replyPlaceholder(conversation: InternalConversation | null) {
  if (!conversation) return 'Write a reply...'
  if (conversation.conversationType === 'support') return 'Reply to this support request...'
  if (conversation.conversationType === 'league') return 'Message this league room...'
  if (isScheduleConversation(conversation)) return 'Add a schedule note...'
  return 'Write a message...'
}

function detectCalendarQuickAddCandidate(
  text: string,
  fallbackTitle: string,
  sourceLabel: string,
): CalendarQuickAddCandidate | null {
  const cleaned = text.trim().replace(/\s+/g, ' ')
  if (!cleaned) return null

  const dateMatch = cleaned.match(/\b(20\d{2}-\d{2}-\d{2})(?:[ T]+([01]?\d|2[0-3]):([0-5]\d))?/)
  if (!dateMatch?.[1]) return null

  const parsed = new Date(`${dateMatch[1]}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return null

  const beforeDate = cleaned.slice(0, dateMatch.index).replace(/\b(on|for|at)\s*$/i, '').trim()
  const afterDate = cleaned.slice((dateMatch.index ?? 0) + dateMatch[0].length)
  const locationMatch = afterDate.match(/(?:\bat\s+|@\s*)([A-Za-z0-9 .,#'&-]{3,80})/)
  const title = beforeDate && beforeDate.length >= 4 ? beforeDate.slice(0, 90) : fallbackTitle || 'Message calendar item'

  return {
    title,
    date: dateMatch[1],
    time: dateMatch[2] && dateMatch[3] ? `${dateMatch[2].padStart(2, '0')}:${dateMatch[3]}` : '',
    location: locationMatch?.[1]?.trim().replace(/[.!?]$/, '').slice(0, 80) || '',
    sourceLabel,
  }
}

function getQuickReplyActions(conversation: InternalConversation | null, role: InternalIdentity['role']) {
  if (!conversation) return []
  if (conversation.conversationType === 'support') {
    return role === 'admin'
      ? [
          { label: 'Reviewing', body: 'Thanks for sending this in. I am reviewing it now and will update this thread shortly.' },
          { label: 'Need details', body: 'Can you send one more detail here so we can verify this accurately?' },
          { label: 'Resolved note', body: 'This should be resolved now. Reply here if anything still looks off.' },
        ]
      : [
          { label: 'Add details', body: 'Here are the extra details that may help:' },
          { label: 'Still need help', body: 'I still need help with this. The issue I am seeing now is:' },
          { label: 'Thanks', body: 'Thanks, that answers my question.' },
        ]
  }
  if (isScheduleConversation(conversation)) {
    return [
      { label: 'Time works', body: 'That time works for me.' },
      { label: 'Need alternate', body: 'I need an alternate time. I can make:' },
      { label: 'Site note', body: 'Quick site note:' },
    ]
  }
  if (conversation.conversationType === 'league') {
    return [
      { label: 'Availability', body: 'My availability for this league item is:' },
      { label: 'Result note', body: 'Result note:' },
      { label: 'Lineup note', body: 'Lineup note:' },
    ]
  }
  return [
    { label: 'Quick note', body: 'Quick note:' },
    { label: 'Follow up', body: 'Following up on this:' },
    { label: 'Looks good', body: 'Looks good to me.' },
  ]
}

const composeSearchParamKeys = [
  'compose',
  'recipient',
  'recipientProfileId',
  'recipientPlayerId',
  'subject',
  'body',
  'category',
  'entityType',
  'entityId',
  'assignmentId',
  'assignmentTitle',
  'assignmentFocus',
] as const

function replaceThreadUrl(conversationId: string) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  for (const key of composeSearchParamKeys) {
    url.searchParams.delete(key)
  }
  if (conversationId) {
    url.searchParams.set('thread', conversationId)
  } else {
    url.searchParams.delete('thread')
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
}

function buildThreadShareUrl(conversationId: string) {
  if (typeof window === 'undefined') return `/messages?thread=${encodeURIComponent(conversationId)}`
  const url = new URL('/messages', window.location.origin)
  url.searchParams.set('thread', conversationId)
  return url.toString()
}

const messageDraftStoragePrefix = 'tenaceiq:messages:draft:'

function messageDraftStorageKey(conversationId: string) {
  return `${messageDraftStoragePrefix}${conversationId}`
}

function readMessageDraft(conversationId: string) {
  if (typeof window === 'undefined' || !conversationId) return ''
  try {
    return window.localStorage.getItem(messageDraftStorageKey(conversationId)) || ''
  } catch {
    return ''
  }
}

function writeMessageDraft(conversationId: string, value: string) {
  if (typeof window === 'undefined' || !conversationId) return
  try {
    const key = messageDraftStorageKey(conversationId)
    if (value.trim()) {
      window.localStorage.setItem(key, value)
    } else {
      window.localStorage.removeItem(key)
    }
  } catch {
    // Draft persistence is a convenience; messaging should still work without storage.
  }
}

function removeMessageDraft(conversationId: string) {
  writeMessageDraft(conversationId, '')
}

function getConversationDraftIds(conversations: InternalConversation[]) {
  if (typeof window === 'undefined') return new Set<string>()
  const draftIds = new Set<string>()
  for (const conversation of conversations) {
    if (readMessageDraft(conversation.id).trim()) draftIds.add(conversation.id)
  }
  return draftIds
}

function pinnedThreadsStorageKey(userId: string) {
  return `tenaceiq:messages:pinned:${userId}`
}

function readPinnedThreadIds(userId: string) {
  if (typeof window === 'undefined' || !userId) return new Set<string>()
  try {
    const raw = window.localStorage.getItem(pinnedThreadsStorageKey(userId))
    const ids = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === 'string' && id.trim()) : [])
  } catch {
    return new Set<string>()
  }
}

function writePinnedThreadIds(userId: string, threadIds: Set<string>) {
  if (typeof window === 'undefined' || !userId) return
  try {
    window.localStorage.setItem(pinnedThreadsStorageKey(userId), JSON.stringify(Array.from(threadIds)))
  } catch {
    // Pins are local convenience state; the inbox still works without storage.
  }
}

function buildConversationContextHref(conversation: InternalConversation | null, coachContacts: CoachMessageContact[]) {
  if (!conversation) return ''
  const entityType = conversation.metadata.entityType || conversation.relatedEntityType
  const entityId = conversation.metadata.entityId || conversation.relatedEntityId
  if (!entityType || !entityId) return ''

  if (entityType === 'tiq_league') {
    return `/explore/leagues/tiq/${encodeURIComponent(entityId)}?league_id=${encodeURIComponent(entityId)}`
  }
  if (entityType === 'tiq_individual_result') return '/compete/results'
  if (entityType === 'tiq_schedule_item' || entityType === 'schedule_match') return '/compete/schedule'
  if (entityType === 'coach_player_link') {
    const contact = coachContacts.find((item) => item.linkId === entityId)
    const assignmentId = conversation.metadata.assignmentId
    const assignmentAnchor = assignmentId ? `#coach-assignment-${encodeURIComponent(assignmentId)}` : ''
    if (contact?.relationship === 'student') return `/coach${assignmentAnchor}`
    return assignmentAnchor ? `/mylab${assignmentAnchor}` : '/mylab#player-workshop'
  }
  if (entityType === 'billing') return '/profile'
  return ''
}

function buildConversationContextPresentation(conversation: InternalConversation | null, coachContacts: CoachMessageContact[]) {
  if (!conversation) {
    return {
      label: 'Context',
      text: 'Conversation context',
      cta: 'Open context',
    }
  }

  const entityType = conversation.metadata.entityType || conversation.relatedEntityType
  const entityId = conversation.metadata.entityId || conversation.relatedEntityId

  if (conversation.conversationType === 'league') {
    return {
      label: 'League context',
      text: conversation.metadata.leagueName || conversation.relatedEntityId || 'League conversation',
      cta: 'Open league',
    }
  }

  if (conversation.conversationType === 'support') {
    return {
      label: 'Support context',
      text: `${supportCategoryLabel(conversation.relatedEntityType)} support`,
      cta: 'Open context',
    }
  }

  if (entityType === 'coach_player_link') {
    const contact = coachContacts.find((item) => item.linkId === entityId)
    const isCoachView = contact?.relationship === 'student'
    const assignmentTitle = conversation.metadata.assignmentTitle
    const assignmentFocus = conversation.metadata.assignmentFocus
    const relationshipLabel = isCoachView ? 'Coach-player thread' : 'Player+ coach thread'
    const subjectCue = conversation.subject.toLowerCase().includes('first') ? 'First assignment request' : 'Coach-player development thread'
    return {
      label: relationshipLabel,
      text: assignmentTitle
        ? `Assignment follow-up: ${assignmentTitle}${assignmentFocus ? ` / ${assignmentFocus}` : ''}`
        : `${subjectCue}${contact?.name ? ` with ${contact.name}` : ''}`,
      cta: isCoachView ? 'Open Coach Hub' : 'Open My Lab',
    }
  }

  return {
    label: 'Context',
    text: 'Conversation context',
    cta: 'Open context',
  }
}

function normalizeCoachMessageContacts(items: CoachMessageContact[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.relationship}:${item.linkId}:${item.profileId}`
    if (!item.linkId || !item.profileId || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function fetchCoachMessageContacts(): Promise<CoachMessageContact[]> {
  const [coachResponse, playerResponse] = await Promise.allSettled([
    fetch('/api/coach/students', { cache: 'no-store' }),
    fetch('/api/player/coach-assignments', { cache: 'no-store' }),
  ])

  const contacts: CoachMessageContact[] = []

  if (coachResponse.status === 'fulfilled' && coachResponse.value.ok) {
    const json = (await coachResponse.value.json()) as { students?: CoachStudentLink[] }
    for (const student of json.students ?? []) {
      if (!student.playerUserId) continue
      contacts.push({
        linkId: student.id,
        relationship: 'student',
        profileId: student.playerUserId,
        name: student.playerName,
        identitySlug: student.identitySlug,
        levelLabel: student.levelLabel,
        status: student.status,
      })
    }
  }

  if (playerResponse.status === 'fulfilled' && playerResponse.value.ok) {
    const json = (await playerResponse.value.json()) as { coachLinks?: CoachStudentLink[] }
    for (const link of json.coachLinks ?? []) {
      if (!link.coachUserId) continue
      contacts.push({
        linkId: link.id,
        relationship: 'coach',
        profileId: link.coachUserId,
        name: 'Coach',
        identitySlug: link.identitySlug,
        levelLabel: link.levelLabel,
        status: link.status,
      })
    }
  }

  return normalizeCoachMessageContacts(contacts)
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<MessagesLoadingShell />}>
      <MessagesPageContent />
    </Suspense>
  )
}

function MessagesPageContent() {
  const searchParams = useSearchParams()
  const prefill = useMemo<MessagePrefill>(() => ({
    mode: searchParams.get('compose') === 'support' ? 'support' : 'direct',
    recipient: searchParams.get('recipient') || '',
    recipientProfileId: searchParams.get('recipientProfileId') || '',
    recipientPlayerId: searchParams.get('recipientPlayerId') || '',
    subject: searchParams.get('subject') || '',
    body: searchParams.get('body') || '',
    category: normalizeSupportFilter(searchParams.get('category')),
    entityType: searchParams.get('entityType') || '',
    entityId: searchParams.get('entityId') || '',
    assignmentId: searchParams.get('assignmentId') || '',
    assignmentTitle: searchParams.get('assignmentTitle') || '',
    assignmentFocus: searchParams.get('assignmentFocus') || '',
    threadId: searchParams.get('thread') || '',
  }), [searchParams])

  return (
    <SiteShell active="/messages">
      <MessagesWorkspace prefill={prefill} />
    </SiteShell>
  )
}

function MessagesLoadingShell() {
  return (
    <SiteShell active="/messages">
      <section style={pageStyle}>
        <div style={panelStyle}>
          <h1 style={titleStyle}>Loading your TenAceIQ inbox...</h1>
        </div>
      </section>
    </SiteShell>
  )
}

function MessagesWorkspace({ prefill }: { prefill: MessagePrefill }) {
  const { userId, authResolved, session } = useAuth()
  const { isTablet, isMobile } = useViewportBreakpoints()
  const [identity, setIdentity] = useState<InternalIdentity | null>(null)
  const [conversations, setConversations] = useState<InternalConversation[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [messages, setMessages] = useState<InternalMessage[]>([])
  const [scheduleEvents, setScheduleEvents] = useState<InternalScheduleEvent[]>([])
  const [scheduleResponses, setScheduleResponses] = useState<InternalScheduleResponse[]>([])
  const [notifications, setNotifications] = useState<InternalNotification[]>([])
  const [notificationPreferences, setNotificationPreferences] = useState<InternalNotificationPreferences | null>(null)
  const [coachContacts, setCoachContacts] = useState<CoachMessageContact[]>([])
  const [composeMode, setComposeMode] = useState<ComposeMode>(prefill.mode)
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>('all')
  const [alertFilter, setAlertFilter] = useState<AlertFilter>('all')
  const [threadSearch, setThreadSearch] = useState('')
  const [supportCategory, setSupportCategory] = useState<SupportFilter>(prefill.category)
  const [supportFilter, setSupportFilter] = useState<SupportFilter>('all')
  const [recipientInput, setRecipientInput] = useState('')
  const [recipient, setRecipient] = useState<InternalRecipient | null>(null)
  const [recipientSearchResults, setRecipientSearchResults] = useState<InternalRecipient[]>([])
  const [recipientSearchRan, setRecipientSearchRan] = useState(false)
  const [recipientSearching, setRecipientSearching] = useState(false)
  const [composeContext, setComposeContext] = useState<{ entityType: string; entityId: string }>({
    entityType: prefill.entityType,
    entityId: prefill.entityId,
  })
  const [displayNameDraft, setDisplayNameDraft] = useState('')
  const [identitySaving, setIdentitySaving] = useState(false)
  const [subject, setSubject] = useState(prefill.subject || (prefill.mode === 'support' ? 'Support request' : ''))
  const [body, setBody] = useState('')
  const [replyBody, setReplyBody] = useState('')
  const [draftThreadIds, setDraftThreadIds] = useState<Set<string>>(() => new Set())
  const [pinnedThreadIds, setPinnedThreadIds] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(true)
  const [threadLoading, setThreadLoading] = useState(false)
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [responseSaving, setResponseSaving] = useState('')
  const [preferenceSaving, setPreferenceSaving] = useState('')
  const [conversationActionSaving, setConversationActionSaving] = useState('')
  const [scheduleActionSaving, setScheduleActionSaving] = useState('')
  const [calendarQuickAddSaving, setCalendarQuickAddSaving] = useState('')
  const [scheduleEditOpen, setScheduleEditOpen] = useState(false)
  const [scheduleDraftDate, setScheduleDraftDate] = useState('')
  const [scheduleDraftTime, setScheduleDraftTime] = useState('')
  const [scheduleDraftFacility, setScheduleDraftFacility] = useState('')
  const [scheduleDraftNotes, setScheduleDraftNotes] = useState('')
  const [scheduleCancelReason, setScheduleCancelReason] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) ?? null,
    [conversations, selectedId],
  )
  const selectedScheduleEvent = scheduleEvents[0] ?? null
  const canManageSchedule = Boolean(
    identity &&
      selectedScheduleEvent &&
      (identity.role === 'admin' || selectedScheduleEvent.createdByUserId === identity.userId),
  )
  const selectedContextHref = useMemo(
    () => buildConversationContextHref(selectedConversation, coachContacts),
    [coachContacts, selectedConversation],
  )
  const selectedContextPresentation = useMemo(
    () => buildConversationContextPresentation(selectedConversation, coachContacts),
    [coachContacts, selectedConversation],
  )
  const quickReplyActions = useMemo(
    () => getQuickReplyActions(selectedConversation, identity?.role ?? 'public'),
    [identity?.role, selectedConversation],
  )
  const replyCalendarCandidate = useMemo(() => {
    const fallbackTitle = selectedConversation?.subject || 'Message calendar item'
    const draftCandidate = detectCalendarQuickAddCandidate(replyBody, fallbackTitle, 'reply draft')
    if (draftCandidate) return draftCandidate

    const latestIncoming = [...messages].reverse().find((item) => item.senderUserId !== identity?.userId)
    return latestIncoming ? detectCalendarQuickAddCandidate(latestIncoming.body, fallbackTitle, 'latest message') : null
  }, [identity?.userId, messages, replyBody, selectedConversation?.subject])
  const composeCalendarCandidate = useMemo(
    () => detectCalendarQuickAddCandidate(body, subject || 'Message calendar item', 'new message'),
    [body, subject],
  )
  const unreadNotificationCount = useMemo(
    () => notifications.filter((notification) => !notification.readAt).length,
    [notifications],
  )
  const alertFilters = useMemo(
    () => (['all', 'unread', 'support', 'schedule', 'message', 'system'] as AlertFilter[]).map((filter) => ({
      key: filter,
      label: alertFilterLabel(filter),
      count: notifications.filter((notification) => notificationMatchesAlertFilter(notification, filter)).length,
    })),
    [notifications],
  )
  const filteredNotifications = useMemo(
    () => notifications.filter((notification) => notificationMatchesAlertFilter(notification, alertFilter)),
    [alertFilter, notifications],
  )
  const inboxFilters = useMemo(() => {
    if (!identity) return [] as Array<{ key: InboxFilter; label: string; count: number }>
    return (['all', 'pinned', 'needs_reply', 'unread', 'support', 'direct', 'league', 'schedule'] as InboxFilter[]).map((filter) => ({
      key: filter,
      label: inboxFilterLabel(filter),
      count: conversations.filter((conversation) =>
        filter === 'pinned'
          ? pinnedThreadIds.has(conversation.id)
          : conversationMatchesInboxFilter(conversation, identity, filter),
      ).length,
    }))
  }, [conversations, identity, pinnedThreadIds])
  const filteredConversations = useMemo(() => {
    if (!identity) return conversations
    return conversations.filter((conversation) => {
      const matchesInbox = inboxFilter === 'pinned'
        ? pinnedThreadIds.has(conversation.id)
        : conversationMatchesInboxFilter(conversation, identity, inboxFilter)
      const matchesSearch = conversationMatchesThreadSearch(conversation, identity, threadSearch)
      const matchesSupportCategory = identity.role !== 'admin' || supportFilter === 'all'
        ? true
        : conversation.conversationType === 'support' && conversation.relatedEntityType === supportFilter
      return matchesInbox && matchesSearch && matchesSupportCategory
    }).sort((left, right) => {
      const leftPinned = pinnedThreadIds.has(left.id) ? 1 : 0
      const rightPinned = pinnedThreadIds.has(right.id) ? 1 : 0
      if (leftPinned !== rightPinned) return rightPinned - leftPinned
      return new Date(right.updatedAt || right.lastMessageAt || right.createdAt).getTime() -
        new Date(left.updatedAt || left.lastMessageAt || left.createdAt).getTime()
    })
  }, [conversations, identity, inboxFilter, pinnedThreadIds, supportFilter, threadSearch])
  const unreadCount = useMemo(
    () => conversations.filter((conversation) => conversation.isUnread).length,
    [conversations],
  )
  const needsReplyCount = useMemo(
    () => identity ? conversations.filter((conversation) => conversationNeedsReply(conversation, identity)).length : 0,
    [conversations, identity],
  )
  const pinnedCount = pinnedThreadIds.size
  const hasActiveThreadFilters = Boolean(threadSearch.trim()) || inboxFilter !== 'all' || (identity?.role === 'admin' && supportFilter !== 'all')
  const emptyInboxCopy = identity?.role === 'admin'
    ? 'Support requests, user replies, league rooms, and scheduling alerts will land here.'
    : identity?.role === 'captain'
      ? 'Lineup notes, player replies, league messages, and schedule alerts will land here.'
      : 'Coach notes, support replies, schedule updates, and player messages will land here.'
  const filteredEmptyCopy = conversations.length && hasActiveThreadFilters
    ? threadSearch.trim()
      ? 'Try a different search or clear filters to see the rest of your inbox.'
      : 'Clear filters to see the rest of your inbox.'
    : emptyInboxCopy
  const composeTargetLabel = composeMode === 'support'
    ? `${supportCategoryLabel(supportCategory)} support`
    : recipient
      ? recipient.displayName
      : recipientInput.trim()
        ? 'Find and select a player'
        : 'Choose a player'
  const composeReadinessLabel = composeMode === 'support'
    ? body.trim()
      ? 'Ready to open'
      : 'Add the support detail'
    : recipient
      ? body.trim()
        ? 'Ready to send'
        : 'Add the message'
      : 'Select a recipient'
  const canSubmitNewConversation = Boolean(body.trim()) && (composeMode === 'support' || Boolean(recipient))
  const dataAssistMessagesHref = '/data-assist?intent=upload-source&context=Messages'
  const emptyInboxActions = [
    { title: 'Open My Lab', href: '/mylab' },
    { title: 'Improve data', href: dataAssistMessagesHref },
    { title: 'Prep matchup', href: '/matchup' },
  ] as const

  useEffect(() => {
    setComposeMode(prefill.mode)
    setSupportCategory(prefill.category)
    setRecipientInput(prefill.recipient)
    setSubject(prefill.subject || (prefill.mode === 'support' ? 'Support request' : ''))
    setBody(prefill.body)
    setRecipient(null)
    setRecipientSearchResults([])
    setComposeContext({ entityType: prefill.entityType, entityId: prefill.entityId })
  }, [prefill])

  useEffect(() => {
    if (!identity || composeMode !== 'direct') return
    if (!prefill.recipientProfileId && !prefill.recipientPlayerId) return

    let active = true
    setRecipientSearching(true)
    resolveInternalRecipient({
      profileId: prefill.recipientProfileId,
      playerId: prefill.recipientPlayerId,
      nameOrId: prefill.recipient,
    })
      .then((found) => {
        if (!active) return
        if (found && found.id !== identity.userId) {
          setRecipient(found)
          setRecipientInput(found.displayName)
          setMessage(`Ready to message ${found.displayName}.`)
          setError('')
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Recipient could not be resolved.')
      })
      .finally(() => {
        if (active) setRecipientSearching(false)
      })

    return () => {
      active = false
    }
  }, [composeMode, identity, prefill.recipient, prefill.recipientPlayerId, prefill.recipientProfileId])

  const loadInbox = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const nextIdentity = await getInternalIdentity()
      setIdentity(nextIdentity)
      setDisplayNameDraft(nextIdentity?.displayName ?? '')
      if (!nextIdentity) {
        setConversations([])
        setSelectedId('')
        setNotificationPreferences(null)
        setCoachContacts([])
        return
      }

      const nextConversations = await listInternalConversations(nextIdentity)
      setConversations(nextConversations)
      fetchCoachMessageContacts()
        .then(setCoachContacts)
        .catch(() => setCoachContacts([]))
      getInternalNotificationPreferences(nextIdentity.userId)
        .then(setNotificationPreferences)
        .catch(() => setNotificationPreferences(null))
      setNotificationsLoading(true)
      listInternalNotifications(nextIdentity.userId, { limit: 12 })
        .then(setNotifications)
        .catch(() => setNotifications([]))
        .finally(() => setNotificationsLoading(false))
      setSelectedId((current) =>
        prefill.threadId && nextConversations.some((conversation) => conversation.id === prefill.threadId)
          ? prefill.threadId
          : current || nextConversations[0]?.id || '',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Messages could not load yet.')
    } finally {
      setLoading(false)
    }
  }, [prefill.threadId])

  useEffect(() => {
    if (!authResolved) return
    void loadInbox()
  }, [authResolved, loadInbox])

  useEffect(() => {
    if (identity?.role === 'admin' && inboxFilter === 'all' && needsReplyCount > 0) {
      setInboxFilter('needs_reply')
    }
  }, [identity?.role, inboxFilter, needsReplyCount])

  useEffect(() => {
    if (!identity?.userId) {
      setPinnedThreadIds(new Set())
      return
    }
    setPinnedThreadIds(readPinnedThreadIds(identity.userId))
  }, [identity?.userId])

  useEffect(() => {
    if (!identity?.userId) return
    const conversationIds = new Set(conversations.map((conversation) => conversation.id))
    setPinnedThreadIds((current) => {
      const next = new Set(Array.from(current).filter((id) => conversationIds.has(id)))
      if (next.size !== current.size) writePinnedThreadIds(identity.userId, next)
      return next
    })
  }, [conversations, identity?.userId])

  useEffect(() => {
    setDraftThreadIds(getConversationDraftIds(conversations))
  }, [conversations])

  useEffect(() => {
    setReplyBody(selectedConversation ? readMessageDraft(selectedConversation.id) : '')
  }, [selectedConversation])

  useEffect(() => {
    if (!selectedId) {
      setMessages([])
      setScheduleEvents([])
      setScheduleResponses([])
      setScheduleEditOpen(false)
      return
    }

    let active = true
    setThreadLoading(true)
    setScheduleLoading(true)
    listInternalMessages(selectedId)
      .then((nextMessages) => {
        if (active) setMessages(nextMessages)
        if (identity?.userId) {
          void markInternalConversationRead(selectedId, identity.userId)
          setConversations((current) =>
            current.map((conversation) =>
              conversation.id === selectedId
                ? { ...conversation, isUnread: false, lastReadAt: new Date().toISOString() }
                : conversation,
            ),
          )
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Thread could not load.')
      })
      .finally(() => {
        if (active) setThreadLoading(false)
      })

    listInternalScheduleEventsForConversation(selectedId)
      .then(async (events) => {
        const responses = await listInternalScheduleResponses(events.map((event) => event.id))
        if (!active) return
        setScheduleEvents(events)
        setScheduleResponses(responses)
      })
      .catch(() => {
        if (!active) {
          return
        }
        setScheduleEvents([])
        setScheduleResponses([])
      })
      .finally(() => {
        if (active) setScheduleLoading(false)
      })

    return () => {
      active = false
    }
  }, [identity?.userId, selectedId])

  useEffect(() => {
    if (!selectedScheduleEvent) {
      setScheduleEditOpen(false)
      setScheduleDraftDate('')
      setScheduleDraftTime('')
      setScheduleDraftFacility('')
      setScheduleDraftNotes('')
      setScheduleCancelReason('')
      return
    }

    setScheduleDraftDate(selectedScheduleEvent.scheduledDate)
    setScheduleDraftTime(selectedScheduleEvent.scheduledTime)
    setScheduleDraftFacility(selectedScheduleEvent.facility)
    setScheduleDraftNotes('')
    setScheduleCancelReason('')
  }, [selectedScheduleEvent])

  async function resolveRecipient() {
    setRecipient(null)
    setError('')
    const found = await resolveInternalRecipient({
      profileId: prefill.recipientProfileId,
      playerId: prefill.recipientPlayerId,
      nameOrId: recipientInput,
    })
    if (!found) {
      setError('No TenAceIQ user was found for that name or ID.')
      return null
    }

    setRecipient(found)
    setRecipientSearchRan(false)
    setMessage(`Ready to message ${found.displayName}.`)
    return found
  }

  async function chooseCoachContact(contact: CoachMessageContact) {
    if (!identity) return

    setComposeMode('direct')
    setSupportCategory('general')
    clearSelectedConversation()
    setError('')
    setMessage('')
    setRecipientSearching(true)
    try {
      const found = await resolveInternalRecipient({
        profileId: contact.profileId,
        nameOrId: contact.name,
      })
      if (!found || found.id === identity.userId) {
        setError('This linked contact is not ready for direct Messages yet.')
        return
      }
      const isStudent = contact.relationship === 'student'
      const nextSubject = isStudent
        ? `${contact.name} development check-in`
        : 'Player+ coach check-in'
      const nextBody = isStudent
        ? `Quick coach note for ${contact.name}: `
        : 'Quick player note: '

      setRecipient(found)
      setRecipientInput(found.displayName)
      setRecipientSearchRan(false)
      setSubject(nextSubject)
      setBody(nextBody)
      setComposeContext({ entityType: 'coach_player_link', entityId: contact.linkId })
      setMessage(`Ready to message ${found.displayName}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Linked contact could not be opened.')
    } finally {
      setRecipientSearching(false)
    }
  }

  async function searchRecipients() {
    if (!identity) return
    const query = recipientInput.trim()
    setRecipient(null)
    setRecipientSearchResults([])
    setRecipientSearchRan(false)
    setError('')
    setMessage('')
    if (query.length < 2) {
      setError('Type at least two characters to search.')
      return
    }

    setRecipientSearching(true)
    try {
      const results = await searchInternalRecipients(query, identity.userId)
      setRecipientSearchResults(results)
      setRecipientSearchRan(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recipient search could not run.')
    } finally {
      setRecipientSearching(false)
    }
  }

  function selectConversation(conversationId: string) {
    setSelectedId(conversationId)
    replaceThreadUrl(conversationId)
  }

  function clearSelectedConversation() {
    setSelectedId('')
    replaceThreadUrl('')
  }

  function clearThreadFilters() {
    setInboxFilter('all')
    setSupportFilter('all')
    setThreadSearch('')
  }

  async function saveDisplayName() {
    if (!identity || identitySaving) return

    setIdentitySaving(true)
    setError('')
    setMessage('')
    try {
      const nextName = await saveInternalDisplayName(identity.userId, displayNameDraft)
      setIdentity({ ...identity, displayName: nextName })
      setMessage('Messaging name saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Messaging name could not be saved.')
    } finally {
      setIdentitySaving(false)
    }
  }

  async function submitNewConversation() {
    if (!identity || saving) return

    setSaving(true)
    setError('')
    setMessage('')
    try {
      let conversationId = ''
      if (composeMode === 'support') {
        conversationId = await createSupportConversation(identity, subject, body, {
          category: supportCategory,
          entityType: prefill.entityType,
          entityId: prefill.entityId,
        })
      } else {
        const nextRecipient = recipient ?? (await resolveRecipient())
        if (!nextRecipient) return
        conversationId = await createDirectConversation(identity, nextRecipient, subject, body, {
          entityType: composeContext.entityType,
          entityId: composeContext.entityId,
          metadata: {
            assignmentId: prefill.assignmentId,
            assignmentTitle: prefill.assignmentTitle,
            assignmentFocus: prefill.assignmentFocus,
          },
        })
      }

      setBody('')
      setSubject(composeMode === 'support' ? 'Support request' : '')
      setRecipient(null)
      setRecipientInput('')
      setRecipientSearchRan(false)
      setComposeContext({ entityType: '', entityId: '' })
      selectConversation(conversationId)
      await loadInbox()
      selectConversation(conversationId)
      setMessage(composeMode === 'support' ? 'Support thread opened.' : 'Conversation started.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Message could not be sent.')
    } finally {
      setSaving(false)
    }
  }

  async function submitReply() {
    if (!identity || !selectedConversation || saving) return

    setSaving(true)
    setError('')
    setMessage('')
    try {
      await sendInternalMessage(selectedConversation.id, identity.userId, replyBody, {
        senderRole: identity.role,
      })
      removeMessageDraft(selectedConversation.id)
      setDraftThreadIds((current) => {
        const next = new Set(current)
        next.delete(selectedConversation.id)
        return next
      })
      setReplyBody('')
      setMessages(await listInternalMessages(selectedConversation.id))
      setConversations(await listInternalConversations(identity))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reply could not be sent.')
    } finally {
      setSaving(false)
    }
  }

  async function addMessageCandidateToCalendar(candidate: CalendarQuickAddCandidate, sourceId: string) {
    if (!session?.access_token) {
      setError('Sign in with a player account to save this to My Calendar.')
      return
    }

    setCalendarQuickAddSaving(sourceId)
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/player/calendar-items', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          item: {
            title: candidate.title,
            date: candidate.date,
            time: candidate.time,
            location: candidate.location,
            kind: 'reminder',
          },
        }),
      })
      const json = (await response.json()) as { ok?: boolean; message?: string }
      if (!response.ok || !json.ok) {
        throw new Error(json.message || 'Could not add this to My Calendar.')
      }
      setMessage('Added to My Calendar.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add this to My Calendar.')
    } finally {
      setCalendarQuickAddSaving('')
    }
  }

  async function addScheduleEventToCalendar(event: InternalScheduleEvent) {
    if (!session?.access_token) {
      setError('Sign in with a player account to save this to My Calendar.')
      return
    }
    if (!event.scheduledDate) {
      setError('This schedule thread needs a date before it can be added to My Calendar.')
      return
    }

    setCalendarQuickAddSaving(event.id)
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/player/calendar-items', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          item: {
            id: `message-schedule-${event.id}`,
            title: event.title || selectedConversation?.subject || 'Scheduled tennis session',
            date: event.scheduledDate,
            time: event.scheduledTime,
            location: event.facility,
            kind: event.eventType === 'tiq_league_match' ? 'match' : 'practice',
            recurrenceRule: event.recurrenceRule,
          },
        }),
      })
      const json = (await response.json()) as { ok?: boolean; message?: string }
      if (!response.ok || !json.ok) {
        throw new Error(json.message || 'Could not add this schedule to My Calendar.')
      }
      setMessage('Schedule added to My Calendar.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add this schedule to My Calendar.')
    } finally {
      setCalendarQuickAddSaving('')
    }
  }

  function updateReplyDraft(value: string) {
    setReplyBody(value)
    if (!selectedConversation) return
    writeMessageDraft(selectedConversation.id, value)
    setDraftThreadIds((current) => {
      const next = new Set(current)
      if (value.trim()) {
        next.add(selectedConversation.id)
      } else {
        next.delete(selectedConversation.id)
      }
      return next
    })
  }

  function insertQuickReply(text: string) {
    const nextBody = replyBody.trim()
      ? `${replyBody.trim()}\n\n${text}`
      : text
    updateReplyDraft(nextBody)
  }

  function handleReplyKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && replyBody.trim() && !saving) {
      event.preventDefault()
      void submitReply()
    }
  }

  async function submitScheduleResponse(eventId: string, responseStatus: InternalScheduleResponseStatus) {
    if (!identity || !selectedConversation || responseSaving) return

    setResponseSaving(eventId)
    setError('')
    setMessage('')
    try {
      await saveInternalScheduleResponse({
        eventId,
        profileId: identity.userId,
        responseStatus,
        conversationId: selectedConversation.id,
      })
      setScheduleResponses(await listInternalScheduleResponses(scheduleEvents.map((event) => event.id)))
      setMessages(await listInternalMessages(selectedConversation.id))
      setConversations(await listInternalConversations(identity))
      setMessage(`RSVP saved as ${responseStatus === 'in' ? 'In' : responseStatus === 'out' ? 'Out' : responseStatus === 'maybe' ? 'Maybe' : 'Unanswered'}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'RSVP could not be saved.')
    } finally {
      setResponseSaving('')
    }
  }

  async function openNotification(notification: InternalNotification) {
    if (!identity) return
    setError('')
    try {
      if (!notification.readAt) {
        await markInternalNotificationRead(notification.id, identity.userId)
        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item,
          ),
        )
      }
      if (notification.conversationId) {
        selectConversation(notification.conversationId)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Alert could not be opened.')
    }
  }

  async function markAlertsRead() {
    if (!identity) return
    setError('')
    try {
      await markAllInternalNotificationsRead(identity.userId)
      const readAt = new Date().toISOString()
      setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt || readAt })))
      setMessage('Alerts marked read.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Alerts could not be updated.')
    }
  }

  async function markSelectedThreadRead() {
    if (!identity || !selectedConversation) return
    setError('')
    try {
      const read = await markInternalConversationRead(selectedConversation.id, identity.userId)
      if (!read) throw new Error('Thread read state could not be updated.')
      const readAt = new Date().toISOString()
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === selectedConversation.id
            ? { ...conversation, isUnread: false, lastReadAt: readAt }
            : conversation,
        ),
      )
      setMessage('Thread marked read.')
    } catch {
      setError('Thread read state could not be updated.')
    }
  }

  async function copySelectedThreadLink() {
    if (!selectedConversation) return
    setError('')
    const href = buildThreadShareUrl(selectedConversation.id)
    try {
      await navigator.clipboard.writeText(href)
      replaceThreadUrl(selectedConversation.id)
      setMessage('Thread link copied.')
    } catch {
      replaceThreadUrl(selectedConversation.id)
      setMessage('Thread link is ready in the address bar.')
    }
  }

  function toggleSelectedThreadPinned() {
    if (!identity || !selectedConversation) return
    setError('')
    setPinnedThreadIds((current) => {
      const next = new Set(current)
      if (next.has(selectedConversation.id)) {
        next.delete(selectedConversation.id)
        setMessage('Thread unpinned.')
      } else {
        next.add(selectedConversation.id)
        setMessage('Thread pinned.')
      }
      writePinnedThreadIds(identity.userId, next)
      return next
    })
  }

  async function updateNotificationPreference(
    key: keyof InternalNotificationPreferencePatch,
    value: boolean,
  ) {
    if (!identity || preferenceSaving) return

    setPreferenceSaving(key)
    setError('')
    setMessage('')
    try {
      const nextPreferences = await saveInternalNotificationPreferences(identity.userId, { [key]: value })
      setNotificationPreferences(nextPreferences)
      setMessage('Notification preference saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Notification preference could not be saved.')
    } finally {
      setPreferenceSaving('')
    }
  }

  async function runSupportAction(action: string, status?: InternalConversationStatus, assignToMe = false) {
    if (!identity || !selectedConversation || conversationActionSaving) return

    setConversationActionSaving(action)
    setError('')
    setMessage('')
    try {
      await updateInternalConversationOps({
        conversationId: selectedConversation.id,
        identity,
        status,
        assignToMe,
      })
      setMessages(await listInternalMessages(selectedConversation.id))
      setConversations(await listInternalConversations(identity))
      setMessage('Support thread updated.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Support thread could not be updated.')
    } finally {
      setConversationActionSaving('')
    }
  }

  async function submitScheduleUpdate() {
    if (!identity || !selectedScheduleEvent || scheduleActionSaving) return

    setScheduleActionSaving('update')
    setError('')
    setMessage('')
    try {
      await updateInternalScheduleEvent({
        eventId: selectedScheduleEvent.id,
        actorUserId: identity.userId,
        scheduledDate: scheduleDraftDate,
        scheduledTime: scheduleDraftTime,
        facility: scheduleDraftFacility,
        notes: scheduleDraftNotes,
      })
      setScheduleEvents(await listInternalScheduleEventsForConversation(selectedScheduleEvent.conversationId))
      setMessages(await listInternalMessages(selectedScheduleEvent.conversationId))
      setConversations(await listInternalConversations(identity))
      setScheduleEditOpen(false)
      setMessage('Schedule updated.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Schedule could not be updated.')
    } finally {
      setScheduleActionSaving('')
    }
  }

  async function cancelSchedule() {
    if (!identity || !selectedScheduleEvent || scheduleActionSaving) return

    setScheduleActionSaving('cancel')
    setError('')
    setMessage('')
    try {
      await cancelInternalScheduleEvent({
        eventId: selectedScheduleEvent.id,
        actorUserId: identity.userId,
        reason: scheduleCancelReason,
      })
      setScheduleEvents(await listInternalScheduleEventsForConversation(selectedScheduleEvent.conversationId))
      setMessages(await listInternalMessages(selectedScheduleEvent.conversationId))
      setConversations(await listInternalConversations(identity))
      setScheduleEditOpen(false)
      setMessage('Schedule cancelled.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Schedule could not be cancelled.')
    } finally {
      setScheduleActionSaving('')
    }
  }

  const showConversationOnMobile = isMobile && Boolean(selectedConversation)
  const inboxPanelStyle = {
    ...panelStyle,
    ...(showConversationOnMobile ? hiddenPanelStyle : {}),
  }
  const threadPanelStyle = {
    ...panelStyle,
    ...(isMobile && !selectedConversation ? hiddenPanelStyle : {}),
  }
  const sidePanelStyle = {
    ...panelStyle,
    ...(showConversationOnMobile ? hiddenPanelStyle : {}),
  }
  const showCalendarFollowThrough = message.includes('My Calendar')

  if (!authResolved || loading) {
    return (
      <section style={pageStyle}>
        <div style={panelStyle}>
          <span aria-hidden="true" style={watermarkStyle} />
          <div className="section-kicker">Messages</div>
          <h1 style={titleStyle}>Loading your TenAceIQ inbox...</h1>
        </div>
      </section>
    )
  }

  if (!userId || !identity) {
    return (
      <section style={pageStyle}>
        <div style={panelStyle}>
          <span aria-hidden="true" style={watermarkStyle} />
          <h1 style={titleStyle}>Sign in to message players or support.</h1>
          <p style={copyStyle}>
            TenAceIQ Messages keeps account, league, and player conversations inside the platform.
          </p>
          <Link href="/login" style={primaryButtonStyle}>Sign in</Link>
        </div>
      </section>
    )
  }

  return (
    <section style={pageStyle}>
      <PlayerSuitePanel active="messages" playerLabel="Inbox" />
      {showCalendarFollowThrough ? (
        <div style={calendarFollowThroughStyle}>
          <span>{message}</span>
          <Link href="/mylab#my-calendar" style={ghostButtonStyle}>
            View My Calendar
          </Link>
        </div>
      ) : null}
      {coachContacts.length ? (
        <section style={coachContactsPanelStyle}>
          <div>
            <div className="section-kicker">Coach-player links</div>
            <h2 style={coachContactsTitleStyle}>Start with the people tied to the work.</h2>
            <p style={coachContactsCopyStyle}>
              Use these links for assignment follow-up, stat notes, lesson goals, and quick Player+ check-ins.
            </p>
          </div>
          <div style={coachContactsGridStyle}>
            {coachContacts.slice(0, 4).map((contact) => (
              <button
                key={`${contact.relationship}-${contact.linkId}`}
                type="button"
                onClick={() => void chooseCoachContact(contact)}
                style={coachContactButtonStyle}
              >
                <span style={coachContactLabelStyle}>
                  {contact.relationship === 'student' ? 'Student' : 'Coach'}
                </span>
                <strong>{contact.name}</strong>
                <small>{contact.levelLabel || 'Development path'}</small>
              </button>
            ))}
          </div>
        </section>
      ) : null}
      <section style={workspaceGridStyle(isTablet)}>
        <aside style={inboxPanelStyle}>
          <span aria-hidden="true" style={watermarkStyle} />
          <div style={sectionHeaderStyle}>
            <div>
              <div className="section-kicker">Inbox</div>
              <h2 style={sectionTitleStyle}>{identity.role === 'admin' ? 'Platform threads' : 'Your threads'}</h2>
            </div>
            <button type="button" onClick={() => void loadInbox()} style={ghostButtonStyle}>
              Refresh
            </button>
          </div>
          <div style={triageSummaryStyle}>
            <span>{needsReplyCount ? `${needsReplyCount} need reply` : 'No replies waiting'}</span>
            <span>{unreadCount ? `${unreadCount} unread` : 'Inbox read'}</span>
            {pinnedCount ? <span>{pinnedCount} pinned</span> : null}
            {hasActiveThreadFilters ? <span>{filteredConversations.length} shown</span> : null}
          </div>
          <label style={fieldStyle}>
            <span style={labelStyle}>Search threads</span>
            <div style={lookupRowStyle(isMobile)}>
              <input
                value={threadSearch}
                onChange={(event) => setThreadSearch(event.target.value)}
                placeholder="Subject, message, status, league..."
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => setThreadSearch('')}
                disabled={!threadSearch.trim()}
                style={ghostButtonStyle}
              >
                Clear search
              </button>
            </div>
          </label>
          <div style={filterBarStyle}>
            {inboxFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setInboxFilter(filter.key)}
                style={filterButtonStyle(inboxFilter === filter.key)}
              >
                {filter.label}{filter.count ? ` (${filter.count})` : ''}
              </button>
            ))}
          </div>
          {identity.role === 'admin' ? (
            <div style={filterBarStyle}>
              {(['all', 'billing', 'league', 'result', 'data', 'account', 'general'] as SupportFilter[]).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setSupportFilter(filter)}
                  style={filterButtonStyle(supportFilter === filter)}
                >
                  {filter === 'all' ? `All ${unreadCount ? `(${unreadCount})` : ''}` : supportCategoryLabel(filter)}
                </button>
              ))}
            </div>
          ) : null}

          {filteredConversations.length ? (
            <div style={threadListStyle}>
              {filteredConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => selectConversation(conversation.id)}
                  aria-pressed={selectedId === conversation.id}
                  style={threadButtonStyle(selectedId === conversation.id, conversation.isUnread)}
                >
                  <span style={threadTopStyle}>
                    <strong>{conversation.subject}</strong>
                    <span style={threadBadgeRowStyle}>
                      {pinnedThreadIds.has(conversation.id) ? <small style={pinnedPillStyle}>Pinned</small> : null}
                      {conversationNeedsReply(conversation, identity) ? <small style={needsReplyPillStyle}>Needs reply</small> : null}
                      {conversation.isUnread ? <small style={unreadPillStyle}>New</small> : null}
                      {draftThreadIds.has(conversation.id) ? <small style={draftPillStyle}>Draft</small> : null}
                    </span>
                  </span>
                  <span style={threadBadgeRowStyle}>
                    <small style={threadTypePillStyle}>
                      {conversation.conversationType === 'support'
                        ? supportCategoryLabel(conversation.relatedEntityType)
                        : conversationTypeLabel(conversation.conversationType)}
                    </small>
                    {isScheduleConversation(conversation) ? <small style={threadTypePillStyle}>Schedule</small> : null}
                    <small style={statusPillStyle(conversation.status)}>{statusLabel(conversation.status)}</small>
                  </span>
                  <span style={threadPreviewStyle}>
                    {conversation.lastMessageSenderUserId === identity.userId ? 'You: ' : conversation.isUnread ? 'New: ' : ''}
                    {conversation.lastMessageBody || statusLabel(conversation.status)}
                  </span>
                  <span style={threadMetaStyle}>
                    {statusLabel(conversation.status)} · {formatMessageTime(conversation.lastMessageAt)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div style={emptyInboxStyle}>
              <strong>{conversations.length && hasActiveThreadFilters ? 'No threads match these filters.' : 'Inbox starts when tennis needs a reply.'}</strong>
              <p style={copyStyle}>{filteredEmptyCopy}</p>
              <div style={emptyInboxActionRowStyle}>
                {conversations.length && hasActiveThreadFilters ? (
                  <button type="button" onClick={clearThreadFilters} style={ghostButtonStyle}>
                    Clear filters
                  </button>
                ) : null}
                {emptyInboxActions.map((action) => (
                  <Link key={action.href} href={action.href} style={emptyInboxActionStyle}>
                    {action.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>

        <section style={threadPanelStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <div className="section-kicker">Thread</div>
              <h2 style={sectionTitleStyle}>{selectedConversation?.subject || 'Select a conversation'}</h2>
            </div>
            <div style={threadHeaderActionStyle}>
              {isMobile && selectedConversation ? (
                <button type="button" onClick={clearSelectedConversation} style={ghostButtonStyle}>
                  Back to inbox
                </button>
              ) : null}
              {selectedConversation?.isUnread ? (
                <button type="button" onClick={() => void markSelectedThreadRead()} style={ghostButtonStyle}>
                  Mark read
                </button>
              ) : null}
              {selectedConversation ? (
                <button type="button" onClick={() => void copySelectedThreadLink()} style={ghostButtonStyle}>
                  Copy link
                </button>
              ) : null}
              {selectedConversation ? (
                <button type="button" onClick={toggleSelectedThreadPinned} style={ghostButtonStyle}>
                  {pinnedThreadIds.has(selectedConversation.id) ? 'Unpin' : 'Pin'}
                </button>
              ) : null}
              {selectedConversation ? <span style={statusPillStyle(selectedConversation.status)}>{statusLabel(selectedConversation.status)}</span> : null}
            </div>
          </div>

          {selectedConversation && (selectedConversation.conversationType === 'support' || selectedConversation.conversationType === 'league' || selectedContextHref) ? (
            <div style={contextPanelStyle}>
              <div>
                <div style={labelStyle}>{selectedContextPresentation.label}</div>
                <p style={copyStyle}>{selectedContextPresentation.text}</p>
                {selectedConversation.conversationType === 'support' ? (
                  <p style={supportStatusLineStyle}>{supportStatusCopy(selectedConversation, identity.role)}</p>
                ) : null}
              </div>
              {selectedContextHref ? (
                <Link href={selectedContextHref} style={ghostButtonStyle}>{selectedContextPresentation.cta}</Link>
              ) : null}
            </div>
          ) : null}

          {identity.role === 'admin' && selectedConversation?.conversationType === 'support' ? (
            <div style={opsPanelStyle}>
              <div>
                <div style={labelStyle}>Support ops</div>
                <p style={copyStyle}>
                  {selectedConversation.assignedAdminUserId === identity.userId
                    ? 'Assigned to you.'
                    : selectedConversation.assignedAdminUserId
                      ? 'Assigned to another admin.'
                      : 'Unassigned support thread.'}
                </p>
              </div>
              <div style={rsvpActionRowStyle}>
                <button
                  type="button"
                  onClick={() => void runSupportAction('assign', undefined, true)}
                  disabled={Boolean(conversationActionSaving)}
                  style={ghostButtonStyle}
                >
                  {conversationActionSaving === 'assign' ? 'Saving' : 'Assign to me'}
                </button>
                <button
                  type="button"
                  onClick={() => void runSupportAction('waiting_on_user', 'waiting_on_user')}
                  disabled={Boolean(conversationActionSaving)}
                  style={ghostButtonStyle}
                >
                  Waiting on user
                </button>
                <button
                  type="button"
                  onClick={() => void runSupportAction('waiting_on_admin', 'waiting_on_admin')}
                  disabled={Boolean(conversationActionSaving)}
                  style={ghostButtonStyle}
                >
                  Waiting on admin
                </button>
                <button
                  type="button"
                  onClick={() => void runSupportAction(selectedConversation.status === 'closed' ? 'open' : 'closed', selectedConversation.status === 'closed' ? 'open' : 'closed')}
                  disabled={Boolean(conversationActionSaving)}
                  style={ghostButtonStyle}
                >
                  {selectedConversation.status === 'closed' ? 'Reopen' : 'Close'}
                </button>
              </div>
            </div>
          ) : null}

          {scheduleLoading ? (
            <div style={schedulePanelStyle}>
              <p style={copyStyle}>Checking schedule details...</p>
            </div>
          ) : scheduleEvents.length ? (
            <div style={schedulePanelStyle}>
              <div style={schedulePanelHeaderStyle}>
                <div>
                  <div style={labelStyle}>Schedule</div>
                  <h3 style={scheduleTitleStyle}>{selectedScheduleEvent?.title}</h3>
                  <p style={copyStyle}>
                    {[
                      selectedScheduleEvent?.scheduledDate,
                      selectedScheduleEvent?.scheduledTime,
                      selectedScheduleEvent?.facility,
                      selectedScheduleEvent?.recurrenceRule ? `Repeats ${selectedScheduleEvent.recurrenceRule}` : '',
                    ].filter(Boolean).join(' | ')}
                  </p>
                </div>
                <div style={schedulePillStackStyle}>
                  <span style={pillStyle}>{selectedScheduleEvent?.eventType === 'tiq_league_match' ? 'League match' : 'Practice'}</span>
                  <span style={selectedScheduleEvent?.status === 'cancelled' ? pillDangerStyle : pillStyle}>
                    {selectedScheduleEvent?.status === 'cancelled' ? 'Cancelled' : selectedScheduleEvent?.status || 'Proposed'}
                  </span>
                  {selectedScheduleEvent ? (
                    <button
                      type="button"
                      onClick={() => void addScheduleEventToCalendar(selectedScheduleEvent)}
                      disabled={selectedScheduleEvent.status === 'cancelled' || calendarQuickAddSaving === selectedScheduleEvent.id}
                      style={ghostButtonStyle}
                    >
                      {calendarQuickAddSaving === selectedScheduleEvent.id ? 'Adding...' : 'Add to My Calendar'}
                    </button>
                  ) : null}
                </div>
              </div>

              <div style={rsvpSummaryStyle(isMobile)}>
                {(['in', 'maybe', 'out', 'unanswered'] as InternalScheduleResponseStatus[]).map((status) => (
                  <div key={status} style={rsvpStatStyle}>
                    <strong>{scheduleResponses.filter((response) => response.responseStatus === status).length}</strong>
                    <span>{status === 'in' ? 'In' : status === 'out' ? 'Out' : status === 'maybe' ? 'Maybe' : 'Waiting'}</span>
                  </div>
                ))}
              </div>

              <div style={rsvpActionRowStyle}>
                {(['in', 'out', 'maybe'] as InternalScheduleResponseStatus[]).map((status) => {
                  const active = scheduleResponses.some(
                    (response) => response.profileId === identity.userId && response.eventId === selectedScheduleEvent?.id && response.responseStatus === status,
                  )
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => selectedScheduleEvent ? void submitScheduleResponse(selectedScheduleEvent.id, status) : undefined}
                      disabled={Boolean(responseSaving) || selectedScheduleEvent?.status === 'cancelled'}
                      style={rsvpButtonStyle(active, status)}
                    >
                      {responseSaving === selectedScheduleEvent?.id ? 'Saving' : status === 'in' ? 'I am in' : status === 'out' ? 'I am out' : 'Maybe'}
                    </button>
                  )
                })}
              </div>

              {selectedScheduleEvent?.status === 'cancelled' ? (
                <p style={warningStyle}>This event is cancelled, so RSVP buttons are paused.</p>
              ) : null}

              {canManageSchedule && selectedScheduleEvent ? (
                <div style={scheduleManagePanelStyle}>
                  <div style={rsvpActionRowStyle}>
                    <button type="button" onClick={() => setScheduleEditOpen((current) => !current)} style={ghostButtonStyle}>
                      {scheduleEditOpen ? 'Hide edit' : 'Edit time/site'}
                    </button>
                  </div>
                  {scheduleEditOpen ? (
                    <div style={scheduleEditGridStyle(isMobile)}>
                      <label style={fieldStyle}>
                        <span style={labelStyle}>Date</span>
                        <input type="date" value={scheduleDraftDate} onChange={(event) => setScheduleDraftDate(event.target.value)} style={inputStyle} />
                      </label>
                      <label style={fieldStyle}>
                        <span style={labelStyle}>Time</span>
                        <input type="time" value={scheduleDraftTime} onChange={(event) => setScheduleDraftTime(event.target.value)} style={inputStyle} />
                      </label>
                      <label style={fieldStyle}>
                        <span style={labelStyle}>Site</span>
                        <input value={scheduleDraftFacility} onChange={(event) => setScheduleDraftFacility(event.target.value)} style={inputStyle} />
                      </label>
                      <label style={fieldStyle}>
                        <span style={labelStyle}>Update note</span>
                        <input value={scheduleDraftNotes} onChange={(event) => setScheduleDraftNotes(event.target.value)} placeholder="Optional note for players" style={inputStyle} />
                      </label>
                      <div style={rsvpActionRowStyle}>
                        <button
                          type="button"
                          onClick={() => void submitScheduleUpdate()}
                          disabled={scheduleActionSaving === 'update' || !scheduleDraftDate}
                          style={primaryButtonStyle}
                        >
                          {scheduleActionSaving === 'update' ? 'Saving...' : 'Save schedule'}
                        </button>
                      </div>
                      {selectedScheduleEvent.status !== 'cancelled' ? (
                        <div style={cancelBoxStyle}>
                          <label style={fieldStyle}>
                            <span style={labelStyle}>Cancel reason</span>
                            <input value={scheduleCancelReason} onChange={(event) => setScheduleCancelReason(event.target.value)} placeholder="Optional" style={inputStyle} />
                          </label>
                          <button
                            type="button"
                            onClick={() => void cancelSchedule()}
                            disabled={scheduleActionSaving === 'cancel'}
                            style={dangerButtonStyle}
                          >
                            {scheduleActionSaving === 'cancel' ? 'Cancelling...' : 'Cancel event'}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <div style={messageListStyle}>
            {threadLoading ? (
              <p style={copyStyle}>Loading thread...</p>
            ) : messages.length ? (
              messages.map((item) => {
                const mine = item.senderUserId === identity.userId
                return (
                  <div key={item.id} style={messageBubbleWrapStyle(mine)}>
                    <div style={messageBubbleStyle(mine)}>
                      <p>{item.body}</p>
                      <span>{mine ? 'You' : 'Them'} · {formatMessageTime(item.createdAt)}</span>
                    </div>
                  </div>
                )
              })
            ) : (
              <div style={emptyThreadStyle}>
                <strong>No thread selected.</strong>
                <p style={copyStyle}>Start a support thread, message a player, or come back from My Lab when a tennis note needs follow-up.</p>
              </div>
            )}
          </div>

          {selectedConversation ? (
            <div style={replyBoxStyle}>
              <div style={replyBoxHeaderStyle}>
                <strong>{selectedConversation.conversationType === 'support' ? 'Support reply' : 'Reply'}</strong>
                <span>{replyBody.trim().length} characters · Ctrl/Cmd Enter to send</span>
              </div>
              <div style={quickReplyRowStyle}>
                {quickReplyActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => insertQuickReply(action.body)}
                    style={quickReplyButtonStyle}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
              {replyCalendarCandidate ? (
                <div style={calendarQuickAddStyle}>
                  <div>
                    <strong>Calendar suggestion</strong>
                    <span>
                      {replyCalendarCandidate.title} - {replyCalendarCandidate.date}{replyCalendarCandidate.time ? ` ${replyCalendarCandidate.time}` : ''}
                      {replyCalendarCandidate.location ? ` - ${replyCalendarCandidate.location}` : ''} - {replyCalendarCandidate.sourceLabel}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void addMessageCandidateToCalendar(replyCalendarCandidate, 'reply')}
                    disabled={calendarQuickAddSaving === 'reply'}
                    style={ghostButtonStyle}
                  >
                    {calendarQuickAddSaving === 'reply' ? 'Adding...' : 'Add to My Calendar'}
                  </button>
                </div>
              ) : null}
              <textarea
                value={replyBody}
                onChange={(event) => updateReplyDraft(event.target.value)}
                onKeyDown={handleReplyKeyDown}
                placeholder={replyPlaceholder(selectedConversation)}
                style={textareaStyle}
              />
              <button type="button" onClick={() => void submitReply()} disabled={saving || !replyBody.trim()} style={primaryButtonStyle}>
                {saving ? 'Sending...' : 'Send reply'}
              </button>
            </div>
          ) : null}
        </section>

        <aside style={sidePanelStyle} id="alerts">
          <div style={sectionHeaderStyle}>
            <div>
              <div className="section-kicker">Alerts</div>
              <h2 style={sectionTitleStyle}>Notifications</h2>
            </div>
            {unreadNotificationCount ? (
              <button type="button" onClick={() => void markAlertsRead()} style={ghostButtonStyle}>
                Mark all read
              </button>
            ) : null}
          </div>

          {notifications.length ? (
            <div style={filterBarStyle}>
              {alertFilters.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setAlertFilter(filter.key)}
                  aria-pressed={alertFilter === filter.key}
                  style={filterButtonStyle(alertFilter === filter.key)}
                >
                  {filter.label}{filter.count ? ` (${filter.count})` : ''}
                </button>
              ))}
            </div>
          ) : null}

          {notificationsLoading ? (
            <p style={copyStyle}>Loading alerts...</p>
          ) : filteredNotifications.length ? (
            <div style={notificationListStyle}>
              {filteredNotifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => void openNotification(notification)}
                  style={notificationButtonStyle(!notification.readAt)}
                >
                  <span style={notificationTopStyle}>
                    <strong>{notification.title || 'TenAceIQ alert'}</strong>
                    <span style={threadBadgeRowStyle}>
                      <small style={threadTypePillStyle}>{alertFilterLabel(notification.notificationType)}</small>
                      {!notification.readAt ? <small style={unreadPillStyle}>New</small> : null}
                    </span>
                  </span>
                  <span style={threadPreviewStyle}>{notification.body || 'Open Messages to review.'}</span>
                  <span style={threadMetaStyle}>{formatMessageTime(notification.createdAt)}</span>
                </button>
              ))}
            </div>
          ) : notifications.length ? (
            <div style={emptyInboxStyle}>
              <strong>No alerts match this filter.</strong>
              <p style={copyStyle}>Show all alerts to get back to the full notification list.</p>
              <button type="button" onClick={() => setAlertFilter('all')} style={ghostButtonStyle}>
                Show all alerts
              </button>
            </div>
          ) : (
            <p style={copyStyle}>No alerts yet. New messages, scheduling threads, and RSVP changes will land here.</p>
          )}

          <div style={dividerStyle} />

          <div className="section-kicker">Account</div>
          <label style={fieldStyle}>
            <span style={labelStyle}>Shown as</span>
            <div style={lookupRowStyle(isMobile)}>
              <input
                value={displayNameDraft}
                onChange={(event) => setDisplayNameDraft(event.target.value)}
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => void saveDisplayName()}
                disabled={identitySaving || displayNameDraft.trim() === identity.displayName}
                style={ghostButtonStyle}
              >
                {identitySaving ? 'Saving' : 'Save'}
              </button>
            </div>
          </label>
          <div style={identityRowStyle}>
            <span>Support ID</span>
            <strong>{identity.tiqPublicId}</strong>
          </div>
          {identity.tiqAdminId ? (
            <div style={identityRowStyle}>
              <span>Admin ID</span>
              <strong>{identity.tiqAdminId}</strong>
            </div>
          ) : null}
          <div style={preferencePanelStyle}>
            <div style={labelStyle}>Notification settings</div>
            {notificationPreferences ? (
              <div style={preferenceGridStyle}>
                {([
                  ['messageAlertsEnabled', 'Messages'],
                  ['scheduleAlertsEnabled', 'Schedule'],
                  ['supportAlertsEnabled', 'Support'],
                  ['emailFallbackEnabled', 'Email'],
                ] as Array<[keyof InternalNotificationPreferencePatch, string]>).map(([key, label]) => (
                  <label key={key} style={preferenceToggleStyle}>
                    <input
                      type="checkbox"
                      checked={Boolean(notificationPreferences[key])}
                      disabled={preferenceSaving === key}
                      onChange={(event) => void updateNotificationPreference(key, event.target.checked)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p style={hintStyle}>Notification preferences will appear after the latest migration is applied.</p>
            )}
          </div>
          {!identity.identityColumnsAvailable ? (
            <p style={warningStyle}>Messaging identity columns are pending migration. IDs are previewed from your account.</p>
          ) : null}

          <div style={dividerStyle} />

          <div className="section-kicker">New message</div>
          <h2 style={sectionTitleStyle}>Start a thread</h2>
          <div style={segmentedStyle}>
            <button type="button" onClick={() => setComposeMode('support')} style={segmentStyle(composeMode === 'support')}>
              Support
            </button>
            <button type="button" onClick={() => setComposeMode('direct')} style={segmentStyle(composeMode === 'direct')}>
              Player
            </button>
          </div>

          {composeMode === 'direct' ? (
            <label style={fieldStyle}>
              <span style={labelStyle}>Recipient</span>
              <div style={lookupRowStyle(isMobile)}>
                <input
                  value={recipientInput}
                  onChange={(event) => {
                    setRecipientInput(event.target.value)
                    setRecipient(null)
                    setRecipientSearchResults([])
                    setRecipientSearchRan(false)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void searchRecipients()
                    }
                  }}
                  placeholder="Search name or TIQ ID"
                  style={inputStyle}
                />
                <button type="button" onClick={() => void searchRecipients()} style={ghostButtonStyle}>
                  {recipientSearching ? 'Finding' : 'Find player'}
                </button>
              </div>
              {recipient ? <span style={hintStyle}>Selected {recipient.displayName}</span> : null}
              {recipientSearchResults.length ? (
                <div style={recipientResultsStyle}>
                  {recipientSearchResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => {
                        setRecipient(result)
                        setRecipientInput(result.displayName)
                        setRecipientSearchResults([])
                        setRecipientSearchRan(false)
                        setMessage(`Ready to message ${result.displayName}.`)
                        setError('')
                      }}
                      style={recipientResultButtonStyle}
                    >
                      <span>
                        <strong>{result.displayName}</strong>
                        <small>{result.role === 'admin' ? 'Admin' : 'TenAceIQ user'}</small>
                      </span>
                      <em>{result.tiqAdminId || result.tiqPublicId}</em>
                    </button>
                  ))}
                </div>
              ) : recipientSearchRan ? (
                <p style={warningStyle}>No TenAceIQ users matched that name or ID.</p>
              ) : recipientInput.trim() && !recipient ? (
                <p style={hintStyle}>Use Find player, then choose the right match before sending.</p>
              ) : null}
            </label>
          ) : (
            <>
              <label style={fieldStyle}>
                <span style={labelStyle}>Category</span>
                <select
                  value={supportCategory}
                  onChange={(event) => setSupportCategory(event.target.value as SupportFilter)}
                  style={inputStyle}
                >
                  <option value="billing">Billing</option>
                  <option value="league">League</option>
                  <option value="result">Result</option>
                  <option value="data">Data issue</option>
                  <option value="account">Account</option>
                  <option value="general">General</option>
                </select>
              </label>
              <p style={copyStyle}>Support threads are visible to TenAceIQ admins, so billing and account issues can be handled inside the app.</p>
            </>
          )}

          <label style={fieldStyle}>
            <span style={labelStyle}>Subject</span>
            <input value={subject} onChange={(event) => setSubject(event.target.value)} style={inputStyle} />
          </label>

          <label style={fieldStyle}>
            <div style={replyBoxHeaderStyle}>
              <span style={labelStyle}>Message</span>
              <span>{body.trim().length} characters</span>
            </div>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={composeMode === 'support' ? 'What do you need help with?' : 'Write a player-to-player note...'}
              style={textareaStyle}
            />
            {composeCalendarCandidate ? (
              <div style={calendarQuickAddStyle}>
                <div>
                  <strong>Calendar suggestion</strong>
                  <span>
                    {composeCalendarCandidate.title} - {composeCalendarCandidate.date}{composeCalendarCandidate.time ? ` ${composeCalendarCandidate.time}` : ''}
                    {composeCalendarCandidate.location ? ` - ${composeCalendarCandidate.location}` : ''} - {composeCalendarCandidate.sourceLabel}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void addMessageCandidateToCalendar(composeCalendarCandidate, 'compose')}
                  disabled={calendarQuickAddSaving === 'compose'}
                  style={ghostButtonStyle}
                >
                  {calendarQuickAddSaving === 'compose' ? 'Adding...' : 'Add to My Calendar'}
                </button>
              </div>
            ) : null}
          </label>

          <div style={composeReviewStyle}>
            <div style={composeReviewItemStyle}>
              <span>Thread</span>
              <strong>{composeMode === 'support' ? 'Support' : 'Player message'}</strong>
            </div>
            <div style={composeReviewItemStyle}>
              <span>Send to</span>
              <strong>{composeTargetLabel}</strong>
            </div>
            <div style={composeReviewItemStyle}>
              <span>Status</span>
              <strong>{composeReadinessLabel}</strong>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void submitNewConversation()}
            disabled={saving || !canSubmitNewConversation}
            style={saving || !canSubmitNewConversation ? disabledPrimaryButtonStyle : primaryButtonStyle}
          >
            {saving ? 'Sending...' : composeMode === 'support' ? 'Open support thread' : 'Send message'}
          </button>

          {message ? <div style={successStyle}>{message}</div> : null}
          {error ? <div style={errorStyle}>{error}</div> : null}
        </aside>
      </section>
    </section>
  )
}

const pageStyle: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  width: 'min(1280px, calc(100% - clamp(24px, 5vw, 40px)))',
  margin: '0 auto',
  padding: '18px 0 64px',
  minWidth: 0,
  overflowX: 'clip',
  boxSizing: 'border-box',
}

const panelStyle: CSSProperties = {
  position: 'relative',
  borderRadius: 24,
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'linear-gradient(135deg, rgba(8,13,30,0.96), rgba(4,10,24,0.9))',
  boxShadow: '0 24px 70px rgba(2,8,23,0.36), inset 0 1px 0 rgba(255,255,255,0.05)',
  padding: 18,
  display: 'grid',
  gap: 14,
  minWidth: 0,
  overflow: 'hidden',
}

const hiddenPanelStyle: CSSProperties = {
  display: 'none',
}

const watermarkStyle: CSSProperties = {
  position: 'absolute',
  right: '-92px',
  top: '-108px',
  width: 'clamp(230px, 28vw, 380px)',
  aspectRatio: '1',
  borderRadius: '50%',
  border: '1px solid rgba(155,225,29,0.15)',
  background:
    'radial-gradient(circle at 34% 30%, rgba(255,255,255,0.12) 0 7%, transparent 8%), radial-gradient(circle at 52% 52%, rgba(155,225,29,0.08), rgba(125,211,252,0.04) 42%, transparent 68%)',
  opacity: 0.72,
  pointerEvents: 'none',
}

const titleStyle: CSSProperties = {
  margin: '8px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(2rem, 4vw, 3.4rem)',
  lineHeight: 1,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const sectionTitleStyle: CSSProperties = {
  margin: '5px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: '1.25rem',
  lineHeight: 1.15,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const copyStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.55,
  fontWeight: 700,
  overflowWrap: 'anywhere',
}

const workspaceGridStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet
    ? 'minmax(0, 1fr)'
    : 'minmax(min(100%, 250px), 0.8fr) minmax(0, 1.35fr) minmax(min(100%, 280px), 0.85fr)',
  gap: 16,
  alignItems: 'start',
  minWidth: 0,
})

const coachContactsPanelStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
  gap: 16,
  alignItems: 'center',
  margin: '0 0 16px',
  padding: 16,
  borderRadius: 24,
  border: '1px solid rgba(155,225,29,0.20)',
  background:
    'linear-gradient(135deg, rgba(8,13,30,0.96), rgba(10,35,29,0.84)), radial-gradient(circle at 12% 10%, rgba(155,225,29,0.16), transparent 36%)',
  boxShadow: '0 20px 60px rgba(2,8,23,0.28)',
  minWidth: 0,
}

const coachContactsTitleStyle: CSSProperties = {
  margin: '5px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.25rem, 2.6vw, 2rem)',
  lineHeight: 1.05,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const coachContactsCopyStyle: CSSProperties = {
  margin: '8px 0 0',
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.5,
  fontWeight: 750,
}

const coachContactsGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const coachContactButtonStyle: CSSProperties = {
  appearance: 'none',
  display: 'grid',
  gap: 5,
  minHeight: 96,
  padding: 13,
  borderRadius: 18,
  border: '1px solid rgba(125,211,252,0.16)',
  background: 'rgba(255,255,255,0.055)',
  color: 'var(--foreground-strong)',
  textAlign: 'left',
  cursor: 'pointer',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const coachContactLabelStyle: CSSProperties = {
  color: 'var(--accent-green)',
  fontSize: 11,
  lineHeight: 1.2,
  fontWeight: 950,
  textTransform: 'uppercase',
}

const identityRowStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  padding: 12,
  borderRadius: 14,
  border: '1px solid rgba(125,211,252,0.13)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 850,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const preferencePanelStyle: CSSProperties = {
  display: 'grid',
  gap: 9,
  padding: 12,
  borderRadius: 14,
  border: '1px solid rgba(125,211,252,0.13)',
  background: 'rgba(255,255,255,0.045)',
}

const composeReviewStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  padding: 12,
  borderRadius: 14,
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'rgba(155,225,29,0.07)',
  minWidth: 0,
}

const composeReviewItemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 8,
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 850,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const preferenceGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 130px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const preferenceToggleStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 8,
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 850,
  minWidth: 0,
}

const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'flex-start',
  flexWrap: 'wrap',
  minWidth: 0,
}

const pillStyle: CSSProperties = {
  width: 'fit-content',
  maxWidth: '100%',
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.26)',
  background: 'rgba(155,225,29,0.10)',
  color: 'var(--foreground-strong)',
  padding: '7px 10px',
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const threadListStyle: CSSProperties = {
  display: 'grid',
  gap: 9,
  minWidth: 0,
}

const triageSummaryStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
  padding: '10px 12px',
  borderRadius: 14,
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'rgba(155,225,29,0.07)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const threadButtonStyle = (active: boolean, unread = false): CSSProperties => ({
  appearance: 'none',
  border: active || unread
    ? '1px solid rgba(155,225,29,0.30)'
    : '1px solid rgba(125,211,252,0.13)',
  background: active
    ? 'rgba(155,225,29,0.10)'
    : unread
      ? 'rgba(155,225,29,0.07)'
    : 'rgba(255,255,255,0.045)',
  color: 'var(--foreground-strong)',
  borderRadius: 16,
  padding: 12,
  display: 'grid',
  gap: 7,
  textAlign: 'left',
  cursor: 'pointer',
  minWidth: 0,
})

const unreadPillStyle: CSSProperties = {
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.34)',
  background: 'rgba(155,225,29,0.18)',
  color: 'var(--foreground-strong)',
  padding: '3px 7px',
  fontWeight: 950,
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const notificationListStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
}

const notificationButtonStyle = (unread: boolean): CSSProperties => ({
  appearance: 'none',
  display: 'grid',
  gap: 7,
  width: '100%',
  borderRadius: 16,
  border: unread
    ? '1px solid rgba(155,225,29,0.30)'
    : '1px solid rgba(125,211,252,0.13)',
  background: unread
    ? 'rgba(155,225,29,0.08)'
    : 'rgba(255,255,255,0.045)',
  color: 'var(--foreground-strong)',
  padding: 12,
  textAlign: 'left',
  cursor: 'pointer',
  minWidth: 0,
})

const notificationTopStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
}

const dividerStyle: CSSProperties = {
  height: 1,
  background: 'rgba(125,211,252,0.13)',
  margin: '2px 0',
}

const threadTopStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 8,
  alignItems: 'center',
  flexWrap: 'wrap',
  minWidth: 0,
}

const threadPreviewStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.35,
  fontWeight: 700,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const threadMetaStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 11,
  lineHeight: 1.35,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const needsReplyPillStyle: CSSProperties = {
  ...unreadPillStyle,
  border: '1px solid rgba(251,191,36,0.34)',
  background: 'rgba(251,191,36,0.16)',
  color: '#fde68a',
}

const draftPillStyle: CSSProperties = {
  ...unreadPillStyle,
  border: '1px solid rgba(125,211,252,0.28)',
  background: 'rgba(125,211,252,0.12)',
  color: 'var(--brand-blue-2)',
  overflowWrap: 'anywhere',
}

const pinnedPillStyle: CSSProperties = {
  ...unreadPillStyle,
  border: '1px solid rgba(155,225,29,0.34)',
  background: 'rgba(155,225,29,0.16)',
  color: 'var(--foreground-strong)',
  overflowWrap: 'anywhere',
}

const threadBadgeRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 6,
  minWidth: 0,
}

const threadTypePillStyle: CSSProperties = {
  borderRadius: 999,
  border: '1px solid rgba(125,211,252,0.16)',
  background: 'rgba(125,211,252,0.07)',
  color: 'var(--brand-blue-2)',
  padding: '3px 7px',
  fontSize: 11,
  fontWeight: 950,
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const statusPillStyle = (status: InternalConversationStatus): CSSProperties => ({
  ...threadTypePillStyle,
  border: status === 'waiting_on_admin'
    ? '1px solid rgba(251,191,36,0.34)'
    : status === 'waiting_on_user'
      ? '1px solid rgba(125,211,252,0.22)'
      : status === 'closed'
        ? '1px solid rgba(148,163,184,0.20)'
        : '1px solid rgba(155,225,29,0.24)',
  background: status === 'waiting_on_admin'
    ? 'rgba(251,191,36,0.14)'
    : status === 'waiting_on_user'
      ? 'rgba(125,211,252,0.08)'
      : status === 'closed'
        ? 'rgba(148,163,184,0.08)'
        : 'rgba(155,225,29,0.09)',
  color: status === 'waiting_on_admin' ? '#fde68a' : 'var(--foreground-strong)',
})

const emptyInboxStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'rgba(155,225,29,0.07)',
  color: 'var(--foreground-strong)',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const emptyInboxActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
}

const emptyInboxActionStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 34,
  maxWidth: '100%',
  padding: '0 10px',
  borderRadius: 999,
  border: '1px solid rgba(125,211,252,0.18)',
  background: 'rgba(7,18,34,0.52)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 900,
  textDecoration: 'none',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const messageListStyle: CSSProperties = {
  minHeight: 360,
  maxHeight: 560,
  overflowY: 'auto',
  borderRadius: 18,
  border: '1px solid rgba(125,211,252,0.13)',
  background: 'rgba(2,8,23,0.38)',
  padding: 14,
  display: 'grid',
  alignContent: 'start',
  gap: 10,
  minWidth: 0,
}

const contextPanelStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'rgba(155,225,29,0.07)',
  minWidth: 0,
}

const threadHeaderActionStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
}

const supportStatusLineStyle: CSSProperties = {
  margin: '6px 0 0',
  color: '#fde68a',
  fontSize: 13,
  lineHeight: 1.4,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const opsPanelStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(125,211,252,0.16)',
  background: 'rgba(125,211,252,0.06)',
  minWidth: 0,
}

const schedulePanelStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(125,211,252,0.16)',
  background: 'rgba(125,211,252,0.07)',
  minWidth: 0,
}

const schedulePanelHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
  minWidth: 0,
}

const schedulePillStackStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  gap: 8,
  minWidth: 0,
}

const pillDangerStyle: CSSProperties = {
  ...pillStyle,
  border: '1px solid rgba(248,113,113,0.28)',
  background: 'rgba(248,113,113,0.13)',
  color: '#fecaca',
}

const scheduleTitleStyle: CSSProperties = {
  margin: '4px 0 6px',
  color: 'var(--foreground-strong)',
  fontSize: 18,
  lineHeight: 1.15,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const rsvpSummaryStyle = (isMobile: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
  gap: 8,
  minWidth: 0,
})

const rsvpStatStyle: CSSProperties = {
  display: 'grid',
  gap: 2,
  padding: 10,
  borderRadius: 14,
  border: '1px solid rgba(125,211,252,0.13)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 850,
  textTransform: 'uppercase',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const rsvpActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
}

const scheduleManagePanelStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  paddingTop: 2,
  minWidth: 0,
}

const scheduleEditGridStyle = (isMobile: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))',
  gap: 10,
  minWidth: 0,
})

const cancelBoxStyle: CSSProperties = {
  gridColumn: '1 / -1',
  display: 'grid',
  gap: 10,
  padding: 12,
  borderRadius: 14,
  border: '1px solid rgba(248,113,113,0.22)',
  background: 'rgba(248,113,113,0.08)',
  minWidth: 0,
}

const rsvpButtonStyle = (active: boolean, status: InternalScheduleResponseStatus): CSSProperties => ({
  minHeight: 38,
  padding: '0 12px',
  borderRadius: 999,
  border: active
    ? '1px solid rgba(155,225,29,0.34)'
    : '1px solid rgba(125,211,252,0.13)',
  background: active
    ? status === 'out'
      ? 'rgba(248,113,113,0.16)'
      : status === 'maybe'
        ? 'rgba(251,191,36,0.16)'
        : 'rgba(155,225,29,0.14)'
    : 'rgba(255,255,255,0.045)',
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  cursor: 'pointer',
  maxWidth: '100%',
  minWidth: 0,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
})

const messageBubbleWrapStyle = (mine: boolean): CSSProperties => ({
  display: 'flex',
  justifyContent: mine ? 'flex-end' : 'flex-start',
  minWidth: 0,
})

const messageBubbleStyle = (mine: boolean): CSSProperties => ({
  maxWidth: '82%',
  borderRadius: 16,
  border: mine
    ? '1px solid rgba(155,225,29,0.30)'
    : '1px solid rgba(125,211,252,0.13)',
  background: mine
    ? 'rgba(155,225,29,0.11)'
    : 'rgba(255,255,255,0.045)',
  color: 'var(--foreground)',
  padding: '10px 12px',
  display: 'grid',
  gap: 7,
  minWidth: 0,
  overflowWrap: 'anywhere',
})

const emptyThreadStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  alignSelf: 'start',
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(125,211,252,0.13)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--foreground-strong)',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const replyBoxStyle: CSSProperties = {
  position: 'sticky',
  bottom: 0,
  display: 'grid',
  gap: 10,
  padding: 12,
  borderRadius: 18,
  border: '1px solid rgba(125,211,252,0.13)',
  background: 'rgba(2,8,23,0.82)',
  boxShadow: '0 -12px 32px rgba(2,8,23,0.28)',
  minWidth: 0,
}

const replyBoxHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 8,
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 900,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const quickReplyRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
}

const quickReplyButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 34,
  padding: '0 10px',
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.22)',
  background: 'rgba(155,225,29,0.08)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 900,
  cursor: 'pointer',
  maxWidth: '100%',
  minWidth: 0,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
}

const calendarQuickAddStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))',
  gap: 10,
  alignItems: 'center',
  padding: 10,
  borderRadius: 12,
  border: '1px solid color-mix(in srgb, var(--brand-green) 22%, var(--shell-panel-border) 78%)',
  background: 'color-mix(in srgb, var(--brand-green) 7%, var(--shell-chip-bg) 93%)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.35,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const calendarFollowThroughStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
  padding: 12,
  borderRadius: 16,
  border: '1px solid color-mix(in srgb, var(--brand-lime) 26%, var(--shell-panel-border) 74%)',
  background: 'color-mix(in srgb, var(--brand-green) 8%, var(--shell-panel-bg) 92%)',
  color: 'var(--foreground-strong)',
  fontSize: 13,
  fontWeight: 900,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const segmentedStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 120px), 1fr))',
  gap: 8,
  padding: 4,
  borderRadius: 16,
  border: '1px solid rgba(125,211,252,0.13)',
  background: 'rgba(255,255,255,0.045)',
  minWidth: 0,
}

const filterBarStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 7,
  minWidth: 0,
}

const filterButtonStyle = (active: boolean): CSSProperties => ({
  minHeight: 32,
  padding: '0 10px',
  borderRadius: 999,
  border: active
    ? '1px solid rgba(155,225,29,0.34)'
    : '1px solid rgba(125,211,252,0.13)',
  background: active
    ? 'rgba(155,225,29,0.12)'
    : 'rgba(255,255,255,0.045)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 900,
  cursor: 'pointer',
  maxWidth: '100%',
  minWidth: 0,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
})

const segmentStyle = (active: boolean): CSSProperties => ({
  minHeight: 40,
  borderRadius: 12,
  border: active
    ? '1px solid rgba(155,225,29,0.34)'
    : '1px solid transparent',
  background: active
    ? 'rgba(155,225,29,0.18)'
    : 'transparent',
  color: 'var(--foreground-strong)',
  fontWeight: 950,
  cursor: 'pointer',
  minWidth: 0,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
})

const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  minWidth: 0,
}

const labelStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const inputStyle: CSSProperties = {
  width: '100%',
  minWidth: 0,
  minHeight: 44,
  borderRadius: 14,
  border: '1px solid rgba(125,211,252,0.13)',
  background: 'rgba(2,8,23,0.38)',
  color: 'var(--foreground-strong)',
  padding: '0 12px',
  fontWeight: 800,
}

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minWidth: 0,
  minHeight: 120,
  padding: 12,
  resize: 'vertical',
  lineHeight: 1.45,
  overflowWrap: 'anywhere',
}

const lookupRowStyle = (isMobile: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, auto)',
  gap: 8,
  minWidth: 0,
  overflowWrap: 'anywhere',
})

const recipientResultsStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
}

const recipientResultButtonStyle: CSSProperties = {
  appearance: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  width: '100%',
  minHeight: 54,
  borderRadius: 14,
  border: '1px solid rgba(125,211,252,0.13)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--foreground-strong)',
  padding: '9px 11px',
  textAlign: 'left',
  cursor: 'pointer',
  flexWrap: 'wrap',
  minWidth: 0,
}

const primaryButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 'fit-content',
  minHeight: 44,
  padding: '0 16px',
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.34)',
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  color: 'var(--foreground-strong)',
  fontWeight: 950,
  textDecoration: 'none',
  cursor: 'pointer',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10)',
  maxWidth: '100%',
  minWidth: 0,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
}

const disabledPrimaryButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  opacity: 0.52,
  cursor: 'not-allowed',
  boxShadow: 'none',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const ghostButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 38,
  padding: '0 12px',
  borderRadius: 999,
  border: '1px solid rgba(125,211,252,0.13)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  cursor: 'pointer',
  maxWidth: '100%',
  minWidth: 0,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
}

const dangerButtonStyle: CSSProperties = {
  ...ghostButtonStyle,
  width: 'fit-content',
  border: '1px solid rgba(248,113,113,0.28)',
  background: 'rgba(248,113,113,0.14)',
  color: '#fecaca',
}

const hintStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const warningStyle: CSSProperties = {
  ...hintStyle,
  color: '#fde68a',
}

const successStyle: CSSProperties = {
  color: '#bbf7d0',
  fontSize: 13,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const errorStyle: CSSProperties = {
  color: '#fecaca',
  fontSize: 13,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

