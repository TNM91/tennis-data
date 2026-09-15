'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import LockedPlanPage from '@/app/components/locked-plan-page'
import ScheduleMessageComposer from '@/app/components/schedule-message-composer'
import SiteShell from '@/app/components/site-shell'
import { useAuth } from '@/app/components/auth-provider'
import TiqFeatureIcon from '@/components/brand/TiqFeatureIcon'
import { buildProductAccessState } from '@/lib/access-model'
import {
  buildCaptainLevelUpChallenge,
  type CaptainLevelUpChallenge,
} from '@/lib/captain-level-up-challenge'
import { buildConsumedWorkflowHref } from '@/lib/workflow-return'
import {
  cancelInternalScheduleEvent,
  listCaptainPracticeManagementOverview,
  setCaptainPracticeInviteeConfirmed,
  type CaptainPracticeManagementOverview,
} from '@/lib/internal-scheduling'
import { practiceRsvpPath } from '@/lib/captain-practice-rsvp'

export default function CaptainPracticePage() {
  return (
    <SiteShell active="/captain">
      <CaptainPracticeContent />
    </SiteShell>
  )
}

function CaptainPracticeContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { role, userId, entitlements, authResolved } = useAuth()
  const resolvedRole = authResolved || !userId ? role : 'member'
  const access = useMemo(() => buildProductAccessState(resolvedRole, entitlements), [entitlements, resolvedRole])
  const incomingLevelUpChallenge = useMemo(
    () => buildCaptainLevelUpChallenge(searchParams.get('levelUpChallenge') || '', searchParams.get('card') || ''),
    [searchParams],
  )
  const [teamName, setTeamName] = useState(searchParams.get('team') || '')
  const [leagueName, setLeagueName] = useState(searchParams.get('league') || '')
  const [flight, setFlight] = useState(searchParams.get('flight') || '')
  const [practiceDate, setPracticeDate] = useState(searchParams.get('date') || '')
  const [practiceTime, setPracticeTime] = useState(searchParams.get('time') || '')
  const [practiceEndTime, setPracticeEndTime] = useState(searchParams.get('endTime') || '')
  const [facility, setFacility] = useState(searchParams.get('facility') || '')
  const [practiceFocus, setPracticeFocus] = useState(
    incomingLevelUpChallenge ? `${incomingLevelUpChallenge.title}: ${incomingLevelUpChallenge.focus}` : '',
  )
  const [levelUpChallenge, setLevelUpChallenge] = useState<CaptainLevelUpChallenge | null>(incomingLevelUpChallenge)
  const [practices, setPractices] = useState<CaptainPracticeManagementOverview[]>([])
  const [practicesLoading, setPracticesLoading] = useState(true)
  const [practicesError, setPracticesError] = useState('')
  const [practiceMessage, setPracticeMessage] = useState('')
  const [deletingPracticeId, setDeletingPracticeId] = useState('')
  const [expandedPracticeId, setExpandedPracticeId] = useState('')
  const [practiceConfirmationSaving, setPracticeConfirmationSaving] = useState('')
  const [showCreate, setShowCreate] = useState(searchParams.get('new') === '1' || Boolean(incomingLevelUpChallenge))

  const loadPractices = useCallback(async () => {
    setPracticesLoading(true)
    setPracticesError('')
    try {
      setPractices(await listCaptainPracticeManagementOverview())
    } catch (error) {
      setPracticesError(error instanceof Error ? error.message : 'Practices could not load yet.')
    } finally {
      setPracticesLoading(false)
    }
  }, [])

  const deletePractice = useCallback(async (practice: CaptainPracticeManagementOverview) => {
    if (!userId || deletingPracticeId) return
    const title = practice.event.title || 'this practice'
    const confirmed = window.confirm(`Delete ${title}? It will be removed from your practice hub and players will no longer be able to RSVP.`)
    if (!confirmed) return

    setDeletingPracticeId(practice.event.id)
    setPracticesError('')
    setPracticeMessage('')
    try {
      await cancelInternalScheduleEvent({
        eventId: practice.event.id,
        actorUserId: userId,
        reason: 'Removed by the captain from the practice hub.',
        notifyParticipants: false,
      })
      setPractices((current) => current.filter(({ event }) => event.id !== practice.event.id))
      setPracticeMessage(`${title} was deleted.`)
    } catch (error) {
      setPracticesError(error instanceof Error ? error.message : 'The practice could not be deleted.')
    } finally {
      setDeletingPracticeId('')
    }
  }, [deletingPracticeId, userId])

  const confirmPracticePlayer = useCallback(async (
    practice: CaptainPracticeManagementOverview,
    inviteeId: string,
    confirmed: boolean,
  ) => {
    if (practiceConfirmationSaving || !practice.roster) return
    const player = practice.roster.roster.find((entry) => entry.id === inviteeId)
    if (!player) return

    setPracticeConfirmationSaving(inviteeId)
    setPracticesError('')
    setPracticeMessage('')
    try {
      await setCaptainPracticeInviteeConfirmed({
        eventId: practice.event.id,
        inviteeId,
        confirmed,
      })
      const confirmedAt = confirmed ? new Date().toISOString() : ''
      setPractices((current) => current.map((entry) => entry.event.id !== practice.event.id || !entry.roster
        ? entry
        : {
            ...entry,
            roster: {
              ...entry.roster,
              roster: entry.roster.roster.map((rosterPlayer) => rosterPlayer.id === inviteeId
                ? { ...rosterPlayer, captainConfirmed: confirmed, captainConfirmedAt: confirmedAt }
                : rosterPlayer),
            },
          }))
      setPracticeMessage(confirmed
        ? `${player.playerName} is confirmed for ${practice.event.title || 'practice'}.`
        : `${player.playerName}'s practice confirmation was removed.`)
    } catch (error) {
      setPracticesError(error instanceof Error ? error.message : 'The practice confirmation could not be saved.')
    } finally {
      setPracticeConfirmationSaving('')
    }
  }, [practiceConfirmationSaving])

  useEffect(() => {
    if (!authResolved || role !== 'public') return
    const returnTo = `${pathname}${searchParams.size ? `?${searchParams.toString()}` : ''}`
    router.replace(`/login?plan=captain&next=${encodeURIComponent(returnTo)}`)
  }, [authResolved, pathname, role, router, searchParams])

  useEffect(() => {
    if (!authResolved || role === 'public') return

    if (!incomingLevelUpChallenge) return
    const consumedHref = buildConsumedWorkflowHref(
      pathname,
      searchParams,
      ['levelUpChallenge', 'card'],
      window.location.hash,
    )
    if (consumedHref) router.replace(consumedHref, { scroll: false })
  }, [authResolved, incomingLevelUpChallenge, pathname, role, router, searchParams])

  useEffect(() => {
    if (!authResolved || role === 'public' || !access.canUseCaptainWorkflow) return
    void loadPractices()
  }, [access.canUseCaptainWorkflow, authResolved, loadPractices, role])

  if (!authResolved || role === 'public') {
    return null
  }

  if (!access.canUseCaptainWorkflow) {
    return (
      <LockedPlanPage
        active="/captain"
        withinShell
        planId="captain"
        headline="Unlock practice coordination with Captain"
        body="Captain lets you schedule practices, invite the team, collect RSVPs, and keep practice messages with the rest of the team week."
        ctaLabel="Unlock Captain"
        secondaryLabel="Back to Team"
        secondaryHref="/captain"
      />
    )
  }

  const practiceNotes = [
    practiceFocus ? `Practice focus: ${practiceFocus}` : '',
    'Please mark In, Out, or Maybe so the captain can plan courts.',
  ].filter(Boolean).join('\n')
  const canSchedule = Boolean(teamName.trim() && practiceDate)
  const today = new Date().toLocaleDateString('en-CA')
  const upcomingPractices = practices
    .filter(({ event }) => event.scheduledDate >= today && event.status !== 'completed')
    .sort((left, right) => `${left.event.scheduledDate}T${left.event.scheduledTime || '00:00'}`.localeCompare(`${right.event.scheduledDate}T${right.event.scheduledTime || '00:00'}`))
  const recentPractices = practices
    .filter(({ event }) => event.scheduledDate < today || event.status === 'completed')
    .slice(0, 3)
  const hasPractices = upcomingPractices.length > 0 || recentPractices.length > 0

  return (
    <main style={pageStyle}>
      <section style={workspaceStyle} aria-label="Practice management">
        <div style={panelHeaderStyle}>
          <div>
            <div style={sectionEyebrowStyle}>Team practices</div>
            <h1 style={sectionTitleStyle}>{hasPractices ? 'Manage practice.' : 'Plan your first practice.'}</h1>
          </div>
          {hasPractices ? (
            <button type="button" onClick={() => setShowCreate((current) => !current)} style={primaryButtonStyle}>
              {showCreate ? 'Close new practice' : 'Create another practice'}
            </button>
          ) : null}
        </div>

        {practicesLoading ? <div style={noticeStyle}>Loading your practices...</div> : null}
        {practiceMessage ? <div style={successStyle} role="status">{practiceMessage}</div> : null}
        {practicesError ? (
          <div style={errorStyle} role="alert">
            <span>{practicesError}</span>
            <button type="button" onClick={() => void loadPractices()} style={textButtonStyle}>Try again</button>
          </div>
        ) : null}

        {!practicesLoading && !practicesError && hasPractices ? (
          <div style={practiceSectionsStyle}>
            {upcomingPractices.length ? (
              <PracticeList
                label="Upcoming"
                practices={upcomingPractices}
                deletingPracticeId={deletingPracticeId}
                expandedPracticeId={expandedPracticeId}
                practiceConfirmationSaving={practiceConfirmationSaving}
                onToggleRoster={(practiceId) => setExpandedPracticeId((current) => current === practiceId ? '' : practiceId)}
                onConfirmPlayer={confirmPracticePlayer}
                onDelete={deletePractice}
              />
            ) : (
              <div style={noticeStyle}>No upcoming practice yet. Create one when the team is ready.</div>
            )}
            {recentPractices.length ? (
              <PracticeList
                label="Recent"
                practices={recentPractices}
                compact
                deletingPracticeId={deletingPracticeId}
                expandedPracticeId={expandedPracticeId}
                practiceConfirmationSaving={practiceConfirmationSaving}
                onToggleRoster={(practiceId) => setExpandedPracticeId((current) => current === practiceId ? '' : practiceId)}
                onConfirmPlayer={confirmPracticePlayer}
                onDelete={deletePractice}
              />
            ) : null}
          </div>
        ) : null}

        {!practicesLoading && !hasPractices ? (
          <div style={noticeStyle}>Your practice list will live here after you send the first invite.</div>
        ) : null}
      </section>

      {(showCreate || (!practicesLoading && !hasPractices)) ? (
      <section style={workspaceStyle} aria-label="Practice scheduler setup">
        {levelUpChallenge ? (
          <div style={challengeLoadedStyle} role="status">
            <div style={challengeLoadedCopyStyle}>
              <span style={sectionEyebrowStyle}>Challenge loaded</span>
              <strong>{levelUpChallenge.title}</strong>
              <span>Practice focus is filled in. Set the date, adjust it if needed, and schedule.</span>
            </div>
            <button type="button" onClick={() => setLevelUpChallenge(null)} style={challengeDoneButtonStyle}>Done</button>
          </div>
        ) : null}
        <div style={panelHeaderStyle}>
          <div>
            <div style={sectionEyebrowStyle}>New practice</div>
            <h2 style={sectionTitleStyle}>Create the practice invite.</h2>
          </div>
          <span style={statusPillStyle}>{canSchedule ? 'Ready to schedule' : 'Team and date needed'}</span>
        </div>

        <div style={fieldGridStyle}>
          <label style={fieldStyle}>
            Team
            <input value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="Team name" style={inputStyle} />
          </label>
          <label style={fieldStyle}>
            League
            <input value={leagueName} onChange={(event) => setLeagueName(event.target.value)} placeholder="Optional league" style={inputStyle} />
          </label>
          <label style={fieldStyle}>
            Flight
            <input value={flight} onChange={(event) => setFlight(event.target.value)} placeholder="Optional flight" style={inputStyle} />
          </label>
          <label style={fieldStyle}>
            Date
            <input type="date" value={practiceDate} onChange={(event) => setPracticeDate(event.target.value)} style={inputStyle} />
          </label>
          <label style={fieldStyle}>
            Start time
            <input type="time" value={practiceTime} onChange={(event) => setPracticeTime(event.target.value)} style={inputStyle} />
          </label>
          <label style={fieldStyle}>
            End time
            <input type="time" min={practiceTime || undefined} value={practiceEndTime} onChange={(event) => setPracticeEndTime(event.target.value)} style={inputStyle} />
          </label>
          <label style={fieldStyle}>
            Site
            <input value={facility} onChange={(event) => setFacility(event.target.value)} placeholder="Courts or club" style={inputStyle} />
          </label>
        </div>

        <label style={fieldStyle}>
          Practice focus
          <textarea
            value={practiceFocus}
            onChange={(event) => setPracticeFocus(event.target.value)}
            placeholder="Examples: doubles patterns, second serves, live-ball points, court assignments..."
            style={textareaStyle}
          />
        </label>

        <div style={actionRowStyle}>
          {teamName.trim() ? (
            <ScheduleMessageComposer
              mode="captain-practice"
              triggerLabel="Review & send invite"
              teamName={teamName}
              leagueName={leagueName}
              flight={flight}
              defaultDate={practiceDate}
              defaultTime={practiceTime}
              defaultEndTime={practiceEndTime}
              defaultFacility={facility}
              defaultNotes={practiceNotes}
            />
          ) : (
            <button type="button" disabled style={{ ...disabledButtonStyle }}>Enter team first</button>
          )}
        </div>

        <div style={hintGridStyle}>
          {practiceHints.map((hint) => (
            <div key={hint.title} style={hintCardStyle}>
              <strong>{hint.title}</strong>
              <span>{hint.detail}</span>
            </div>
          ))}
        </div>
      </section>
      ) : null}

      <section style={heroStyle}>
        <span aria-hidden="true" style={watermarkStyle} />
        <div style={heroCopyStyle}>
          <div style={eyebrowStyle}>Captain practice</div>
          <h1 style={titleStyle}>Plan practice without a separate thread.</h1>
          <p style={textStyle}>
            Pick the date, time, location, and focus. TiQ gives you one group-text link that lets teammates and guest players build the practice roster together.
          </p>
          <div style={proofGridStyle}>
            <ProofItem label="Invite" value="Open link" />
            <ProofItem label="Responses" value="In / Out / Maybe" />
            <ProofItem label="Thread" value="Messages" />
          </div>
        </div>
        <div style={heroPanelStyle}>
          <TiqFeatureIcon name="schedule" size="lg" variant="surface" />
          <strong>Your practice roster builds itself.</strong>
          <span>Teammates and guests mark In, Out, or Maybe, see who is coming, and keep the plan together.</span>
        </div>
      </section>
    </main>
  )
}

