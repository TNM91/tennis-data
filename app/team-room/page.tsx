'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import SiteShell from '@/app/components/site-shell'
import { useAuth } from '@/app/components/auth-provider'
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
  const { authResolved, session } = useAuth()
  const [teams, setTeams] = useState<TeamOption[]>([])
  const [room, setRoom] = useState<TeamRoom | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [messageBody, setMessageBody] = useState('')
  const [announcement, setAnnouncement] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const endRef = useRef<HTMLDivElement | null>(null)
  const accessToken = session?.access_token || ''
  const requestedQuery = useMemo(() => {
    const params = new URLSearchParams()
    for (const key of ['team', 'league', 'flight']) {
      const value = searchParams.get(key)?.trim()
      if (value) params.set(key, value)
    }
    const query = params.toString()
    return query ? `?${query}` : ''
  }, [searchParams])

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

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [room?.messages.length])

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
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Message could not be sent.')
    } finally {
      setSending(false)
    }
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

        <div className={styles.messages} aria-live="polite">
          {!room.messages.length ? (
            <div className={styles.emptyMessages}>
              Start the team conversation. Match reminders, availability questions, projected lineups, and team updates stay here for everyone to find.
            </div>
          ) : null}
          {room.messages.map((message) => {
            const isSystem = message.kind === 'system'
            if (isSystem) return <div key={message.id} className={styles.systemBubble}>{message.body}</div>
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
            {QUICK_MESSAGES.map((quick) => (
              <button key={quick.label} className={styles.quickButton} type="button" onClick={() => setMessageBody(quick.body)}>
                {quick.label}
              </button>
            ))}
          </div>
          <textarea
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
    </main>
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
