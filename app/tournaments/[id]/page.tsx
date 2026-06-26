'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import SiteShell from '@/app/components/site-shell'
import DataTrustPanel from '@/app/components/data-trust-panel'
import PublicDetailState from '@/app/components/public-detail-state'
import TiqTrustStrip from '@/app/components/tiq-trust-strip'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import { getPlayerDevelopmentIdentity, getPlayerDevelopmentIdentityActionRead } from '@/lib/player-development'
import { loadTiqAwardsForSource, type TiqAwardRecord } from '@/lib/tiq-awards-registry'
import {
  buildRoundRobinStandings,
  buildTournamentPreview,
  loadTiqTournamentRecord,
  submitTiqTournamentEntry,
  summarizeTournamentResults,
  type TiqTournamentMatchSchedule,
  type TiqTournamentRecord,
} from '@/lib/tiq-tournament-registry'

export const dynamic = 'force-dynamic'

const TOURNAMENT_DETAIL_PLAYER_IDENTITY = getPlayerDevelopmentIdentity('pressure-closer-4-0')
const TOURNAMENT_DETAIL_PLAYER_IDENTITY_READ = getPlayerDevelopmentIdentityActionRead(TOURNAMENT_DETAIL_PLAYER_IDENTITY)
const TOURNAMENT_DETAIL_LEVEL_UP_HREF = `/level-up/${TOURNAMENT_DETAIL_PLAYER_IDENTITY.slug}#level-up-flow`
const TOURNAMENT_DETAIL_PLAYER_DEVELOPMENT_HREF = `/player-development/${TOURNAMENT_DETAIL_PLAYER_IDENTITY.slug}`
const tournamentDetailPlayerIdItems = [
  { label: 'Match-day read', value: TOURNAMENT_DETAIL_PLAYER_IDENTITY_READ.matchTrigger },
  { label: 'Pressure proof', value: TOURNAMENT_DETAIL_PLAYER_IDENTITY_READ.proofTarget },
  { label: 'Next cue', value: TOURNAMENT_DETAIL_PLAYER_IDENTITY_READ.nextCue },
] as const
const tournamentDetailPlayerIdActions = [
  { href: TOURNAMENT_DETAIL_LEVEL_UP_HREF, label: 'Start Level Up' },
  { href: TOURNAMENT_DETAIL_PLAYER_DEVELOPMENT_HREF, label: 'Read Player ID' },
  { href: '/matchup', label: 'Prep matchup' },
] as const

export default function TournamentPublicPage() {
  return (
    <SiteShell active="/league-coordinator">
      <TournamentPublicInner />
    </SiteShell>
  )
}