function PracticeList({
  label,
  practices,
  compact = false,
  deletingPracticeId,
  expandedPracticeId,
  practiceConfirmationSaving,
  onToggleRoster,
  onConfirmPlayer,
  onDelete,
}: {
  label: string
  practices: CaptainPracticeManagementOverview[]
  compact?: boolean
  deletingPracticeId: string
  expandedPracticeId: string
  practiceConfirmationSaving: string
  onToggleRoster: (practiceId: string) => void
  onConfirmPlayer: (practice: CaptainPracticeManagementOverview, inviteeId: string, confirmed: boolean) => void
  onDelete: (practice: CaptainPracticeManagementOverview) => void
}) {
  return (
    <section style={practiceListSectionStyle} aria-label={`${label} practices`}>
      <div style={practiceListHeaderStyle}>
        <strong>{label}</strong>
        <span>{practices.length}</span>
      </div>
      <div style={practiceListStyle}>
        {practices.map((practice) => {
          const { event, roster } = practice
          const signedUpPlayers = roster?.roster.filter((player) => player.responseStatus === 'in') || []
          const signedUp = signedUpPlayers.length
          const confirmed = signedUpPlayers.filter((player) => player.captainConfirmed).length
          const needsConfirmation = Math.max(0, signedUp - confirmed)
          const waiting = roster?.roster.filter((player) => player.displayStatus === 'unanswered').length || 0
          const endTime = event.metadata.practiceEndTime || event.metadata.scheduleEndTime || ''
          const expanded = expandedPracticeId === event.id
          return (
            <article key={event.id} style={{ ...practiceCardStyle, ...(compact ? compactPracticeCardStyle : {}) }}>
              <div style={practiceCardCopyStyle}>
                <span style={practiceDateStyle}>{formatPracticeDate(event.scheduledDate)}</span>
                <strong style={practiceTitleStyle}>{event.title || 'Team practice'}</strong>
                <span style={practiceMetaStyle}>
                  {[formatPracticeTime(event.scheduledTime, endTime), event.facility].filter(Boolean).join(' · ') || 'Time and site not set'}
                </span>
              </div>
              <div style={practiceCountsStyle} aria-label="Practice response summary">
                <PracticeCount value={signedUp} label="signed up" />
                <PracticeCount value={confirmed} label="confirmed" accent />
                <PracticeCount value={needsConfirmation} label="to confirm" attention={needsConfirmation > 0} />
                <PracticeCount value={waiting} label="awaiting reply" />
              </div>
              <div style={practiceActionsStyle}>
                <button
                  type="button"
                  onClick={() => onToggleRoster(event.id)}
                  aria-expanded={expanded}
                  aria-controls={`practice-roster-${event.id}`}
                  style={manageButtonStyle}
                >
                  {expanded ? 'Close roster' : needsConfirmation ? `Confirm ${needsConfirmation} player${needsConfirmation === 1 ? '' : 's'}` : 'Manage roster'}
                </button>
                {roster?.publicToken ? (
                  <Link href={practiceRsvpPath(roster.publicToken)} style={secondaryButtonStyle}>
                    Open signup
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={() => onDelete({ event, roster })}
                  disabled={Boolean(deletingPracticeId)}
                  style={deleteButtonStyle}
                >
                  {deletingPracticeId === event.id ? 'Deleting...' : 'Delete practice'}
                </button>
              </div>
              {expanded ? (
                <PracticeRosterManager
                  practice={practice}
                  savingInviteeId={practiceConfirmationSaving}
                  onConfirmPlayer={onConfirmPlayer}
                />
              ) : null}
            </article>
          )
        })}
      </div>
    </section>
  )
}

function PracticeCount({ value, label, accent = false, attention = false }: { value: number; label: string; accent?: boolean; attention?: boolean }) {
  return (
    <span style={{ ...practiceCountStyle, ...(accent ? practiceCountAccentStyle : {}), ...(attention ? practiceCountAttentionStyle : {}) }}>
      <strong>{value}</strong> {label}
    </span>
  )
}

function PracticeRosterManager({
  practice,
  savingInviteeId,
  onConfirmPlayer,
}: {
  practice: CaptainPracticeManagementOverview
  savingInviteeId: string
  onConfirmPlayer: (practice: CaptainPracticeManagementOverview, inviteeId: string, confirmed: boolean) => void
}) {
  const roster = practice.roster?.roster || []
  const signedUp = roster.filter((player) => player.responseStatus === 'in')
  const needsConfirmation = signedUp.filter((player) => !player.captainConfirmed)
  const confirmed = signedUp.filter((player) => player.captainConfirmed)
  const waiting = roster.filter((player) => player.displayStatus === 'unanswered')
  const maybe = roster.filter((player) => player.displayStatus === 'maybe')
  const out = roster.filter((player) => player.displayStatus === 'out')

  return (
    <section id={`practice-roster-${practice.event.id}`} style={practiceRosterManagerStyle} aria-label={`Manage roster for ${practice.event.title || 'practice'}`}>
      <div style={practiceRosterHeaderStyle}>
        <div style={practiceRosterHeaderCopyStyle}>
          <span style={sectionEyebrowStyle}>Practice roster</span>
          <strong style={practiceRosterTitleStyle}>
            {needsConfirmation.length
              ? `${needsConfirmation.length} signup${needsConfirmation.length === 1 ? '' : 's'} need your confirmation.`
              : confirmed.length
                ? 'Everyone who signed up is confirmed.'
                : 'Waiting for the first signup.'}
          </strong>
          <span style={practiceRosterHelpStyle}>Players choose “In.” You confirm who has a spot. Confirmed players stay highlighted here and on the signup page.</span>
        </div>
        <div style={practiceRosterProgressStyle} aria-live="polite" aria-label={`${confirmed.length} of ${signedUp.length} signed-up players confirmed`}>
          <strong>{confirmed.length}/{signedUp.length}</strong>
          <span>confirmed</span>
        </div>
      </div>

      {signedUp.length ? (
        <div style={practicePlayerListStyle} aria-label="Signed-up practice players">
          {[...needsConfirmation, ...confirmed].map((player) => (
            <div key={player.id} style={{ ...practicePlayerRowStyle, ...(player.captainConfirmed ? practicePlayerConfirmedStyle : {}) }}>
              <div style={practicePlayerCopyStyle}>
                <strong>{player.playerName}</strong>
                <span style={player.captainConfirmed ? confirmedStatusStyle : needsConfirmationStatusStyle}>
                  {player.captainConfirmed ? 'Confirmed by you' : player.displayStatus === 'waitlist' ? 'Waitlisted · needs your decision' : 'Signed up · needs your confirmation'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onConfirmPlayer(practice, player.id, !player.captainConfirmed)}
                disabled={Boolean(savingInviteeId)}
                aria-label={player.captainConfirmed ? `Remove ${player.playerName}'s practice confirmation` : `Confirm ${player.playerName} for practice`}
                style={player.captainConfirmed ? undoConfirmationButtonStyle : confirmPlayerButtonStyle}
              >
                {savingInviteeId === player.id ? 'Saving...' : player.captainConfirmed ? 'Undo' : 'Confirm spot'}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div style={practiceRosterEmptyStyle}>No one has selected “In” yet. Share the signup link or check back after players reply.</div>
      )}

      <details style={otherRepliesStyle}>
        <summary>Other responses · {waiting.length + maybe.length + out.length}</summary>
        <div style={otherReplyListStyle}>
          <PracticeReplyGroup label="Awaiting reply" players={waiting.map((player) => player.playerName)} />
          <PracticeReplyGroup label="Maybe" players={maybe.map((player) => player.playerName)} />
          <PracticeReplyGroup label="Out" players={out.map((player) => player.playerName)} />
        </div>
      </details>

      <div style={practiceRosterFooterStyle}>
        {practice.roster?.publicToken ? (
          <Link href={practiceRsvpPath(practice.roster.publicToken)} style={secondaryButtonStyle}>Open player signup</Link>
        ) : null}
        <Link
          href={`/messages?thread=${encodeURIComponent(practice.event.conversationId)}&event=${encodeURIComponent(practice.event.id)}`}
          style={secondaryButtonStyle}
        >
          Open team chat
        </Link>
      </div>
    </section>
  )
}

function PracticeReplyGroup({ label, players }: { label: string; players: string[] }) {
  return (
    <div style={otherReplyRowStyle}>
      <strong>{label}</strong>
      <span>{players.length ? players.join(', ') : 'None'}</span>
    </div>
  )
}

function formatPracticeDate(value: string) {
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(date)
}

function formatPracticeTime(startTime: string, endTime: string) {
  const format = (value: string) => {
    const [hourValue, minuteValue] = value.split(':').map(Number)
    if (!Number.isFinite(hourValue) || !Number.isFinite(minuteValue)) return value
    const suffix = hourValue >= 12 ? 'PM' : 'AM'
    const hour = hourValue % 12 || 12
    return `${hour}:${String(minuteValue).padStart(2, '0')} ${suffix}`
  }
  if (!startTime) return ''
  return endTime ? `${format(startTime)}–${format(endTime)}` : format(startTime)
}

function ProofItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={proofItemStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

const practiceHints = [
  {
    title: 'Invite the whole team',
    detail: 'Send one link in your group text. Teammates choose their name; guest players can add theirs.',
  },
  {
    title: 'Keep it specific',
    detail: 'Add the court, focus, rain plan, or arrival note so players know what the practice is for.',
  },
  {
    title: 'See the practice roster',
    detail: 'In, Maybe, Out, and Waiting stay visible so you know who is coming before you reserve courts.',
  },
]

const pageStyle: CSSProperties = {
  width: 'min(1180px, calc(100% - clamp(24px, 5vw, 40px)))',
  margin: '0 auto',
  padding: '16px 0 42px',
  display: 'grid',
  gap: 16,
  minWidth: 0,
  overflowX: 'clip',
}

const heroStyle: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
  gap: 16,
  alignItems: 'stretch',
  padding: 22,
  borderRadius: 28,
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'var(--portal-surface-bg)',
  boxShadow: '0 24px 70px rgba(2, 8, 23, 0.42)',
  minWidth: 0,
}

const watermarkStyle: CSSProperties = {
  position: 'absolute',
  right: '-110px',
  top: '-120px',
  width: 320,
  aspectRatio: '1552 / 1614',
  background: 'url("/brand/web/header-iq-compact.png") center / contain no-repeat',
  opacity: 0.14,
  pointerEvents: 'none',
}

const heroCopyStyle: CSSProperties = {
  position: 'relative',
  display: 'grid',
  gap: 12,
  alignContent: 'center',
  minWidth: 0,
}

const eyebrowStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const titleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(2rem, 4vw, 4rem)',
  lineHeight: 0.98,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const textStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 15,
  lineHeight: 1.7,
  fontWeight: 750,
  maxWidth: 760,
}

const proofGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const proofItemStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 900,
  textTransform: 'uppercase',
}

const heroPanelStyle: CSSProperties = {
  position: 'relative',
  display: 'grid',
  gap: 10,
  alignContent: 'center',
  minWidth: 0,
  padding: 18,
  borderRadius: 20,
  border: '1px solid rgba(155,225,29,0.24)',
  background: 'linear-gradient(145deg, rgba(155,225,29,0.12), rgba(116,190,255,0.07) 58%, rgba(15,23,42,0.62))',
  color: 'var(--foreground-strong)',
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 850,
  overflowWrap: 'anywhere',
}

const workspaceStyle: CSSProperties = {
  display: 'grid',
  gap: 16,
  minWidth: 0,
  padding: 18,
  borderRadius: 24,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'linear-gradient(180deg, rgba(12,26,50,0.82) 0%, rgba(9,20,39,0.92) 100%)',
  boxShadow: '0 18px 46px rgba(2,10,24,0.18)',
}

const practiceSectionsStyle: CSSProperties = {
  display: 'grid',
  gap: 18,
  minWidth: 0,
}

const practiceListSectionStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
}

const practiceListHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  color: 'var(--brand-blue-2)',
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
}

const practiceListStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 310px), 1fr))',
  gap: 12,
  minWidth: 0,
}

const practiceCardStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  minWidth: 0,
  padding: 16,
  borderRadius: 20,
  border: '1px solid rgba(155,225,29,0.25)',
  background: 'linear-gradient(145deg, rgba(155,225,29,0.09), rgba(116,190,255,0.055) 62%, rgba(15,23,42,0.56))',
}

const compactPracticeCardStyle: CSSProperties = {
  borderColor: 'rgba(116,190,255,0.13)',
  background: 'rgba(255,255,255,0.035)',
}

const practiceCardCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
}

const practiceDateStyle: CSSProperties = {
  color: '#9be11d',
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const practiceTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 19,
  lineHeight: 1.18,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const practiceMetaStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 760,
  overflowWrap: 'anywhere',
}

const practiceCountsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 7,
  minWidth: 0,
}

const practiceCountStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'baseline',
  gap: 4,
  minHeight: 30,
  padding: '5px 9px',
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 850,
  whiteSpace: 'nowrap',
}

const practiceCountAccentStyle: CSSProperties = {
  borderColor: 'rgba(155,225,29,0.28)',
  color: 'var(--foreground-strong)',
  background: 'rgba(155,225,29,0.08)',
}

const practiceCountAttentionStyle: CSSProperties = {
  borderColor: 'rgba(251,191,36,0.34)',
  color: '#fde68a',
  background: 'rgba(251,191,36,0.08)',
}

const practiceActionsStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 130px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const manageButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 0,
  minHeight: 46,
  padding: '0 14px',
  borderRadius: 14,
  border: '1px solid rgba(155,225,29,0.5)',
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  color: 'var(--foreground-strong)',
  fontSize: 13,
  fontWeight: 950,
  textAlign: 'center',
  textDecoration: 'none',
  cursor: 'pointer',
}

const practiceRosterManagerStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(116,190,255,0.2)',
  background: 'rgba(5,15,31,0.7)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.035)',
}

const practiceRosterHeaderStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'start',
  gap: 12,
  minWidth: 0,
}

const practiceRosterHeaderCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
}

const practiceRosterTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 17,
  lineHeight: 1.25,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const practiceRosterHelpStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.5,
  fontWeight: 740,
}

const practiceRosterProgressStyle: CSSProperties = {
  display: 'grid',
  justifyItems: 'center',
  gap: 1,
  minWidth: 70,
  padding: '9px 10px',
  borderRadius: 14,
  border: '1px solid rgba(155,225,29,0.28)',
  background: 'rgba(155,225,29,0.08)',
  color: 'var(--foreground-strong)',
  fontSize: 10,
  fontWeight: 900,
  textTransform: 'uppercase',
}

const practicePlayerListStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
}

const practicePlayerRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: 10,
  minWidth: 0,
  padding: 12,
  borderRadius: 15,
  border: '1px solid rgba(251,191,36,0.22)',
  background: 'rgba(251,191,36,0.055)',
}

const practicePlayerConfirmedStyle: CSSProperties = {
  borderColor: 'rgba(155,225,29,0.34)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.12), rgba(116,190,255,0.045))',
}

const practicePlayerCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
  color: 'var(--foreground-strong)',
  fontSize: 14,
  lineHeight: 1.3,
  overflowWrap: 'anywhere',
}

const needsConfirmationStatusStyle: CSSProperties = {
  color: '#fde68a',
  fontSize: 11,
  fontWeight: 850,
}

const confirmedStatusStyle: CSSProperties = {
  color: '#c9ff6a',
  fontSize: 11,
  fontWeight: 900,
}

const confirmPlayerButtonStyle: CSSProperties = {
  minHeight: 42,
  padding: '0 12px',
  borderRadius: 12,
  border: '1px solid rgba(155,225,29,0.5)',
  background: 'rgba(155,225,29,0.16)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 950,
  cursor: 'pointer',
}

const undoConfirmationButtonStyle: CSSProperties = {
  ...confirmPlayerButtonStyle,
  borderColor: 'rgba(116,190,255,0.2)',
  background: 'rgba(255,255,255,0.045)',
}

