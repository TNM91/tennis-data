'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import SiteShell from '@/app/components/site-shell'
import { useAuth } from '@/app/components/auth-provider'
import { buildCaptainScopedHref } from '@/lib/captain-memory'
import styles from './team-room.module.css'

type TeamOption = {
  teamName: string
  leagueName: string
  flight: string
  roles: string[]
  isDefault: boolean
  href: string
}

type TeamRoomMember = {
  id: string
  name: string
  playerName: string
  roles: string[]
  muted: boolean
}

type TeamRoomMessage = {
  id: string
  senderUserId: string
  senderName: string
  body: string
  kind: 'message' | 'announcement' | 'system'
  createdAt: string
  isMine: boolean
  card: TeamRoomMatchCard | null
  response: 'yes' | 'maybe' | 'no' | null
  responseSummary: { yes: number; maybe: number; no: number; total: number }
  responseDetails: Array<{ profileId: string; name: string; response: 'yes' | 'maybe' | 'no'; updatedAt: string }>
}

type TeamRoomMatchCard = {
  cardType: 'availability' | 'projected_lineup'
  title: string
  matchDate: string
  opponent: string
  matchTime: string
  facility: string
  lineup: Array<{ label: string; players: string[] }>
  availabilityRequestId: string
  availabilityRequestUrl: string
  state: 'active' | 'upcoming' | 'archived'
  lineupVersion: number
  lineupChanges: string[]
  acknowledged: boolean
  acknowledgmentSummary: { total: number; profileIds: string[] }
  reminder: {
    reminderAt: string
    status: 'scheduled' | 'sent' | 'cancelled'
    sentAt: string
    notificationCount: number
  } | null
}

type TeamRoomActionQueue = {
  messageId: string
  matchDate: string
  waitingCount: number
  waitingNames: string[]
  maybeCount: number
  maybeNames: string[]
  unseenLineupCount: number
  unseenLineupNames: string[]
  lineupChangeCount: number
  unresolvedCount: number
  unresolvedProfileIds: string[]
  reminderAt: string
  reminderStatus: string
  lastReminderAt: string
}