function TournamentPublicInner() {
  const params = useParams<{ id: string }>()
  const tournamentId = decodeURIComponent(params?.id || '')
  const [record, setRecord] = useState<TiqTournamentRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [source, setSource] = useState<'cloud' | 'local' | 'none'>('none')
  const [awards, setAwards] = useState<TiqAwardRecord[]>([])
  const [entryName, setEntryName] = useState('')
  const [entryEmail, setEntryEmail] = useState('')
  const [entryPhone, setEntryPhone] = useState('')
  const [entryRating, setEntryRating] = useState('3.5')
  const [entrySmsOptIn, setEntrySmsOptIn] = useState(false)
  const [entryNotice, setEntryNotice] = useState('')
  const [entrySubmitting, setEntrySubmitting] = useState(false)
  const [entryFocusedField, setEntryFocusedField] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadRecord() {
      setLoading(true)
      setError('')
      const result = await loadTiqTournamentRecord(tournamentId)
      if (!active) return
      setRecord(result.data)
      setSource(result.source)
      setError(result.error?.message || (!result.data ? 'Tournament page is not available.' : ''))
      setLoading(false)
    }

    void loadRecord()

    return () => {
      active = false
    }
  }, [tournamentId])

  useEffect(() => {
    let active = true

    async function loadAwards() {
      const result = await loadTiqAwardsForSource('tournament', tournamentId)
      if (!active) return
      setAwards(result.data)
    }

    void loadAwards()

    return () => {
      active = false
    }
  }, [tournamentId])

  const matches = useMemo(() => record ? buildTournamentPreview(record) : [], [record])
  const summary = useMemo(() => record ? summarizeTournamentResults(record) : null, [record])
  const standings = useMemo(() => record?.format === 'round_robin' ? buildRoundRobinStandings(record) : [], [record])
  const scheduledMatches = useMemo(
    () => matches.filter((match) => match.schedule?.date || match.schedule?.time || match.schedule?.court),
    [matches],
  )
  const groupedMatches = useMemo(() => {
    const groups = new Map<number, typeof matches>()
    for (const match of matches) {
      groups.set(match.round, [...(groups.get(match.round) || []), match])
    }
    return [...groups.entries()].sort(([left], [right]) => left - right)
  }, [matches])
  const tournamentStatus = record ? getPublicTournamentStatus(record, summary?.completedMatches ?? 0, summary?.totalMatches ?? 0) : null
  const podiumSummary = useMemo(() => buildTournamentPodiumSummary(awards), [awards])
  const publicReadinessItems = record ? [
    {
      label: 'Field',
      value: `${record.entrants.length} ${record.entrantType}`,
      ready: record.entrants.length >= 2,
    },
    {
      label: 'Schedule',
      value: scheduledMatches.length ? `${scheduledMatches.length} posted` : 'TBD',
      ready: scheduledMatches.length > 0,
    },
    {
      label: 'Results',
      value: `${summary?.completedMatches ?? 0}/${summary?.totalMatches ?? 0}`,
      ready: (summary?.totalMatches ?? 0) > 0 && (summary?.completedMatches ?? 0) === (summary?.totalMatches ?? 0),
    },
    {
      label: 'Awards',
      value: awards.length ? `${awards.length} live` : 'After finish',
      ready: awards.length > 0,
    },
  ] : []
  const matchDayActions: Array<{
    href: string
    icon: TiqFeatureIconName
    label: string
    value: string
  }> = record ? [
    {
      href: `/tournaments/${encodeURIComponent(record.id)}/preferences`,
      icon: 'messagingCenter',
      label: 'Texts',
      value: scheduledMatches.length ? 'Court alerts' : 'Opt in',
    },
    {
      href: '/players',
      icon: 'playerRatings',
      label: 'Profile',
      value: 'Find yours',
    },
    {
      href: awards.length ? '#podium' : '#draw',
      icon: awards.length ? 'teamRankings' : 'schedule',
      label: awards.length ? 'Podium' : 'Draw',
      value: awards.length ? `${awards.length} awards` : `${summary?.completedMatches ?? 0}/${summary?.totalMatches ?? 0} results`,
    },
  ] : []

  async function submitEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setEntryNotice('')
    setEntrySubmitting(true)

    const result = await submitTiqTournamentEntry({
      tournamentId,
      playerName: entryName,
      email: entryEmail,
      phone: entryPhone,
      selfRating: Number.parseFloat(entryRating),
      smsOptIn: entrySmsOptIn,
      consentNote: entrySmsOptIn ? 'Public tournament entry opt-in' : '',
    })

    setEntrySubmitting(false)

    if (result.error) {
      setEntryNotice(result.error.message)
      return
    }

    setEntryName('')
    setEntryEmail('')
    setEntryPhone('')
    setEntryRating('3.5')
    setEntrySmsOptIn(false)
    setEntryNotice('Entry submitted. The director will approve players into the draw.')
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        <PublicDetailState
          eyebrow="Tournament"
          title="Opening tournament details."
          body="Checking divisions, entries, draws, court schedule, results, and player notification paths."
          signals={[
            { label: 'Source', value: 'Tournament Desk and director updates' },
            { label: 'Freshness', value: 'Live event record' },
            { label: 'Status', value: 'Players can report issues' },
          ]}
          actions={[
            { href: '/tournaments', label: 'Find Tournaments' },
            { href: '/league-coordinator/tournaments', label: 'Open Tournament Desk' },
          ]}
        />
      </main>
    )
  }

  if (!record) {
    return (
      <main style={pageStyle}>
        <PublicDetailState
          eyebrow="Tournament"
          title="Bracket unavailable."
          body={error || 'This tournament is private, unpublished, or no longer exists.'}
          signals={[
            { label: 'Source', value: 'Tournament Desk lookup' },
            { label: 'Freshness', value: 'Checked now' },
            { label: 'Status', value: 'Needs director publish or review' },
          ]}
          actions={[
            { href: '/tournaments', label: 'Find Tournaments' },
            { href: '/league-coordinator/tournaments', label: 'Open Tournament Desk' },
          ]}
        />
      </main>
    )
  }

  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <span aria-hidden="true" style={watermarkStyle} />
        <div style={heroCopyStyle}>
          <div style={eyebrowStyle}>Tournament hub</div>
          <h1 style={titleStyle}>{record.name}</h1>
          <p style={textStyle}>
            {[record.format.replace('_', ' '), record.entrantType, record.startsOn || 'Date TBD', record.locationLabel]
              .filter(Boolean)
              .join(' | ')}
          </p>
          <div style={statGridStyle}>
            <Stat label="Entrants" value={String(record.entrants.length)} />
            <Stat label="Matches" value={String(summary?.totalMatches ?? 0)} />
            <Stat label="Completed" value={`${summary?.completedMatches ?? 0}/${summary?.totalMatches ?? 0}`} />
            <Stat label="Champion" value={summary?.champion || 'TBD'} />
          </div>
          <div style={actionRowStyle}>
            {record.isPublic ? <a href="#enter-tournament" style={primaryButtonStyle}>Enter tournament</a> : null}
            <a href="#draw" style={secondaryButtonStyle}>View draw</a>
            <span style={pillStyle}>{source === 'cloud' ? (record.isPublic ? 'Public' : 'Director view') : 'Device preview'}</span>
          </div>
        </div>
        <div style={heroPanelStyle}>
          <TiqFeatureIcon name="teamRankings" size="lg" variant="surface" />
          <strong>{summary?.champion ? `${summary.champion} leads the finish.` : tournamentStatus?.label || 'The path is open.'}</strong>
          <span>{record.directorNotes || 'Match results appear here as the director updates the scorebook.'}</span>
        </div>
      </section>

      {tournamentStatus ? (
        <section style={statusRailStyle} aria-label="Tournament status">
          <div style={statusHeroStyle}>
            <span style={statusDotStyle} />
            <div>
              <div style={eyebrowStyle}>Status</div>
              <strong>{tournamentStatus.label}</strong>
              <span>{tournamentStatus.detail}</span>
            </div>
          </div>
          <div style={statusGridStyle}>
            <Stat label="Scheduled" value={`${scheduledMatches.length}/${summary?.totalMatches ?? 0}`} />
            <Stat label="Results" value={`${summary?.completedMatches ?? 0}/${summary?.totalMatches ?? 0}`} />
            <Stat label="Awards" value={awards.length ? `${awards.length}` : 'TBD'} />
          </div>
        </section>
      ) : null}

      <DataTrustPanel
        title="Tournament data trust"
        body="Tournament pages combine Tournament Desk setup, director-posted schedules, entries, scorebook results, and awards when available. Use Data Assist when a draw, result, player entry, or award needs review."
        signals={[
          { label: 'Source', value: 'Tournament Desk, director updates, scorebook results' },
          { label: 'Freshness', value: source === 'cloud' ? 'Cloud record loaded' : 'Device preview or pending sync' },
          { label: 'Confidence', value: 'Higher after scorebook and awards review' },
          { label: 'Status', value: 'Report, upload, or request review through Data Assist' },
        ]}
      />
      <TiqTrustStrip
        label={`${record.name} compact data trust signals`}
        signals={[
          { label: 'Source', value: source === 'cloud' ? 'Tournament Desk' : 'Device preview', tone: source === 'cloud' ? 'good' : 'warn' },
          { label: 'Freshness', value: source === 'cloud' ? 'Cloud record loaded' : 'Pending sync', tone: source === 'cloud' ? 'good' : 'warn' },
          { label: 'Confidence', value: summary?.completedMatches ? 'Results reviewed' : 'Limited until scores', tone: summary?.completedMatches ? 'good' : 'warn' },
          { label: 'Status', value: record.isPublic ? 'Public / reviewable' : 'Director view', tone: record.isPublic ? 'good' : 'info' },
        ]}
        reviewContext={`Tournament ${record.name}`}
      />

      <section style={playerRailStyle} aria-label="Match-day actions">
        {matchDayActions.map((action) => {
          const content = (
            <>
              <TiqFeatureIcon name={action.icon} size="sm" variant="ghost" />
              <span style={playerRailCopyStyle}>
                <strong>{action.label}</strong>
                <em>{action.value}</em>
              </span>
            </>
          )

          return action.href.startsWith('/') ? (
            <Link key={action.label} href={action.href} style={playerRailCardStyle}>
              {content}
            </Link>
          ) : (
            <a key={action.label} href={action.href} style={playerRailCardStyle}>
              {content}
            </a>
          )
        })}
      </section>

      <section style={tournamentDetailPlayerIdStyle} aria-label="Tournament detail Player ID match-day read">
        <div style={tournamentDetailPlayerIdCopyStyle}>
          <span style={tournamentDetailPlayerIdEyebrowStyle}>Match day to Player ID</span>
          <h2 style={tournamentDetailPlayerIdTitleStyle}>Leave the tournament with one clearer rep.</h2>
          <p style={tournamentDetailPlayerIdTextStyle}>
            {TOURNAMENT_DETAIL_PLAYER_IDENTITY_READ.levelUpNudge} Use this read after checking the draw, court, or result so the next match has one pressure cue.
          </p>
        </div>
        <div style={tournamentDetailPlayerIdGridStyle} aria-label="Tournament detail Player ID starter read">
          {tournamentDetailPlayerIdItems.map((item) => (
            <div key={item.label} style={tournamentDetailPlayerIdCardStyle}>
              <span style={tournamentDetailPlayerIdLabelStyle}>{item.label}</span>
              <strong style={tournamentDetailPlayerIdValueStyle}>{item.value}</strong>
            </div>
          ))}
        </div>
        <div style={tournamentDetailPlayerIdActionRowStyle}>
          {tournamentDetailPlayerIdActions.map((action, index) => (
            <Link
              key={action.href}
              href={action.href}
              style={index === 0 ? { ...tournamentDetailPlayerIdActionStyle, ...tournamentDetailPlayerIdPrimaryActionStyle } : tournamentDetailPlayerIdActionStyle}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </section>

      <section style={publicReadinessStyle} aria-label="Tournament readiness">
        {publicReadinessItems.map((item) => (
          <div key={item.label} style={publicReadinessItemStyle}>
            <span style={item.ready ? readinessDotReadyStyle : readinessDotWaitingStyle} />
            <strong>{item.label}</strong>
            <em>{item.value}</em>
          </div>
        ))}
      </section>

      {standings.length ? (
        <section style={bracketShellStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <div style={eyebrowStyle}>Standings</div>
              <h2 style={sectionTitleStyle}>Round-robin table</h2>
            </div>
            <span style={pillStyle}>{summary?.completedMatches ?? 0} results</span>
          </div>
          <div style={standingsListStyle}>
            {standings.map((row, index) => (
              <div key={row.entrant} style={standingsRowStyle}>
                <span style={standingsRankStyle}>{index + 1}</span>
                <strong>{row.entrant}</strong>
                <span>{row.wins}-{row.losses}</span>
                <span>{row.winPct}%</span>
                <span>{formatGameDiff(row.gameDiff)}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {awards.length ? (
        <section id="podium" style={bracketShellStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <div style={eyebrowStyle}>Podium</div>
              <h2 style={sectionTitleStyle}>Tournament honors</h2>
            </div>
            <div style={sectionActionStyle}>
              <a href={buildTournamentPodiumMailto(record, awards)} style={podiumLinkStyle}>
                Share results
              </a>
              <span style={pillStyle}>{awards.length} issued</span>
            </div>
          </div>
          <div style={podiumSummaryStyle} aria-label="Tournament podium summary">
            <Stat label="Champion" value={podiumSummary.champion} compact />
            <Stat label="Finalist" value={podiumSummary.finalist} compact />
            <Stat label="Certificates" value={String(awards.length)} compact />
          </div>
          <div style={podiumGridStyle}>
            {awards.map((award) => (
              <article key={award.id} style={podiumCardStyle}>
                <div style={podiumBadgeStyle}>{award.badgeCode}</div>
                <div style={podiumCopyStyle}>
                  <strong>{award.recipientName}</strong>
                  <span>{award.title}</span>
                  <small>{award.subtitle || 'More Tennis. Less Chaos.'}</small>
                </div>
                <div style={podiumActionRowStyle}>
                  <Link href={`/awards/${encodeURIComponent(award.id)}`} style={podiumLinkStyle}>
                    Certificate
                  </Link>
                  {award.recipientPlayerId ? (
                    <Link
                      href={`/players/${encodeURIComponent(award.recipientPlayerId)}#profile-trophy-case`}
                      style={podiumLinkStyle}
                    >
                      Trophy case
                    </Link>
                  ) : (
                    <span style={podiumMetaStyle}>Trophy case starts when the player profile is linked.</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {record.isPublic ? (
        <section id="enter-tournament" style={entryShellStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <div style={eyebrowStyle}>Player check-in</div>
              <h2 style={sectionTitleStyle}>Enter tournament</h2>
            </div>
            <span style={pillStyle}>Director approval</span>
          </div>
          <div style={entryCueGridStyle}>
            <span>Self-rated TIQ profile starts here</span>
            <span>Text alerts require consent</span>
            <span>Director approves the draw</span>
          </div>
          <form style={entryGridStyle} onSubmit={submitEntry}>
            <label style={entryFieldStyle}>
              Name
              <input
                value={entryName}
                onChange={(event) => setEntryName(event.target.value)}
                onFocus={() => setEntryFocusedField('name')}
                onBlur={() => setEntryFocusedField(null)}
                style={{
                  ...entryInputStyle,
                  ...(entryFocusedField === 'name' ? entryInputFocusStyle : null),
                }}
              />
            </label>
            <label style={entryFieldStyle}>
              Email
              <input
                type="email"
                value={entryEmail}
                onChange={(event) => setEntryEmail(event.target.value)}
                onFocus={() => setEntryFocusedField('email')}
                onBlur={() => setEntryFocusedField(null)}
                style={{
                  ...entryInputStyle,
                  ...(entryFocusedField === 'email' ? entryInputFocusStyle : null),
                }}
              />
            </label>
            <label style={entryFieldStyle}>
              Phone
              <input
                value={entryPhone}
                onChange={(event) => setEntryPhone(event.target.value)}
                onFocus={() => setEntryFocusedField('phone')}
                onBlur={() => setEntryFocusedField(null)}
                style={{
                  ...entryInputStyle,
                  ...(entryFocusedField === 'phone' ? entryInputFocusStyle : null),
                }}
              />
            </label>
            <label style={entryFieldStyle}>
              Self-rating
              <input
                type="number"
                min="1"
                max="7"
                step="0.1"
                value={entryRating}
                onChange={(event) => setEntryRating(event.target.value)}
                onFocus={() => setEntryFocusedField('rating')}
                onBlur={() => setEntryFocusedField(null)}
                style={{
                  ...entryInputStyle,
                  ...(entryFocusedField === 'rating' ? entryInputFocusStyle : null),
                }}
              />
            </label>
            <label style={entryToggleStyle}>
              <input type="checkbox" checked={entrySmsOptIn} onChange={(event) => setEntrySmsOptIn(event.target.checked)} />
              <span>Text me tournament alerts. Messages include TenAceIQ links and opt-out instructions.</span>
            </label>
            <button type="submit" disabled={entrySubmitting} style={primaryButtonStyle}>
              {entrySubmitting ? 'Submitting...' : 'Submit entry'}
            </button>
            {entryNotice ? <div style={entryNoticeStyle}>{entryNotice}</div> : null}
          </form>
        </section>
      ) : null}

      <section style={bracketShellStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <div style={eyebrowStyle}>Schedule</div>
            <h2 style={sectionTitleStyle}>Court board</h2>
          </div>
          <span style={pillStyle}>{scheduledMatches.length ? `${scheduledMatches.length} posted` : 'TBD'}</span>
        </div>
        {scheduledMatches.length ? (
          <div style={scheduleBoardStyle}>
            {scheduledMatches.slice(0, 8).map((match) => (
              <article key={match.id} style={scheduleCardStyle}>
                <strong>{formatMatchSchedule(match.schedule!)}</strong>
                <span>{match.sideA} vs {match.sideB}</span>
                <small>{match.label}</small>
              </article>
            ))}
          </div>
        ) : (
          <div style={emptyStateStyle}>Court assignments will appear as soon as the director posts match times.</div>
        )}
      </section>

      <section id="draw" style={bracketShellStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <div style={eyebrowStyle}>Draw</div>
            <h2 style={sectionTitleStyle}>{record.format === 'round_robin' ? 'Round robin' : 'Bracket path'}</h2>
          </div>
          <span style={pillStyle}>{record.status}</span>
        </div>

        {groupedMatches.length ? (
          <div style={roundGridStyle}>
            {groupedMatches.map(([round, roundMatches]) => (
            <section key={round} style={roundColumnStyle}>
              <h3 style={roundTitleStyle}>{roundMatches[0]?.label || `Round ${round}`}</h3>
              <div style={matchListStyle}>
                {roundMatches.map((match) => (
                  <article key={match.id} style={matchCardStyle}>
                    <span style={matchMetaStyle}>Court {match.court}</span>
                    <div style={sideRowStyle}>
                      <strong>{match.sideA}</strong>
                      {match.result?.winner === match.sideA ? <span style={winnerPillStyle}>W</span> : null}
                    </div>
                    <div style={sideRowStyle}>
                      <strong>{match.sideB}</strong>
                      {match.result?.winner === match.sideB ? <span style={winnerPillStyle}>W</span> : null}
                    </div>
                    {match.schedule?.date || match.schedule?.time || match.schedule?.court ? (
                      <span style={scheduleStyle}>{formatMatchSchedule(match.schedule)}</span>
                    ) : null}
                    {match.result?.winner ? (
                      <span style={resultStyle}>
                        {match.result.winner}{match.result.score ? ` | ${match.result.score}` : ''}
                      </span>
                    ) : (
                      <span style={waitingStyle}>Awaiting result</span>
                    )}
                  </article>
                ))}
              </div>
            </section>
            ))}
          </div>
        ) : (
          <div style={publicEmptyStateStyle}>
            <TiqFeatureIcon name="schedule" size="sm" variant="ghost" />
            <strong>The draw will land here.</strong>
            <span>Enter the tournament, manage alerts, or check back when the director publishes the bracket.</span>
            <div style={publicEmptyActionRowStyle}>
              {record.isPublic ? <a href="#enter-tournament" style={podiumLinkStyle}>Enter</a> : null}
              <Link href={`/tournaments/${encodeURIComponent(record.id)}/preferences`} style={podiumLinkStyle}>Alert settings</Link>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

function Stat({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div style={compact ? compactStatStyle : statStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function buildTournamentPodiumSummary(awards: TiqAwardRecord[]) {
  const first = awards.find((award) => award.placement === 'first')
  const second = awards.find((award) => award.placement === 'second')
  return {
    champion: first?.recipientName || 'Posted',
    finalist: second?.recipientName || 'Posted',
  }
}

function buildTournamentPodiumMailto(record: TiqTournamentRecord, awards: TiqAwardRecord[]) {
  const summary = buildTournamentPodiumSummary(awards)
  const subject = encodeURIComponent(`TenAceIQ results: ${record.name}`)
  const body = encodeURIComponent([
    `${record.name} results are posted on TenAceIQ.`,
    `Champion: ${summary.champion}`,
    `Finalist: ${summary.finalist}`,
    `Certificates: ${awards.length}`,
    `Open podium: ${buildTournamentPodiumUrl(record.id)}`,
  ].join('\n'))
  return `mailto:?subject=${subject}&body=${body}`
}

function buildTournamentPodiumUrl(tournamentId: string) {
  const path = `/tournaments/${encodeURIComponent(tournamentId)}#podium`
  if (typeof window === 'undefined') return path
  return `${window.location.origin}${path}`
}

function formatGameDiff(value: number) {
  if (value > 0) return `+${value}`
  return String(value)
}

function formatMatchSchedule(schedule: Pick<TiqTournamentMatchSchedule, 'date' | 'time' | 'court'>) {
  return [schedule.date, schedule.time, schedule.court].filter(Boolean).join(' - ')
}

function getPublicTournamentStatus(record: TiqTournamentRecord, completedMatches: number, totalMatches: number) {
  if (record.status === 'completed' || (totalMatches > 0 && completedMatches === totalMatches)) {
    return { label: 'Tournament complete', detail: 'Results and awards are ready to review.' }
  }
  if (completedMatches > 0) {
    return { label: 'In progress', detail: 'Scores are landing as matches finish.' }
  }
  if (record.status === 'scheduled') {
    return { label: 'Schedule posted', detail: 'Check the court board before match time.' }
  }
  if (record.status === 'open' || record.isPublic) {
    return { label: 'Registration open', detail: 'Submit your entry and wait for director approval.' }
  }
  return { label: 'Draw building', detail: 'The director is preparing the field.' }
}

const pageStyle: CSSProperties = {
  width: 'min(1280px, calc(100% - clamp(24px, 5vw, 40px)))',
  margin: '0 auto',
  padding: '14px 0 40px',
  display: 'grid',
  gap: 16,
  minWidth: 0,
  overflowX: 'clip',
}

const heroStyle: CSSProperties = {
  position: 'relative',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
  gap: 16,
  alignItems: 'stretch',
  minWidth: 0,
  overflow: 'hidden',
  padding: 22,
  borderRadius: 28,
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'var(--portal-surface-bg)',
  boxShadow: '0 24px 70px rgba(2, 8, 23, 0.42)',
}

const watermarkStyle: CSSProperties = {
  position: 'absolute',
  right: '-110px',
  top: '-120px',
  width: 320,
  aspectRatio: '1045 / 490',
  background: 'url("/tenaceiq/logos/tenaceiq-symbol-reverse.svg") center / contain no-repeat',
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
  fontSize: 'clamp(2rem, 4vw, 4.1rem)',
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
  overflowWrap: 'anywhere',
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
  background: 'rgba(155,225,29,0.08)',
  color: 'var(--foreground-strong)',
}

const statGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 145px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const statStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 900,
  textTransform: 'uppercase',
  minWidth: 0,
}

const compactStatStyle: CSSProperties = {
  ...statStyle,
  padding: 10,
  border: '1px solid rgba(155,225,29,0.14)',
  background: 'rgba(155,225,29,0.055)',
}

const actionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 9,
  minWidth: 0,
}

const primaryButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  maxWidth: '100%',
  minHeight: 42,
  padding: '0 14px',
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.38)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.30), rgba(34,211,238,0.14))',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 950,
  cursor: 'pointer',
}

const secondaryButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  border: '1px solid rgba(116,190,255,0.20)',
  background: 'rgba(116,190,255,0.10)',
}

const pillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 30,
  padding: '0 10px',
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--foreground)',
  fontSize: 11,
  fontWeight: 900,
  textTransform: 'uppercase',
}

const bracketShellStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  minWidth: 0,
  padding: 18,
  borderRadius: 24,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'linear-gradient(180deg, rgba(12,26,50,0.82) 0%, rgba(9,20,39,0.92) 100%)',
  boxShadow: '0 18px 46px rgba(2,10,24,0.18)',
}

const statusRailStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
  gap: 12,
  minWidth: 0,
  padding: 14,
  borderRadius: 22,
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'linear-gradient(135deg, rgba(12,26,50,0.88), rgba(8,17,34,0.94))',
}

const statusHeroStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  gap: 12,
  alignItems: 'center',
  minWidth: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 850,
  overflowWrap: 'anywhere',
}

const statusDotStyle: CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: '50%',
  border: '1px solid rgba(155,225,29,0.38)',
  background: 'var(--brand-lime)',
  boxShadow: '0 0 0 6px rgba(155,225,29,0.08)',
}

const statusGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 112px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const playerRailStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 148px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const playerRailCardStyle: CSSProperties = {
  display: 'flex',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  gap: 10,
  alignItems: 'center',
  justifyContent: 'flex-start',
  minWidth: 0,
  minHeight: 58,
  padding: '10px 12px',
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(15,23,42,0.56)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  fontSize: 12,
  lineHeight: 1.35,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const playerRailCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 2,
  minWidth: 0,
}

const tournamentDetailPlayerIdStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
  gap: 12,
  alignItems: 'center',
  minWidth: 0,
  padding: 14,
  borderRadius: 20,
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.09), rgba(116,190,255,0.045)), rgba(8,16,34,0.76)',
  boxShadow: '0 18px 46px rgba(2,10,24,0.18), inset 0 1px 0 rgba(255,255,255,0.04)',
  overflow: 'hidden',
  overflowWrap: 'anywhere',
}

const tournamentDetailPlayerIdCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  minWidth: 0,
}

const tournamentDetailPlayerIdEyebrowStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const tournamentDetailPlayerIdTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(20px, 5vw, 28px)',
  lineHeight: 1.08,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const tournamentDetailPlayerIdTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.55,
  fontWeight: 750,
  overflowWrap: 'anywhere',
}

const tournamentDetailPlayerIdGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const tournamentDetailPlayerIdCardStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  minHeight: 78,
  padding: 10,
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(255,255,255,0.04)',
  overflowWrap: 'anywhere',
}

const tournamentDetailPlayerIdLabelStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 11,
  fontWeight: 950,
  textTransform: 'uppercase',
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const tournamentDetailPlayerIdValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 13,
  lineHeight: 1.35,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const tournamentDetailPlayerIdActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-start',
  gap: 9,
  minWidth: 0,
}

const tournamentDetailPlayerIdActionStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  maxWidth: '100%',
  minHeight: 38,
  minWidth: 0,
  padding: '9px 12px',
  borderRadius: 12,
  border: '1px solid rgba(116,190,255,0.15)',
  background: 'rgba(7,17,33,0.74)',
  color: '#eef5ff',
  textDecoration: 'none',
  fontSize: 12,
  fontWeight: 950,
  textAlign: 'center',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const tournamentDetailPlayerIdPrimaryActionStyle: CSSProperties = {
  borderColor: 'rgba(155,225,29,0.36)',
  background: 'rgba(155,225,29,0.13)',
  color: '#f5ffe2',
}

const publicReadinessStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 145px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const publicReadinessItemStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr) auto',
  gap: 8,
  alignItems: 'center',
  minWidth: 0,
  padding: 10,
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(15,23,42,0.46)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const readinessDotReadyStyle: CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: '50%',
  background: 'var(--brand-lime)',
  boxShadow: '0 0 0 4px rgba(155,225,29,0.10)',
}

const readinessDotWaitingStyle: CSSProperties = {
  ...readinessDotReadyStyle,
  background: 'rgba(116,190,255,0.46)',
  boxShadow: '0 0 0 4px rgba(116,190,255,0.08)',
}

const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'start',
  gap: 12,
  flexWrap: 'wrap',
  minWidth: 0,
}

const sectionActionStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  gap: 8,
  minWidth: 0,
}

const sectionTitleStyle: CSSProperties = {
  margin: '4px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 24,
  lineHeight: 1.05,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const standingsListStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
}

const standingsRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '32px minmax(0, 1fr) minmax(0, 58px) minmax(0, 58px) minmax(0, 54px)',
  gap: 8,
  alignItems: 'center',
  minWidth: 0,
  padding: '9px 10px',
  borderRadius: 14,
  border: '1px solid rgba(155,225,29,0.14)',
  background: 'rgba(155,225,29,0.06)',
  color: 'var(--foreground-strong)',
  fontSize: 13,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const standingsRankStyle: CSSProperties = {
  display: 'inline-grid',
  placeItems: 'center',
  width: 26,
  height: 26,
  borderRadius: '50%',
  border: '1px solid rgba(155,225,29,0.28)',
  background: 'rgba(15,23,42,0.58)',
  color: 'var(--brand-lime)',
  fontSize: 11,
  fontWeight: 950,
}

const podiumGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const podiumSummaryStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const podiumCardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '52px minmax(0, 1fr)',
  gap: 12,
  alignItems: 'center',
  minWidth: 0,
  padding: 12,
  borderRadius: 18,
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'rgba(155,225,29,0.07)',
  color: 'var(--foreground-strong)',
  overflowWrap: 'anywhere',
}