const practiceRosterEmptyStyle: CSSProperties = {
  padding: 13,
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(255,255,255,0.035)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.5,
  fontWeight: 760,
}

const otherRepliesStyle: CSSProperties = {
  minWidth: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 850,
}

const otherReplyListStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  marginTop: 10,
}

const otherReplyRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(90px, auto) minmax(0, 1fr)',
  gap: 10,
  minWidth: 0,
  padding: '9px 10px',
  borderRadius: 12,
  background: 'rgba(255,255,255,0.035)',
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  lineHeight: 1.4,
  overflowWrap: 'anywhere',
}

const practiceRosterFooterStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 135px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const secondaryButtonStyle: CSSProperties = {
  ...manageButtonStyle,
  border: '1px solid rgba(116,190,255,0.2)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--foreground-strong)',
}

const primaryButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 44,
  padding: '0 14px',
  borderRadius: 14,
  border: '1px solid rgba(155,225,29,0.34)',
  background: 'rgba(155,225,29,0.11)',
  color: 'var(--foreground-strong)',
  fontSize: 13,
  fontWeight: 950,
  cursor: 'pointer',
}

const noticeStyle: CSSProperties = {
  minWidth: 0,
  padding: 14,
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(255,255,255,0.035)',
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 780,
}

const errorStyle: CSSProperties = {
  ...noticeStyle,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 10,
  borderColor: 'rgba(251,113,133,0.32)',
  color: '#fecdd3',
}