type TeamRoom = {
  id: string
  subject: string
  teamName: string
  leagueName: string
  flight: string
  roles: string[]
  canManage: boolean
  muted: boolean
  members: TeamRoomMember[]
  messages: TeamRoomMessage[]
  href: string
  activeCardId: string
  actionQueue: TeamRoomActionQueue
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const subscribeToUserAgent = () => () => undefined

function getIsIOSSnapshot() {
  return /iPad|iPhone|iPod/.test(window.navigator.userAgent)
}

function getIsStandaloneSnapshot() {
  return window.matchMedia('(display-mode: standalone)').matches
    || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
}

function subscribeToStandalone(onStoreChange: () => void) {
  const media = window.matchMedia('(display-mode: standalone)')
  media.addEventListener('change', onStoreChange)
  return () => media.removeEventListener('change', onStoreChange)
}

const QUICK_MESSAGES = [
  { label: 'Availability', body: 'Who is available for our next match? Please update your availability.' },
  { label: 'Match reminder', body: 'Match reminder: please confirm you saw the match details and arrival time.' },
  { label: 'Lineup update', body: 'Projected lineup update: please review your court and let me know if anything changed.' },
  { label: 'Carpool', body: 'Does anyone need a ride or have room in a car for the next match?' },
]

export default function TeamRoomPage() {
  return (
    <SiteShell active="/messages">
      <Suspense fallback={<TeamRoomLoading />}>
        <TeamRoomContent />
      </Suspense>
    </SiteShell>
  )
}

function TeamRoomContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { authResolved, session, userId } = useAuth()
  const [teams, setTeams] = useState<TeamOption[]>([])
  const [room, setRoom] = useState<TeamRoom | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [respondingId, setRespondingId] = useState('')
  const [acknowledgingId, setAcknowledgingId] = useState('')
  const [reminding, setReminding] = useState(false)
  const [schedulingReminder, setSchedulingReminder] = useState(false)
  const [reminderAt, setReminderAt] = useState('')
  const [showBrowserAlertPrompt, setShowBrowserAlertPrompt] = useState(false)
  const [messageBody, setMessageBody] = useState('')
  const [announcement, setAnnouncement] = useState(false)
  const [showMatchComposer, setShowMatchComposer] = useState(false)
  const [matchDraft, setMatchDraft] = useState(() => ({
    matchDate: searchParams.get('date')?.trim() || '',
    opponent: searchParams.get('opponent')?.trim() || '',
    matchTime: searchParams.get('time')?.trim() || '',
    facility: searchParams.get('facility')?.trim() || '',
  }))
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const endRef = useRef<HTMLDivElement | null>(null)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  const accessToken = session?.access_token || ''
  const requestedQuery = useMemo(() => {
    const params = new URLSearchParams()
    for (const key of ['team', 'league', 'flight', 'date', 'opponent', 'time', 'facility']) {
      const value = searchParams.get(key)?.trim()
      if (value) params.set(key, value)
    }
    const query = params.toString()
    return query ? `?${query}` : ''
  }, [searchParams])

  const pinnedMessage = useMemo(
    () => room?.messages.find((message) => message.id === room.activeCardId) || null,
    [room?.activeCardId, room?.messages],
  )
  const captainHref = useMemo(() => buildCaptainScopedHref('/captain', {
    team: room?.teamName,
    league: room?.leagueName,
    flight: room?.flight,
    date: pinnedMessage?.card?.matchDate || matchDraft.matchDate,
    opponent: pinnedMessage?.card?.opponent || matchDraft.opponent,
  }), [matchDraft.matchDate, matchDraft.opponent, pinnedMessage?.card?.matchDate, pinnedMessage?.card?.opponent, room?.flight, room?.leagueName, room?.teamName])

  const pinnedMatchDate = pinnedMessage?.card?.matchDate || ''
  const pinnedReminderAt = pinnedMessage?.card?.reminder?.reminderAt || ''
  const pinnedReminderStatus = pinnedMessage?.card?.reminder?.status || ''
  useEffect(() => {
    if (!pinnedMatchDate) return
    setReminderAt(toLocalDateTimeInput(
      pinnedReminderStatus === 'scheduled'
        ? pinnedReminderAt
        : defaultReminderTime(pinnedMatchDate),
    ))
  }, [pinnedMatchDate, pinnedReminderAt, pinnedReminderStatus, pinnedMessage?.id])

  const loadRoom = useCallback(async (options: { quiet?: boolean } = {}) => {
    if (!accessToken) return
    if (!options.quiet) setLoading(true)
    try {
      const response = await fetch(`/api/team-rooms${requestedQuery}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      })
      const payload = await response.json() as {
        ok?: boolean
        message?: string
        teams?: TeamOption[]
        room?: TeamRoom | null
      }
      if (!response.ok || !payload.ok) throw new Error(payload.message || 'Team Room could not be opened.')
      setTeams(payload.teams || [])
      setRoom(payload.room || null)
      setError('')
    } catch (loadError) {
      if (!options.quiet) setError(loadError instanceof Error ? loadError.message : 'Team Room could not be opened.')
    } finally {
      if (!options.quiet) setLoading(false)
    }
  }, [accessToken, requestedQuery])

  useEffect(() => {
    if (!authResolved) return
    if (!accessToken) {
      setLoading(false)
      return
    }
    void loadRoom()
  }, [accessToken, authResolved, loadRoom])

  useEffect(() => {
    if (!accessToken || !room) return
    const refresh = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadRoom({ quiet: true })
    }, 9000)
    return () => window.clearInterval(refresh)
  }, [accessToken, loadRoom, room])

  async function postAction(input: Record<string, unknown>) {
    if (!accessToken || !room) throw new Error('Open a linked team first.')
    const response = await fetch('/api/team-rooms', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        teamName: room.teamName,
        leagueName: room.leagueName,
        flight: room.flight,
        ...input,
      }),
    })
    const payload = await response.json() as Record<string, unknown>
    if (!response.ok || payload.ok !== true) throw new Error(String(payload.message || 'Team Room action failed.'))
    return payload
  }

  async function sendMessage() {
    if (!messageBody.trim() || sending) return
    setSending(true)
    setError('')
    try {
      await postAction({ action: 'send', body: messageBody, announcement })
      setMessageBody('')
      setAnnouncement(false)
      await loadRoom({ quiet: true })
      window.requestAnimationFrame(() => endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }))
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Message could not be sent.')
    } finally {
      setSending(false)
    }
  }

  async function postAvailabilityCard() {
    if (!room || !matchDraft.matchDate) {
      setError('Choose the match date first.')
      return
    }
    setSending(true)
    setError('')
    try {
      await postAction({
        action: 'post_match_card',
        card: {
          cardType: 'availability',
          title: 'Can you play?',
          ...matchDraft,
        },
      })
      setShowMatchComposer(false)
      setNotice('Availability check posted. Team replies will update here.')
      await loadRoom({ quiet: true })
    } catch (postError) {
      setError(postError instanceof Error ? postError.message : 'Availability check could not be posted.')
    } finally {
      setSending(false)
    }
  }

  async function respondToMatch(messageId: string, response: 'yes' | 'maybe' | 'no') {
    if (!room || respondingId) return
    setRespondingId(messageId)
    setError('')
    try {
      await postAction({ action: 'respond', messageId, response })
      setRoom({
        ...room,
        messages: room.messages.map((message) => {
          if (message.id !== messageId) return message
          const previous = message.response
          return {
            ...message,
            response,
            card: message.card?.cardType === 'projected_lineup' && !message.card.acknowledged
              ? {
                  ...message.card,
                  acknowledged: true,
                  acknowledgmentSummary: {
                    ...message.card.acknowledgmentSummary,
                    total: message.card.acknowledgmentSummary.total + 1,
                  },
                }
              : message.card,
            responseSummary: {
              yes: message.responseSummary.yes + (response === 'yes' ? 1 : 0) - (previous === 'yes' ? 1 : 0),
              maybe: message.responseSummary.maybe + (response === 'maybe' ? 1 : 0) - (previous === 'maybe' ? 1 : 0),
              no: message.responseSummary.no + (response === 'no' ? 1 : 0) - (previous === 'no' ? 1 : 0),
              total: message.responseSummary.total + (previous ? 0 : 1),
            },
          }
        }),
      })
      setNotice(response === 'yes' ? 'You are marked available.' : response === 'no' ? 'You are marked unavailable.' : 'You are marked maybe.')
    } catch (responseError) {
      setError(responseError instanceof Error ? responseError.message : 'Your reply could not be saved.')
    } finally {
      setRespondingId('')
    }
  }

  async function acknowledgeLineup(messageId: string) {
    if (!room || acknowledgingId) return
    setAcknowledgingId(messageId)
    setError('')
    try {
      await postAction({ action: 'acknowledge_lineup', messageId })
      setNotice('The captain can now see that you reviewed this lineup.')
      await loadRoom({ quiet: true })
    } catch (ackError) {
      setError(ackError instanceof Error ? ackError.message : 'Your acknowledgment could not be saved.')
    } finally {
      setAcknowledgingId('')
    }
  }

  async function remindWaiting(messageId: string) {
    if (!room || reminding) return
    setReminding(true)
    setError('')
    try {
      const payload = await postAction({ action: 'remind_waiting', messageId })
      const notificationIds = Array.isArray(payload.notificationIds)
        ? payload.notificationIds.filter((id): id is string => typeof id === 'string')
        : []
      if (notificationIds.length) {
        await fetch('/api/internal-notifications/email-fallback', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ notificationIds }),
        }).catch(() => null)
      }
      const targetCount = Number(payload.targetCount) || 0
      setNotice(targetCount ? `Reminder sent to ${targetCount} teammate${targetCount === 1 ? '' : 's'}.` : 'Everyone is caught up.')
      await loadRoom({ quiet: true })
    } catch (reminderError) {
      setError(reminderError instanceof Error ? reminderError.message : 'The reminder could not be sent.')
    } finally {
      setReminding(false)
    }
  }

  async function scheduleReminder(messageId: string) {
    if (!room || !reminderAt || schedulingReminder) return
    setSchedulingReminder(true)
    setError('')
    try {
      const localDate = new Date(reminderAt)
      await postAction({ action: 'schedule_reminder', messageId, reminderAt: localDate.toISOString() })
      setNotice(`Reminder set for ${formatReminderTime(localDate.toISOString())}.`)
      await loadRoom({ quiet: true })
    } catch (scheduleError) {
      setError(scheduleError instanceof Error ? scheduleError.message : 'The reminder could not be scheduled.')
    } finally {
      setSchedulingReminder(false)
    }
  }

  async function enableBrowserAlerts() {
    if (!('Notification' in window)) {
      setError('Browser alerts are not supported on this device.')
      return
    }
    const permission = await window.Notification.requestPermission()
    setShowBrowserAlertPrompt(permission !== 'granted')
    setNotice(permission === 'granted' ? 'Browser alerts are on for this device.' : 'Browser alerts were not enabled.')
  }

  async function shareRoom() {
    if (!room) return
    const url = new URL(room.href, window.location.origin).toString()
    await shareOrCopy({ title: `${room.teamName} Team Room`, text: `Open our ${room.teamName} Team Room in TenAceIQ.`, url })
    setNotice('Team Room link ready to share.')
  }

  async function inviteTeam() {
    if (!room || sharing) return
    setSharing(true)
    setError('')
    try {
      const payload = await postAction({ action: 'create_invite' })
      const inviteUrl = String(payload.inviteUrl || '')
      await shareOrCopy({
        title: `Join ${room.teamName}`,
        text: `Join ${room.teamName} in TenAceIQ to use our Team Room and keep match-week communication together.`,
        url: inviteUrl,
      })
      setNotice('Secure team invite ready to share. It expires in 30 days.')
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'Team invite could not be created.')
    } finally {
      setSharing(false)
    }
  }

  async function toggleMute() {
    if (!room) return
    setError('')
    try {
      const nextMuted = !room.muted
      await postAction({ action: 'set_mute', muted: nextMuted })
      setRoom({ ...room, muted: nextMuted })
      setNotice(nextMuted ? 'Team Room notifications muted.' : 'Team Room notifications turned on.')
    } catch (muteError) {
      setError(muteError instanceof Error ? muteError.message : 'Notification setting could not be changed.')
    }
  }

  useEffect(() => {
    setShowBrowserAlertPrompt('Notification' in window && window.Notification.permission !== 'granted')
  }, [])

  useEffect(() => {
    const sentAt = room?.actionQueue.lastReminderAt || ''
    if (!sentAt || !userId || !room?.actionQueue.unresolvedProfileIds.includes(userId)) return
    if (!('Notification' in window) || window.Notification.permission !== 'granted') return
    const storageKey = `tenaceiq-team-reminder:${room.id}:${sentAt}`
    if (window.localStorage.getItem(storageKey)) return
    window.localStorage.setItem(storageKey, 'shown')
    new window.Notification(`${room.teamName} needs your reply`, {
      body: room.actionQueue.matchDate
        ? `Open the ${formatMatchDate(room.actionQueue.matchDate)} match card.`
        : 'Open Team Chat to review the latest match update.',
      icon: '/tenaceiq-icon-192.png',
    })
  }, [room?.actionQueue.lastReminderAt, room?.actionQueue.matchDate, room?.actionQueue.unresolvedProfileIds, room?.id, room?.teamName, userId])

  if (!authResolved || loading) return <TeamRoomLoading />
  if (!accessToken) {
    const next = `/team-room${requestedQuery}`
    return (
      <main className={styles.page}>
        <section className={styles.stateCard}>
          <p className={styles.eyebrow}>Team Room</p>
          <h1>Sign in to open your team conversation.</h1>
          <p className={styles.helper}>Your linked team, unread messages, availability updates, and captain announcements will be waiting here.</p>
          <div className={styles.roomActions}>
            <Link className={styles.buttonPrimary} href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link>
            <Link className={styles.buttonSecondary} href="/join">Create account</Link>
          </div>
        </section>
      </main>
    )
  }

  if (!room) {
    return (
      <main className={styles.page}>
        <section className={styles.stateCard}>
          <p className={styles.eyebrow}>Team Room</p>
          <h1>Connect a team first.</h1>
          <p className={styles.helper}>{error || 'Accept or create a team link, then everyone connected to that team can meet here.'}</p>
          <div className={styles.roomActions}>
            <Link className={styles.buttonPrimary} href="/team-connections">Connect team</Link>
            <Link className={styles.buttonSecondary} href="/captain">Open Captain</Link>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <section className={styles.roomShell} aria-label={`${room.teamName} Team Room`}>
        <header className={styles.roomHeader}>
          <div className={styles.headerTop}>
            <div>
              <p className={styles.eyebrow}>Team Room</p>
              <h1>{room.teamName}</h1>
              <p className={styles.scopeLine}>{[room.leagueName, room.flight].filter(Boolean).join(' · ') || 'Linked team conversation'}</p>
            </div>
            <div className={styles.roomActions}>
              {room.canManage ? <Link className={styles.buttonSecondary} href={captainHref}>Captain</Link> : null}
              {room.canManage ? (
                <button className={styles.buttonPrimary} type="button" onClick={() => setShowMatchComposer((current) => !current)}>
                  Ask availability
                </button>
              ) : null}
              <button className={styles.buttonSecondary} type="button" onClick={() => void shareRoom()}>Share room</button>
              {room.canManage ? (
                <button className={styles.buttonPrimary} type="button" disabled={sharing} onClick={() => void inviteTeam()}>
                  {sharing ? 'Preparing…' : 'Invite team'}
                </button>
              ) : null}
            </div>
          </div>

          {teams.length > 1 ? (
            <select
              className={styles.teamSelect}
              aria-label="Choose Team Room"
              value={room.href}
              onChange={(event) => router.replace(event.target.value)}
            >
              {teams.map((team) => (
                <option key={team.href} value={team.href}>
                  {team.teamName}{team.isDefault ? ' · Default' : ''}
                </option>
              ))}
            </select>
          ) : null}

          <div className={styles.memberSummary}>
            <span className={styles.memberBadge}>{room.members.length} connected</span>
            <span className={styles.roleBadge}>{room.roles.join(' + ').replaceAll('_', '-')}</span>
            <button className={styles.buttonQuiet} type="button" onClick={() => void toggleMute()}>
              {room.muted ? 'Turn notifications on' : 'Mute room'}
            </button>
          </div>
          {notice ? <div className={styles.notice} role="status">{notice}</div> : null}
          {error ? <div className={styles.error} role="alert">{error}</div> : null}
        </header>

        {showMatchComposer ? (
          <div className={styles.pinnedArea}>
            <div className={styles.matchComposer}>
              <div className={styles.matchComposerHeader}>
                <strong>Next match</strong>
                <span>Post one question. Replies stay with this match.</span>
              </div>
              <div className={styles.matchFields}>
                <label>Date<input type="date" value={matchDraft.matchDate} onChange={(event) => setMatchDraft((current) => ({ ...current, matchDate: event.target.value }))} /></label>
                <label>Opponent<input value={matchDraft.opponent} onChange={(event) => setMatchDraft((current) => ({ ...current, opponent: event.target.value }))} placeholder="Opponent" /></label>
                <label>Time<input value={matchDraft.matchTime} onChange={(event) => setMatchDraft((current) => ({ ...current, matchTime: event.target.value }))} placeholder="Match time" /></label>
                <label>Location<input value={matchDraft.facility} onChange={(event) => setMatchDraft((current) => ({ ...current, facility: event.target.value }))} placeholder="Courts or facility" /></label>
              </div>
              <div className={styles.composerActions}>
                <button className={styles.buttonQuiet} type="button" onClick={() => setShowMatchComposer(false)}>Cancel</button>
                <button className={styles.buttonPrimary} type="button" disabled={sending || !matchDraft.matchDate} onClick={() => void postAvailabilityCard()}>
                  {sending ? 'Posting…' : 'Ask team'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {room.canManage && pinnedMessage?.card ? (
          <div className={styles.pinnedArea}>
            <CaptainActionQueue
              queue={room.actionQueue}
              reminderAt={reminderAt}
              reminding={reminding}
              scheduling={schedulingReminder}
              onReminderAtChange={setReminderAt}
              onRemind={() => void remindWaiting(pinnedMessage.id)}
              onSchedule={() => void scheduleReminder(pinnedMessage.id)}
            />
          </div>
        ) : null}

        {pinnedMessage?.card ? (
          <div className={styles.pinnedArea}>
            <MatchCard
              message={pinnedMessage}
              memberCount={room.members.length}
              canManage={room.canManage}
              teamName={room.teamName}
              leagueName={room.leagueName}
              flight={room.flight}
              captainHref={captainHref}
              responding={respondingId === pinnedMessage.id}
              acknowledging={acknowledgingId === pinnedMessage.id}
              onRespond={(response) => void respondToMatch(pinnedMessage.id, response)}
              onAcknowledge={() => void acknowledgeLineup(pinnedMessage.id)}
              onAskCaptain={() => {
                setMessageBody(`Question about ${formatMatchDate(pinnedMessage.card?.matchDate || '')}${pinnedMessage.card?.opponent ? ` vs ${pinnedMessage.card.opponent}` : ''}: `)
                window.requestAnimationFrame(() => composerRef.current?.focus())
              }}
            />
          </div>
        ) : null}

        <div className={styles.messages} aria-live="polite">
          {!room.messages.length ? (
            <div className={styles.emptyMessages}>
              Start the team conversation. Match reminders, availability questions, projected lineups, and team updates stay here for everyone to find.
            </div>
          ) : null}
          {room.messages.map((message) => {
            if (message.id === pinnedMessage?.id) return null
            const isSystem = message.kind === 'system'
            if (isSystem) return <div key={message.id} className={styles.systemBubble}>{message.body}</div>
            if (message.card?.state === 'archived') return <MatchRecap key={message.id} message={message} />
            if (message.card?.state === 'upcoming') return <UpcomingMatchCard key={message.id} message={message} />
            const rowClass = [
              styles.messageRow,
              message.isMine ? styles.messageMine : '',
              message.kind === 'announcement' ? styles.messageAnnouncement : '',
            ].filter(Boolean).join(' ')
            return (
              <article key={message.id} className={rowClass}>
                <div className={styles.messageMeta}>
                  <span>{message.isMine ? 'You' : message.senderName}</span>
                  <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
                  {message.kind === 'announcement' ? <span className={styles.announcementBadge}>Announcement</span> : null}
                </div>
                <div className={styles.bubble}>{message.body}</div>
              </article>
            )
          })}
          <div ref={endRef} />
        </div>

        <div className={styles.composer}>
          <div className={styles.quickActions} aria-label="Quick team messages">
            {room.canManage ? (
              <button className={styles.quickButtonPrimary} type="button" onClick={() => setShowMatchComposer((current) => !current)}>
                Ask availability
              </button>
            ) : null}
            {QUICK_MESSAGES.map((quick) => (
              <button key={quick.label} className={styles.quickButton} type="button" onClick={() => setMessageBody(quick.body)}>
                {quick.label}
              </button>
            ))}
          </div>
          <textarea
            ref={composerRef}
            aria-label="Team Room message"
            placeholder="Message the team…"
            value={messageBody}
            onChange={(event) => setMessageBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void sendMessage()
              }
            }}
          />
          <div className={styles.composerActions}>
            {room.canManage ? (
              <label className={styles.announcementToggle}>
                <input type="checkbox" checked={announcement} onChange={(event) => setAnnouncement(event.target.checked)} />
                Pin as announcement
              </label>
            ) : <span className={styles.helper}>Enter sends · Shift+Enter adds a line</span>}
            <button className={styles.buttonPrimary} type="button" disabled={sending || !messageBody.trim()} onClick={() => void sendMessage()}>
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </section>

      <TeamRoomInstallCard room={room} />
      {showBrowserAlertPrompt ? (
        <button className={styles.browserAlertButton} type="button" onClick={() => void enableBrowserAlerts()}>
          Turn on browser alerts
        </button>
      ) : null}
    </main>
  )
}

function CaptainActionQueue({
  queue,
  reminderAt,
  reminding,
  scheduling,
  onReminderAtChange,
  onRemind,
  onSchedule,
}: {
  queue: TeamRoomActionQueue
  reminderAt: string
  reminding: boolean
  scheduling: boolean
  onReminderAtChange: (value: string) => void
  onRemind: () => void
  onSchedule: () => void
}) {
  const needsAttention = queue.unresolvedCount > 0
  const summary = [
    queue.waitingCount ? `${queue.waitingCount} waiting` : '',
    queue.maybeCount ? `${queue.maybeCount} maybe` : '',
    queue.unseenLineupCount ? `${queue.unseenLineupCount} lineup unseen` : '',
  ].filter(Boolean)
  const names = Array.from(new Set([
    ...queue.waitingNames,
    ...queue.maybeNames,
    ...queue.unseenLineupNames,
  ])).slice(0, 5)

  return (
    <section className={`${styles.actionQueue} ${needsAttention ? styles.actionQueueOpen : styles.actionQueueClear}`} aria-label="Captain action queue">
      <div className={styles.actionQueueTop}>
        <div>
          <p className={styles.matchCardEyebrow}>Needs attention</p>
          <h2>{needsAttention ? summary.join(' · ') : 'Everyone is caught up'}</h2>
          {names.length ? <p>{names.join(', ')}{queue.unresolvedCount > names.length ? ` +${queue.unresolvedCount - names.length}` : ''}</p> : null}
        </div>
        <span className={needsAttention ? styles.queueCountOpen : styles.queueCountClear}>{queue.unresolvedCount}</span>
      </div>
      {needsAttention ? (
        <div className={styles.actionQueueActions}>
          <button className={styles.buttonPrimary} type="button" disabled={reminding} onClick={onRemind}>
            {reminding ? 'Sending…' : `Remind ${queue.unresolvedCount}`}
          </button>
          <label className={styles.reminderField}>
            <span>Automatic follow-up</span>
            <input type="datetime-local" value={reminderAt} onChange={(event) => onReminderAtChange(event.target.value)} />
          </label>
          <button className={styles.buttonSecondary} type="button" disabled={scheduling || !reminderAt} onClick={onSchedule}>
            {scheduling ? 'Setting…' : queue.reminderStatus === 'scheduled' ? 'Update reminder' : 'Set reminder'}
          </button>
        </div>
      ) : null}
      {queue.reminderStatus === 'scheduled' && queue.reminderAt ? (
        <p className={styles.reminderStatus}>TIQ will remind only unfinished players {formatReminderTime(queue.reminderAt)}.</p>
      ) : queue.lastReminderAt ? (
        <p className={styles.reminderStatus}>Last reminder sent {formatReminderTime(queue.lastReminderAt)}.</p>
      ) : null}
    </section>
  )
}

function MatchRecap({ message }: { message: TeamRoomMessage }) {
  const card = message.card
  if (!card) return null
  return (
    <details className={styles.matchRecap}>
      <summary>
        <span><strong>{formatMatchDate(card.matchDate)}</strong>{card.opponent ? ` vs ${card.opponent}` : ''}</span>
        <span>{message.responseSummary.yes} yes · {message.responseSummary.maybe} maybe · {message.responseSummary.no} no</span>
      </summary>
      {card.lineup.length ? (
        <div className={styles.lineupPreview}>
          {card.lineup.map((row, index) => <div key={`${row.label}-${index}`} className={styles.lineupRow}><strong>{row.label}</strong><span>{row.players.join(' / ') || 'Open'}</span></div>)}
        </div>
      ) : <p>{message.body}</p>}
    </details>
  )
}

function UpcomingMatchCard({ message }: { message: TeamRoomMessage }) {
  const card = message.card
  if (!card) return null
  return (
    <article className={styles.upcomingMatch}>
      <span>Coming up</span>
      <strong>{formatMatchDate(card.matchDate)}{card.opponent ? ` vs ${card.opponent}` : ''}</strong>
    </article>
  )
}

function MatchCard({
  message,
  memberCount,
  canManage,
  teamName,
  leagueName,
  flight,
  captainHref,
  responding,
  acknowledging,
  onRespond,
  onAcknowledge,
  onAskCaptain,
}: {
  message: TeamRoomMessage
  memberCount: number
  canManage: boolean
  teamName: string
  leagueName: string
  flight: string
  captainHref: string
  responding: boolean
  acknowledging: boolean
  onRespond: (response: 'yes' | 'maybe' | 'no') => void
  onAcknowledge: () => void
  onAskCaptain: () => void
}) {
  const card = message.card
  if (!card) return null
  const waiting = Math.max(0, memberCount - message.responseSummary.total)
  const messagingHref = buildCaptainScopedHref('/captain/messaging', {
    team: teamName,
    league: leagueName,
    flight,
    date: card.matchDate,
    opponent: card.opponent,
  })

  return (
    <article className={styles.matchCard} aria-label={`${card.title} for ${formatMatchDate(card.matchDate)}`}>
      <div className={styles.matchCardTop}>
        <div>
          <p className={styles.matchCardEyebrow}>{card.cardType === 'projected_lineup' ? 'Projected lineup' : 'Next match'}</p>
          <h2>{card.title}</h2>
        </div>
        <span className={styles.pinnedBadge}>Pinned</span>
      </div>
      <div className={styles.matchIdentity}>
        <strong>{formatMatchDate(card.matchDate)}</strong>
        {card.opponent ? <span>vs {card.opponent}</span> : null}
        {card.matchTime ? <span>{card.matchTime}</span> : null}
        {card.facility ? <span>{card.facility}</span> : null}
      </div>

      {card.lineup.length ? (
        <div className={styles.lineupPreview} aria-label="Projected courts">
          {card.lineup.map((row, index) => (
            <div key={`${row.label}-${index}`} className={styles.lineupRow}>
              <strong>{row.label || `Court ${index + 1}`}</strong>
              <span>{row.players.join(' / ') || 'Open'}</span>
            </div>
          ))}
        </div>
      ) : null}

      {card.lineupChanges.length ? (
        <div className={styles.lineupChanges}>
          <strong>{card.lineupVersion > 1 ? 'What changed' : 'Lineup posted'}</strong>
          {card.lineupChanges.slice(0, 4).map((change) => <span key={change}>{change}</span>)}
        </div>
      ) : null}

      <div className={styles.replySummary}>
        <span><strong>{message.responseSummary.yes}</strong> yes</span>
        <span><strong>{message.responseSummary.maybe}</strong> maybe</span>
        <span><strong>{message.responseSummary.no}</strong> no</span>
        <span><strong>{waiting}</strong> waiting</span>
      </div>
      <div className={styles.responseActions} aria-label="Your availability">
        {([
          ['yes', 'Confirm'],
          ['maybe', 'Maybe'],
          ['no', "Can't play"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            className={`${styles.responseButton} ${message.response === value ? styles.responseSelected : ''}`}
            type="button"
            disabled={responding}
            aria-pressed={message.response === value}
            onClick={() => onRespond(value)}
          >
            {label}
          </button>
        ))}
        {card.cardType === 'projected_lineup' ? (
          <button
            className={`${styles.responseButton} ${card.acknowledged ? styles.responseSelected : ''}`}
            type="button"
            disabled={acknowledging || card.acknowledged}
            aria-pressed={card.acknowledged}
            onClick={onAcknowledge}
          >
            {card.acknowledged ? 'Seen' : acknowledging ? 'Saving…' : 'Mark seen'}
          </button>
        ) : null}
        {!canManage ? <button className={styles.responseButton} type="button" onClick={onAskCaptain}>Ask captain</button> : null}
      </div>
      {card.cardType === 'projected_lineup' ? (
        <p className={styles.ackSummary}>{card.acknowledgmentSummary.total} teammate{card.acknowledgmentSummary.total === 1 ? '' : 's'} saw version {card.lineupVersion}.</p>
      ) : null}
      {canManage ? (
        <div className={styles.captainCardActions}>
          <Link className={styles.buttonPrimary} href={messagingHref}>Text players not connected</Link>
          <Link className={styles.buttonSecondary} href={captainHref}>Back to Captain</Link>
        </div>
      ) : null}
    </article>
  )
}

function TeamRoomInstallCard({ room }: { room: TeamRoom }) {
  const isIOS = useSyncExternalStore(subscribeToUserAgent, getIsIOSSnapshot, () => false)
  const isStandalone = useSyncExternalStore(subscribeToStandalone, getIsStandaloneSnapshot, () => false)
  const [showIOSSteps, setShowIOSSteps] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const capturePrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', capturePrompt)
    return () => window.removeEventListener('beforeinstallprompt', capturePrompt)
  }, [])

  async function install() {
    if (installPrompt) {
      await installPrompt.prompt()
      await installPrompt.userChoice
      setInstallPrompt(null)
      return
    }
    setShowIOSSteps(true)
  }

  return (
    <section className={styles.installCard} aria-label="Team Room app access">
      <div>
        <h2>Put this Team Room on your Home Screen.</h2>
        <p>Open TenAceIQ like an app and return to your default team conversation in one tap.</p>
      </div>
      <div className={styles.installActions}>
        {isStandalone ? (
          <span className={styles.standaloneBadge}>Home Screen ready</span>
        ) : (
          <button className={styles.buttonPrimary} type="button" onClick={() => void install()}>
            Add to Home Screen
          </button>
        )}
        <button className={styles.buttonSecondary} type="button" onClick={() => void shareOrCopy({
          title: `${room.teamName} Team Room`,
          text: `Open our ${room.teamName} Team Room in TenAceIQ.`,
          url: new URL(room.href, window.location.origin).toString(),
        })}>Share</button>
      </div>
      {showIOSSteps || (isIOS && !isStandalone) ? (
        <div className={styles.iosSteps}>
          On iPhone: open this page in Safari, tap the Share button, choose <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>. Your TenAceIQ icon will open full screen like an app.
        </div>
      ) : null}
    </section>
  )
}

function TeamRoomLoading() {
  return (
    <main className={styles.page}>
      <section className={styles.stateCard}>
        <p className={styles.eyebrow}>Team Room</p>
        <h1>Opening your team conversation…</h1>
        <p className={styles.helper}>Connecting your linked team, members, and latest messages.</p>
      </section>
    </main>
  )
}

async function shareOrCopy(input: ShareData) {
  if (navigator.share) {
    try {
      await navigator.share(input)
      return
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
    }
  }
  if (input.url) await navigator.clipboard.writeText(String(input.url))
}

function formatMessageTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const today = new Date()
  const sameDay = date.toDateString() === today.toDateString()
  return sameDay
    ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function formatMatchDate(value: string) {
  if (!value) return 'Next match'
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

function defaultReminderTime(matchDate: string) {
  const reminder = new Date(`${matchDate}T18:00:00`)
  reminder.setDate(reminder.getDate() - 1)
  if (Number.isNaN(reminder.getTime()) || reminder.getTime() <= Date.now()) {
    return new Date(Date.now() + (2 * 60 * 60 * 1000)).toISOString()
  }
  return reminder.toISOString()
}

function toLocalDateTimeInput(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - (date.getTimezoneOffset() * 60_000))
  return local.toISOString().slice(0, 16)
}

function formatReminderTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