const podiumBadgeStyle: CSSProperties = {
  display: 'inline-grid',
  placeItems: 'center',
  width: 52,
  height: 52,
  borderRadius: '50%',
  border: '1px solid rgba(155,225,29,0.36)',
  background: 'rgba(155,225,29,0.13)',
  color: 'var(--brand-lime)',
  fontSize: 13,
  fontWeight: 950,
}

const podiumCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  minWidth: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.4,
  fontWeight: 800,
}

const podiumLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.20)',
  background: 'rgba(116,190,255,0.08)',
  color: 'var(--brand-blue-2)',
  fontSize: 12,
  fontWeight: 900,
  textDecoration: 'none',
}

const podiumActionRowStyle: CSSProperties = {
  gridColumn: '1 / -1',
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  alignItems: 'center',
  minWidth: 0,
}

const podiumMetaStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const entryShellStyle: CSSProperties = {
  ...bracketShellStyle,
  border: '1px solid rgba(155,225,29,0.20)',
  background: 'linear-gradient(180deg, rgba(14,33,55,0.88) 0%, rgba(9,20,39,0.94) 100%)',
}

const entryCueGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
  gap: 8,
  minWidth: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 900,
}

const entryGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const entryFieldStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  minWidth: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 950,
  textTransform: 'uppercase',
}

