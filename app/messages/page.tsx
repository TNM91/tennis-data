'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import SiteShell from '@/app/components/site-shell'
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
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

type ComposeMode = 'support' | 'direct'
type SupportFilter = 'all' | 'billing' | 'league' | 'result' | 'data' | 'account' | 'general'

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
  threadId: string
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

function buildConversationContextHref(conversation: InternalConversation | null) {
  if (!conversation) return ''
  const entityType = conversation.metadata.entityType || conversation.relatedEntityType
  const entityId = conversation.metadata.entityId || conversation.relatedEntityId
  if (!entityType || !entityId) return ''

  if (entityType === 'tiq_league') {
    return `/explore/leagues/tiq/${encodeURIComponent(entityId)}?league_id=${encodeURIComponent(entityId)}`
  }
  if (entityType === 'tiq_individual_result') return '/compete/results'
  if (entityType === 'tiq_schedule_item' || entityType === 'schedule_match') return '/compete/schedule'
  if (entityType === 'billing') return '/profile'
  return ''
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
          <div className="section-kicker">Messages</div>
          <h1 style={titleStyle}>Loading your TenAceIQ inbox...</h1>
        </div>
      </section>
    </SiteShell>
  )
}

function MessagesWorkspace({ prefill }: { prefill: MessagePrefill }) {
  const { userId, authResolved } = useAuth()
  const { isTablet, isMobile } = useViewportBreakpoints()
  const [identity, setIdentity] = useState<InternalIdentity | null>(null)
  const [conversations, setConversations] = useState<InternalConversation[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [messages, setMessages] = useState<InternalMessage[]>([])
  const [scheduleEvents, setScheduleEvents] = useState<InternalScheduleEvent[]>([])
  const [scheduleResponses, setScheduleResponses] = useState<InternalScheduleResponse[]>([])
  const [notifications, setNotifications] = useState<InternalNotification[]>([])
  const [notificationPreferences, setNotificationPreferences] = useState<InternalNotificationPreferences | null>(null)
  const [composeMode, setComposeMode] = useState<ComposeMode>(prefill.mode)
  const [supportCategory, setSupportCategory] = useState<SupportFilter>(prefill.category)
  const [supportFilter, setSupportFilter] = useState<SupportFilter>('all')
  const [recipientInput, setRecipientInput] = useState('')
  const [recipient, setRecipient] = useState<InternalRecipient | null>(null)
  const [recipientSearchResults, setRecipientSearchResults] = useState<InternalRecipient[]>([])
  const [recipientSearching, setRecipientSearching] = useState(false)
  const [displayNameDraft, setDisplayNameDraft] = useState('')
  const [identitySaving, setIdentitySaving] = useState(false)
  const [subject, setSubject] = useState(prefill.subject || (prefill.mode === 'support' ? 'Support request' : ''))
  const [body, setBody] = useState('')
  const [replyBody, setReplyBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [threadLoading, setThreadLoading] = useState(false)
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [responseSaving, setResponseSaving] = useState('')
  const [preferenceSaving, setPreferenceSaving] = useState('')
  const [conversationActionSaving, setConversationActionSaving] = useState('')
  const [scheduleActionSaving, setScheduleActionSaving] = useState('')
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
  const selectedContextHref = useMemo(() => buildConversationContextHref(selectedConversation), [selectedConversation])
  const unreadNotificationCount = useMemo(
    () => notifications.filter((notification) => !notification.readAt).length,
    [notifications],
  )
  const filteredConversations = useMemo(() => {
    if (!identity || identity.role !== 'admin' || supportFilter === 'all') return conversations
    return conversations.filter((conversation) =>
      conversation.conversationType === 'support' && conversation.relatedEntityType === supportFilter,
    )
  }, [conversations, identity, supportFilter])
  const unreadCount = useMemo(
    () => conversations.filter((conversation) => conversation.isUnread).length,
    [conversations],
  )

  useEffect(() => {
    setComposeMode(prefill.mode)
    setSupportCategory(prefill.category)
    setRecipientInput(prefill.recipient)
    setSubject(prefill.subject || (prefill.mode === 'support' ? 'Support request' : ''))
    setBody(prefill.body)
    setRecipient(null)
    setRecipientSearchResults([])
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
        return
      }

      const nextConversations = await listInternalConversations(nextIdentity)
      setConversations(nextConversations)
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
    setMessage(`Ready to message ${found.displayName}.`)
    return found
  }

  async function searchRecipients() {
    if (!identity) return
    const query = recipientInput.trim()
    setRecipient(null)
    setRecipientSearchResults([])
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
      if (!results.length) {
        setError('No TenAceIQ users matched that name or ID.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recipient search could not run.')
    } finally {
      setRecipientSearching(false)
    }
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
        conversationId = await createDirectConversation(identity, nextRecipient, subject, body)
      }

      setBody('')
      setSubject(composeMode === 'support' ? 'Support request' : '')
      setRecipient(null)
      setRecipientInput('')
      setSelectedId(conversationId)
      await loadInbox()
      setSelectedId(conversationId)
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
      await sendInternalMessage(selectedConversation.id, identity.userId, replyBody)
      setReplyBody('')
      setMessages(await listInternalMessages(selectedConversation.id))
      setConversations(await listInternalConversations(identity))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reply could not be sent.')
    } finally {
      setSaving(false)
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
        setSelectedId(notification.conversationId)
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

  if (!authResolved || loading) {
    return (
      <section style={pageStyle}>
        <div style={panelStyle}>
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
          <div className="section-kicker">Messages</div>
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
      <section style={heroStyle(isTablet, isMobile)}>
        <div>
          <div className="section-kicker">TenAceIQ Messages</div>
          <h1 style={titleStyle}>One place for support and player communication.</h1>
          <p style={copyStyle}>
            Search by player or account name, message another user, or open a support thread without leaving the platform.
          </p>
        </div>
        <div style={identityPanelStyle}>
          <span style={pillStyle}>{identity.role === 'admin' ? 'Admin identity' : 'Messaging identity'}</span>
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
            <span>Support reference ID</span>
            <strong>{identity.tiqPublicId}</strong>
          </div>
          {identity.tiqAdminId ? (
            <div style={identityRowStyle}>
              <span>Admin support ID</span>
              <strong>{identity.tiqAdminId}</strong>
            </div>
          ) : null}
          <div style={preferencePanelStyle}>
            <div style={labelStyle}>Notifications</div>
            {notificationPreferences ? (
              <div style={preferenceGridStyle}>
                {([
                  ['messageAlertsEnabled', 'Messages'],
                  ['scheduleAlertsEnabled', 'Schedule'],
                  ['supportAlertsEnabled', 'Support'],
                  ['emailFallbackEnabled', 'Email fallback'],
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
            {notificationPreferences?.emailFallbackEnabled ? (
              <p style={hintStyle}>Email fallback only says you have a new TenAceIQ alert. Message content stays inside the app.</p>
            ) : null}
          </div>
          {!identity.identityColumnsAvailable ? (
            <p style={warningStyle}>Messaging identity columns are pending migration. IDs are previewed from your account.</p>
          ) : null}
        </div>
      </section>

      <section style={workspaceGridStyle(isTablet)}>
        <aside style={panelStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <div className="section-kicker">Inbox</div>
              <h2 style={sectionTitleStyle}>{identity.role === 'admin' ? 'Platform threads' : 'Your threads'}</h2>
            </div>
            <button type="button" onClick={() => void loadInbox()} style={ghostButtonStyle}>
              Refresh
            </button>
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
                  onClick={() => setSelectedId(conversation.id)}
                  style={threadButtonStyle(selectedId === conversation.id, conversation.isUnread)}
                >
                  <span style={threadTopStyle}>
                    <strong>{conversation.subject}</strong>
                    <small style={conversation.isUnread ? unreadPillStyle : undefined}>
                      {conversation.conversationType === 'support'
                        ? supportCategoryLabel(conversation.relatedEntityType)
                        : conversationTypeLabel(conversation.conversationType)}
                    </small>
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
            <p style={copyStyle}>No messages yet. Start with support or search for another player by name.</p>
          )}
        </aside>

        <section style={panelStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <div className="section-kicker">Thread</div>
              <h2 style={sectionTitleStyle}>{selectedConversation?.subject || 'Select a conversation'}</h2>
            </div>
            {selectedConversation ? <span style={pillStyle}>{statusLabel(selectedConversation.status)}</span> : null}
          </div>

          {selectedConversation?.conversationType === 'support' || selectedConversation?.conversationType === 'league' ? (
            <div style={contextPanelStyle}>
              <div>
                <div style={labelStyle}>Context</div>
                <p style={copyStyle}>
                  {selectedConversation.conversationType === 'league'
                    ? selectedConversation.metadata.leagueName || selectedConversation.relatedEntityId || 'League conversation'
                    : `${supportCategoryLabel(selectedConversation.relatedEntityType)} support`}
                </p>
              </div>
              {selectedContextHref ? (
                <Link href={selectedContextHref} style={ghostButtonStyle}>Open context</Link>
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
              <p style={copyStyle}>Messages will appear here after you select or create a thread.</p>
            )}
          </div>

          {selectedConversation ? (
            <div style={replyBoxStyle}>
              <textarea
                value={replyBody}
                onChange={(event) => setReplyBody(event.target.value)}
                placeholder="Write a reply..."
                style={textareaStyle}
              />
              <button type="button" onClick={() => void submitReply()} disabled={saving || !replyBody.trim()} style={primaryButtonStyle}>
                {saving ? 'Sending...' : 'Send reply'}
              </button>
            </div>
          ) : null}
        </section>

        <aside style={panelStyle} id="alerts">
          <div style={sectionHeaderStyle}>
            <div>
              <div className="section-kicker">Alerts</div>
              <h2 style={sectionTitleStyle}>Notifications</h2>
            </div>
            {unreadNotificationCount ? (
              <button type="button" onClick={() => void markAlertsRead()} style={ghostButtonStyle}>
                Mark read
              </button>
            ) : null}
          </div>

          {notificationsLoading ? (
            <p style={copyStyle}>Loading alerts...</p>
          ) : notifications.length ? (
            <div style={notificationListStyle}>
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => void openNotification(notification)}
                  style={notificationButtonStyle(!notification.readAt)}
                >
                  <span style={notificationTopStyle}>
                    <strong>{notification.title || 'TenAceIQ alert'}</strong>
                    {!notification.readAt ? <small style={unreadPillStyle}>New</small> : null}
                  </span>
                  <span style={threadPreviewStyle}>{notification.body || 'Open Messages to review.'}</span>
                  <span style={threadMetaStyle}>{formatMessageTime(notification.createdAt)}</span>
                </button>
              ))}
            </div>
          ) : (
            <p style={copyStyle}>No alerts yet. New messages, scheduling threads, and RSVP changes will land here.</p>
          )}

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
                  }}
                  placeholder="Search name or TIQ ID"
                  style={inputStyle}
                />
                <button type="button" onClick={() => void searchRecipients()} style={ghostButtonStyle}>
                  {recipientSearching ? 'Finding' : 'Find'}
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
            <span style={labelStyle}>Message</span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={composeMode === 'support' ? 'What do you need help with?' : 'Write a player-to-player note...'}
              style={textareaStyle}
            />
          </label>

          <button type="button" onClick={() => void submitNewConversation()} disabled={saving || !body.trim()} style={primaryButtonStyle}>
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
  width: '100%',
  maxWidth: 1280,
  margin: '0 auto',
  padding: '18px 24px 30px',
  minWidth: 0,
}

const heroStyle = (isTablet: boolean, isMobile: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'minmax(0, 1.2fr) minmax(min(100%, 320px), 0.8fr)',
  gap: isMobile ? 14 : 18,
  alignItems: 'stretch',
  marginBottom: 18,
  minWidth: 0,
})

const panelStyle: CSSProperties = {
  borderRadius: 22,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg-strong)',
  boxShadow: 'var(--shadow-card)',
  padding: 18,
  display: 'grid',
  gap: 14,
  minWidth: 0,
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

const identityPanelStyle: CSSProperties = {
  ...panelStyle,
  background:
    'radial-gradient(circle at top right, color-mix(in srgb, var(--brand-green) 14%, transparent) 0%, transparent 42%), var(--shell-panel-bg-strong)',
}

const identityRowStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  padding: 12,
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
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
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
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
  border: '1px solid color-mix(in srgb, var(--brand-green) 26%, var(--shell-panel-border) 74%)',
  background: 'color-mix(in srgb, var(--brand-green) 10%, var(--shell-chip-bg) 90%)',
  color: 'var(--foreground-strong)',
  padding: '7px 10px',
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const threadListStyle: CSSProperties = {
  display: 'grid',
  gap: 9,
  minWidth: 0,
}

const threadButtonStyle = (active: boolean, unread = false): CSSProperties => ({
  appearance: 'none',
  border: active || unread
    ? '1px solid color-mix(in srgb, var(--brand-green) 28%, var(--shell-panel-border) 72%)'
    : '1px solid var(--shell-panel-border)',
  background: active
    ? 'color-mix(in srgb, var(--brand-green) 9%, var(--shell-chip-bg) 91%)'
    : unread
      ? 'color-mix(in srgb, var(--brand-green) 6%, var(--shell-chip-bg) 94%)'
    : 'var(--shell-chip-bg)',
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
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
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
    ? '1px solid color-mix(in srgb, var(--brand-green) 28%, var(--shell-panel-border) 72%)'
    : '1px solid var(--shell-panel-border)',
  background: unread
    ? 'color-mix(in srgb, var(--brand-green) 7%, var(--shell-chip-bg) 93%)'
    : 'var(--shell-chip-bg)',
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
  background: 'var(--shell-panel-border)',
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

const messageListStyle: CSSProperties = {
  minHeight: 360,
  maxHeight: 560,
  overflowY: 'auto',
  borderRadius: 18,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
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
  border: '1px solid color-mix(in srgb, var(--brand-green) 18%, var(--shell-panel-border) 82%)',
  background: 'color-mix(in srgb, var(--brand-green) 7%, var(--shell-chip-bg) 93%)',
  minWidth: 0,
}

const opsPanelStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: 12,
  borderRadius: 16,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 20%, var(--shell-panel-border) 80%)',
  background: 'color-mix(in srgb, var(--brand-blue-2) 6%, var(--shell-chip-bg) 94%)',
  minWidth: 0,
}

const schedulePanelStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: 14,
  borderRadius: 18,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 20%, var(--shell-panel-border) 80%)',
  background: 'color-mix(in srgb, var(--brand-blue-2) 7%, var(--shell-chip-bg) 93%)',
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
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
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
    ? '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)'
    : '1px solid var(--shell-panel-border)',
  background: active
    ? status === 'out'
      ? 'rgba(248,113,113,0.16)'
      : status === 'maybe'
        ? 'rgba(251,191,36,0.16)'
        : 'color-mix(in srgb, var(--brand-green) 16%, var(--shell-chip-bg) 84%)'
    : 'var(--shell-chip-bg)',
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
    ? '1px solid color-mix(in srgb, var(--brand-green) 28%, var(--shell-panel-border) 72%)'
    : '1px solid var(--shell-panel-border)',
  background: mine
    ? 'color-mix(in srgb, var(--brand-green) 12%, var(--shell-panel-bg) 88%)'
    : 'var(--shell-panel-bg)',
  color: 'var(--foreground)',
  padding: '10px 12px',
  display: 'grid',
  gap: 7,
  minWidth: 0,
  overflowWrap: 'anywhere',
})

const replyBoxStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
}

const segmentedStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 120px), 1fr))',
  gap: 8,
  padding: 4,
  borderRadius: 16,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
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
    ? '1px solid color-mix(in srgb, var(--brand-green) 34%, var(--shell-panel-border) 66%)'
    : '1px solid var(--shell-panel-border)',
  background: active
    ? 'color-mix(in srgb, var(--brand-green) 12%, var(--shell-chip-bg) 88%)'
    : 'var(--shell-chip-bg)',
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
    ? '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)'
    : '1px solid transparent',
  background: active
    ? 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)'
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
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const inputStyle: CSSProperties = {
  width: '100%',
  minWidth: 0,
  minHeight: 44,
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
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
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
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
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  color: 'var(--foreground-strong)',
  fontWeight: 950,
  textDecoration: 'none',
  cursor: 'pointer',
  boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--foreground-strong) 10%, transparent)',
  maxWidth: '100%',
  minWidth: 0,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
}

const ghostButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 38,
  padding: '0 12px',
  borderRadius: 999,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
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