const successStyle: CSSProperties = {
  ...noticeStyle,
  borderColor: 'rgba(155,225,29,0.28)',
  color: 'var(--foreground-strong)',
  background: 'rgba(155,225,29,0.07)',
}

const textButtonStyle: CSSProperties = {
  minHeight: 40,
  padding: '0 12px',
  borderRadius: 12,
  border: '1px solid rgba(251,113,133,0.3)',
  background: 'rgba(255,255,255,0.04)',
  color: 'inherit',
  fontWeight: 900,
  cursor: 'pointer',
}

const deleteButtonStyle: CSSProperties = {
  ...secondaryButtonStyle,
  borderColor: 'rgba(251,113,133,0.3)',
  color: '#fecdd3',
  cursor: 'pointer',
}

const challengeLoadedStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 14,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(151, 255, 49, 0.28)',
  background: 'rgba(151, 255, 49, 0.07)',
  minWidth: 0,
}

const challengeLoadedCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
  color: 'var(--text-secondary)',
  lineHeight: 1.45,
}

const challengeDoneButtonStyle: CSSProperties = {
  flex: '0 0 auto',
  border: '1px solid rgba(151, 255, 49, 0.3)',
  borderRadius: 999,
  background: 'rgba(6, 18, 35, 0.58)',
  color: 'var(--text-primary)',
  padding: '9px 14px',
  fontWeight: 900,
  cursor: 'pointer',
}

const panelHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
  flexWrap: 'wrap',
  minWidth: 0,
}

const sectionEyebrowStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const sectionTitleStyle: CSSProperties = {
  margin: '4px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 24,
  lineHeight: 1.05,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const statusPillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 32,
  padding: '0 11px',
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.22)',
  background: 'rgba(155,225,29,0.08)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 950,
}

const fieldGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  minWidth: 0,
  color: 'var(--brand-blue-2)',
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const inputStyle: CSSProperties = {
  width: '100%',
  minWidth: 0,
  minHeight: 44,
  padding: '0 12px',
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'rgba(15,23,42,0.66)',
  color: 'var(--foreground-strong)',
  fontSize: 14,
  fontWeight: 750,
  outline: 'none',
  boxSizing: 'border-box',
}

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 104,
  padding: 12,
  resize: 'vertical',
  lineHeight: 1.45,
}

const actionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 9,
  minWidth: 0,
}

const disabledButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 38,
  padding: '0 13px',
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 900,
}

const hintGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const hintCardStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  minWidth: 0,
  padding: 14,
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 780,
  overflowWrap: 'anywhere',
}