const entryInputStyle: CSSProperties = {
  width: '100%',
  minWidth: 0,
  minHeight: 42,
  padding: '0 12px',
  borderRadius: 13,
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'rgba(15,23,42,0.66)',
  color: 'var(--foreground-strong)',
  fontSize: 14,
  fontWeight: 850,
  outline: '2px solid transparent',
  outlineOffset: 2,
  boxSizing: 'border-box',
}

const entryInputFocusStyle: CSSProperties = {
  borderColor: 'rgba(155,225,29,0.45)',
  outline: '2px solid rgba(155,225,29,0.42)',
  boxShadow: '0 0 0 5px rgba(155,225,29,0.12)',
}

const entryToggleStyle: CSSProperties = {
  gridColumn: '1 / -1',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minWidth: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 800,
}

const entryNoticeStyle: CSSProperties = {
  gridColumn: '1 / -1',
  minWidth: 0,
  padding: 10,
  borderRadius: 14,
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'rgba(155,225,29,0.07)',
  color: 'var(--foreground-strong)',
  fontSize: 13,
  fontWeight: 850,
}

const scheduleBoardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const scheduleCardStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(116,190,255,0.06)',
  color: 'var(--foreground-strong)',
  fontSize: 13,
  lineHeight: 1.4,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const emptyStateStyle: CSSProperties = {
  minWidth: 0,
  padding: 14,
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(15,23,42,0.45)',
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 850,
  overflowWrap: 'anywhere',
}

const publicEmptyStateStyle: CSSProperties = {
  ...emptyStateStyle,
  display: 'grid',
  gap: 10,
  justifyItems: 'start',
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.08), rgba(116,190,255,0.055))',
  color: 'var(--foreground-strong)',
}

const publicEmptyActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
}

const roundGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 245px), 1fr))',
  gap: 12,
  minWidth: 0,
}

const roundColumnStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
}

const roundTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 16,
  fontWeight: 950,
}

const matchListStyle: CSSProperties = {
  display: 'grid',
  gap: 9,
  minWidth: 0,
}

const matchCardStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--foreground-strong)',
  overflowWrap: 'anywhere',
}

const matchMetaStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 900,
  textTransform: 'uppercase',
}

const sideRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  minWidth: 0,
}

const winnerPillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 24,
  borderRadius: '50%',
  border: '1px solid rgba(155,225,29,0.38)',
  background: 'rgba(155,225,29,0.13)',
  color: 'var(--brand-lime)',
  fontSize: 11,
  fontWeight: 950,
  flexShrink: 0,
}

const resultStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 12,
  lineHeight: 1.4,
  fontWeight: 950,
}

const scheduleStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 12,
  lineHeight: 1.4,
  fontWeight: 900,
}

const waitingStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.4,
  fontWeight: 800,
}
