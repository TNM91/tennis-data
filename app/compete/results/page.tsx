'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import QuickMessageComposer from '@/app/components/quick-message-composer'
import CompetePageFrame, {
  CompeteCard,
  CompeteGrid,
} from '@/app/compete/_components/compete-page-frame'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import { buildProductAccessState } from '@/lib/access-model'
import { useAuth } from '@/app/components/auth-provider'
import { DATA_ASSIST_STORY, PRODUCT_MOTTO } from '@/lib/product-story'
import { getPlayerDevelopmentIdentity, getPlayerDevelopmentIdentityActionRead } from '@/lib/player-development'
import {
  listTiqIndividualLeagueResults,
  type TiqIndividualLeagueResultRecord,
} from '@/lib/tiq-individual-results-service'
import { listTiqLeagues } from '@/lib/tiq-league-service'
import { formatDate } from '@/lib/captain-formatters'

const emptyResultActions = [
  { href: '/league-coordinator/individual-results', label: 'Log player result' },
  { href: '/league-coordinator/results', label: 'Open team book' },
  { href: DATA_ASSIST_STORY.href, label: 'Fix tennis info' },
] as const

const RESULTS_PLAYER_IDENTITY = getPlayerDevelopmentIdentity('relentless-competitor-4-0')
const RESULTS_PLAYER_IDENTITY_READ = getPlayerDevelopmentIdentityActionRead(RESULTS_PLAYER_IDENTITY)
const RESULTS_LEVEL_UP_HREF = `/level-up/${RESULTS_PLAYER_IDENTITY.slug}`
const RESULTS_PLAYER_DEVELOPMENT_HREF = `/player-development/${RESULTS_PLAYER_IDENTITY.slug}`
const resultPlayerIdProofItems = [
  { label: 'Result read', value: RESULTS_PLAYER_IDENTITY_READ.matchTrigger },
  { label: 'Training proof', value: RESULTS_PLAYER_IDENTITY_READ.proofTarget },
  { label: 'Next cue', value: RESULTS_PLAYER_IDENTITY_READ.nextCue },
] as const
const resultPlayerIdActions = [
  { href: RESULTS_LEVEL_UP_HREF, label: 'Start Level Up' },
  { href: RESULTS_PLAYER_DEVELOPMENT_HREF, label: 'Read Player ID' },
  { href: '/mylab#player-workshop', label: 'Open My Lab' },
] as const

const resultsPathActions = [
  {
    href: '#tiq-results-activity',
    job: 'view_results',
    question: 'What happened?',
    title: 'View recent results',
    body: 'Scan completed player results, readiness gaps, and the next useful matchup action.',
    cta: 'View activity',
  },
  {
    href: '/league-coordinator/individual-results',
    job: 'log_player_result',
    question: 'Who won the player match?',
    title: 'Log a player result',
    body: 'Use for ladders, round robins, challenge leagues, and one-on-one results.',
    cta: 'Log result',
  },
  {
    href: '/league-coordinator/results',
    job: 'record_team_match',
    question: 'Which team match finished?',
    title: 'Record a team match',
    body: 'Create the match event, add line scores, and keep team standings moving.',
    cta: 'Open team book',
  },
  {
    href: DATA_ASSIST_STORY.href,
    job: 'upload_scorecard',
    question: 'How do I avoid retyping?',
    title: 'Upload a scorecard',
    body: 'Send reviewed scorecards through Data Assist before results shape platform context.',
    cta: 'Upload source',
  },
] as const

function RowLink({ href, children }: { href: string; children: ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...rowLinkStyle,
        color: hovered ? '#9be11d' : rowLinkStyle.color,
        transform: hovered ? 'translateY(-1px)' : 'none',
        transition: 'color 160ms ease, transform 160ms ease',
      }}
    >
      {children}
    </Link>
  )
}

export default function CompeteResultsPage() {
  return (
    <CompetePageFrame
      eyebrow="Results"
      title="Results that feed the next match."
      description="Recent outcomes, player impact, matchup links, and scorecard uploads stay close."
    >
      <CompeteResultsContent />
    </CompetePageFrame>
  )
}

function CompeteResultsContent() {
  const { role, userId, entitlements, authResolved } = useAuth()
  const [results, setResults] = useState<TiqIndividualLeagueResultRecord[]>([])
  const [leagueNames, setLeagueNames] = useState<Record<string, string>>({})
  const [storageWarning, setStorageWarning] = useState('')
  const resolvedRole = authResolved || !userId ? role : 'member'
  const access = useMemo(() => buildProductAccessState(resolvedRole, entitlements), [resolvedRole, entitlements])
  const resultStats = useMemo(() => {
    const playerIds = new Set<string>()
    let matchupReadyCount = 0

    for (const result of results) {
      if (result.playerAId) playerIds.add(result.playerAId)
      if (result.playerBId) playerIds.add(result.playerBId)
      if (result.playerAId && result.playerBId) matchupReadyCount += 1
    }

    return {
      resultCount: results.length,
      playerCount: playerIds.size,
      matchupReadyCount,
      latestDate: results[0]?.resultDate || '',
    }
  }, [results])

  useEffect(() => {
    async function load() {
      const [resultsResult, leaguesResult] = await Promise.all([
        listTiqIndividualLeagueResults(),
        listTiqLeagues(),
      ])

      setResults(resultsResult.results.slice(0, 20))
      setStorageWarning(resultsResult.warning || leaguesResult.warning || '')
      setLeagueNames(
        Object.fromEntries(leaguesResult.records.map((record) => [record.id, record.leagueName])),
      )
    }

    void load()
  }, [])

  return (
    <>
      <ResultsPathPanel />
      <ResultPlayerIdProofPanel />

      <CompeteGrid>
        <CompeteCard
          href="/league-coordinator/results"
          meta="Team results"
          title="Team book"
          text="Record team match events, line scores, and standings-moving outcomes."
          icon="reports"
          action="Open team book"
        />
        <CompeteCard
          href="/league-coordinator/individual-results"
          meta="Player results"
          title="Player book"
          text="Log one-on-one results for ladders, round robins, and challenge leagues."
          icon="playerRatings"
          action="Open player book"
        />
        <CompeteCard
          href="/explore/rankings"
          meta="Movement"
          title="Rankings"
          text="Check leaderboard movement after results settle."
          icon="teamRankings"
          action="See movement"
        />
        <CompeteCard
          href={DATA_ASSIST_STORY.href}
          meta="Refresh"
          title="Improve results data"
          text="Upload reviewed scorecards before standings move."
          icon="reports"
          action="Upload data"
        />
      </CompeteGrid>

      {authResolved && !access.canUseCaptainWorkflow ? (
        <div style={upgradeWrapStyle}>
          <UpgradePrompt
            planId="captain"
            compact
            headline="Want results to turn into smarter next-week decisions?"
            body="Unlock Captain to connect outcomes, availability, lineup planning, and team communication instead of reviewing results in isolation."
            ctaLabel="Unlock Captain"
            ctaHref="/pricing"
            secondaryLabel="See Captain value"
            secondaryHref="/pricing"
            footnote="Best for captains who want each week's results to feed the next lineup instead of starting over."
          />
        </div>
      ) : null}

      <section id="tiq-results-activity" style={panelStyle}>
        <div style={sectionEyebrowStyle}>TIQ individual activity</div>
        <div style={sectionTextStyle}>
          Recent TIQ individual-league outcomes now live inside the weekly results loop instead of
          hiding only on league detail pages.
        </div>

        {results.length === 0 ? (
          <EmptyResultsState />
        ) : (
          <>
            <div style={statGridStyle}>
              <div style={statCardStyle}>
                <div style={statValueStyle}>{resultStats.resultCount}</div>
                <div style={statLabelStyle}>recent results</div>
              </div>
              <div style={statCardStyle}>
                <div style={statValueStyle}>{resultStats.playerCount}</div>
                <div style={statLabelStyle}>players touched</div>
              </div>
              <div style={statCardStyle}>
                <div style={statValueStyle}>{resultStats.matchupReadyCount}</div>
                <div style={statLabelStyle}>ready to compare</div>
              </div>
              <div style={statCardStyle}>
                <div style={statValueStyle}>{formatDate(resultStats.latestDate, 'Soon')}</div>
                <div style={statLabelStyle}>latest result</div>
              </div>
            </div>

            <div style={listStyle}>
              {results.map((result) => (
                <ResultRow
                  key={result.id}
                  result={result}
                  leagueName={leagueNames[result.leagueId] || 'TIQ Individual League'}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {storageWarning ? <div style={warningStyle}>{storageWarning}</div> : null}
    </>
  )
}

function ResultPlayerIdProofPanel() {
  return (
    <section style={resultPlayerIdProofStyle} aria-label="Results Player ID proof loop">
      <div style={resultPlayerIdProofCopyStyle}>
        <span style={resultPlayerIdProofEyebrowStyle}>Result to Player ID</span>
        <h2 style={resultPlayerIdProofTitleStyle}>Use the score as proof, not just history.</h2>
        <p style={resultPlayerIdProofTextStyle}>
          {RESULTS_PLAYER_IDENTITY_READ.levelUpNudge} After the result lands, turn the pattern into one Level Up rep and one My Lab cue.
        </p>
      </div>
      <div style={resultPlayerIdProofGridStyle} aria-label="Results Player ID starter read">
        {resultPlayerIdProofItems.map((item) => (
          <div key={item.label} style={resultPlayerIdProofCardStyle}>
            <span style={resultPlayerIdProofLabelStyle}>{item.label}</span>
            <strong style={resultPlayerIdProofValueStyle}>{item.value}</strong>
          </div>
        ))}
      </div>
      <div style={resultPlayerIdProofActionRowStyle}>
        {resultPlayerIdActions.map((action, index) => (
          <Link
            key={action.href}
            href={action.href}
            style={{
              ...resultPlayerIdProofActionStyle,
              ...(index === 0 ? resultPlayerIdProofPrimaryActionStyle : {}),
            }}
          >
            {action.label}
          </Link>
        ))}
      </div>
    </section>
  )
}

function ResultsPathPanel() {
  return (
    <section style={resultsPathStyle} aria-labelledby="compete-results-path-title">
      <div style={resultsPathHeaderStyle}>
        <div>
          <span style={resultsPathEyebrowStyle}>Results path</span>
          <h2 id="compete-results-path-title" style={resultsPathTitleStyle}>{PRODUCT_MOTTO}</h2>
        </div>
        <p style={resultsPathIntroStyle}>
          Start with the result need, then open the smallest action that keeps prep, standings, or data moving.
        </p>
      </div>
      <div style={resultsPathGridStyle}>
        {resultsPathActions.map((action) => (
          <Link
            key={action.job}
            href={action.href}
            style={resultsPathCardStyle}
            data-compete-results-path-job={action.job}
            aria-label={`${action.cta}: ${action.question}`}
          >
            <span style={resultsPathQuestionStyle}>{action.question}</span>
            <strong style={resultsPathCardTitleStyle}>{action.title}</strong>
            <span>{action.body}</span>
            <span style={resultsPathCtaStyle}>{action.cta}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

function EmptyResultsState() {
  return (
    <div style={emptyResultsStyle}>
      <div style={emptyResultsCopyStyle}>
        <strong>Results start with one finished match.</strong>
        <span>Log a player result, record a team match, or upload a reviewed scorecard so rankings and matchup prep have something real to use.</span>
      </div>
      <div style={emptyResultsActionRowStyle}>
        {emptyResultActions.map((action) => (
          <Link key={action.href} href={action.href} style={emptyResultsActionStyle}>
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

function ResultRow({
  result,
  leagueName,
}: {
  result: TiqIndividualLeagueResultRecord
  leagueName: string
}) {
  const loserName = result.winnerPlayerName === result.playerAName ? result.playerBName : result.playerAName
  const loserId = result.winnerPlayerId === result.playerAId ? result.playerBId : result.playerAId
  const matchupHref = buildResultMatchupHref(result)
  const profilesReady = Boolean(result.playerAId && result.playerBId)
  const scoreReady = Boolean(result.score)
  const resultDateReady = Boolean(result.resultDate)
  const resultFollowThroughItems = [
    { label: 'Score', value: scoreReady ? result.score : 'Missing', ready: scoreReady },
    { label: 'Profiles', value: profilesReady ? 'Ready' : 'Needed', ready: profilesReady },
    { label: 'Date', value: resultDateReady ? formatDate(result.resultDate, 'Set') : 'Missing', ready: resultDateReady },
  ]
  const nextHref = profilesReady ? matchupHref : DATA_ASSIST_STORY.href
  const nextLabel = profilesReady ? 'Compare rematch' : 'Create profiles'
  const supportSubject = `Question about result: ${result.winnerPlayerName} def. ${loserName}`
  const supportBody = [
    `League: ${leagueName}`,
    `Result: ${result.winnerPlayerName} def. ${loserName}`,
    result.score ? `Score: ${result.score}` : '',
    result.resultDate ? `Date: ${result.resultDate}` : '',
    '',
    'What I need help with:',
  ].filter(Boolean).join('\n')

  return (
    <div style={rowStyle}>
      <div>
        <div style={rowTitleStyle}>
          {result.winnerPlayerName} def. {loserName}
        </div>
        <div style={rowMetaStyle}>
          {[leagueName, result.score, formatDate(result.resultDate, 'Recently'), result.notes]
            .filter(Boolean)
            .join(' | ')}
        </div>
        <div style={resultFollowThroughGridStyle}>
          {resultFollowThroughItems.map((item) => (
            <div key={item.label} style={resultFollowThroughItemStyle}>
              <span style={item.ready ? readinessDotReadyStyle : readinessDotWaitingStyle} aria-hidden="true" />
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
          <Link href={nextHref} style={resultNextActionStyle}>
            {nextLabel}
          </Link>
        </div>
        <div style={rowHintStyle}>
          {profilesReady
            ? 'Profiles are connected. Rerun the matchup before the next round.'
            : 'Create both player profiles so this result can feed TIQ history and awards.'}
        </div>
      </div>
      <div style={rowActionStackStyle}>
        <RowLink href={`/explore/leagues/tiq/${encodeURIComponent(result.leagueId)}?league_id=${encodeURIComponent(result.leagueId)}`}>
          Open league
        </RowLink>
        <QuickMessageComposer
          mode="direct"
          triggerLabel="Message opponent"
          recipientName={loserName}
          recipientPlayerId={loserId}
          subject={`${result.winnerPlayerName} vs ${loserName}`}
          body={[
            `Hi ${loserName},`,
            '',
            `Following up on our ${leagueName} result${result.resultDate ? ` from ${formatDate(result.resultDate, 'recently')}` : ''}.`,
          ].join('\n')}
          entityType="tiq_individual_result"
          entityId={result.id}
        />
        <QuickMessageComposer
          mode="support"
          triggerLabel="Ask support"
          category="result"
          subject={supportSubject}
          body={supportBody}
          entityType="tiq_individual_result"
          entityId={result.id}
        />
        {result.winnerPlayerId ? (
          <RowLink href={`/players/${encodeURIComponent(result.winnerPlayerId)}`}>
            Winner profile
          </RowLink>
        ) : null}
        {loserId ? (
          <RowLink href={`/players/${encodeURIComponent(loserId)}`}>
            Opponent profile
          </RowLink>
        ) : null}
      </div>
    </div>
  )
}

function buildResultMatchupHref(result: TiqIndividualLeagueResultRecord) {
  const params = new URLSearchParams({ type: 'singles' })
  if (result.playerAId) params.set('playerA', result.playerAId)
  if (result.playerBId) params.set('playerB', result.playerBId)
  return `/matchup?${params.toString()}`
}

const panelStyle = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gap: '12px',
  marginTop: '24px',
  padding: '20px',
  borderRadius: '24px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(8, 16, 34, 0.74)',
  boxShadow: '0 18px 48px rgba(2,10,24,0.24), inset 0 1px 0 rgba(255,255,255,0.04)',
  minWidth: 0,
} as const

const resultsPathStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gap: '14px',
  padding: '16px',
  borderRadius: '22px',
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.09), rgba(116,190,255,0.045)), rgba(8,16,34,0.76)',
  boxShadow: '0 18px 48px rgba(2,10,24,0.22), inset 0 1px 0 rgba(255,255,255,0.05)',
  minWidth: 0,
  overflow: 'hidden',
  overflowWrap: 'anywhere',
}

const resultsPathHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: '12px',
  flexWrap: 'wrap',
  minWidth: 0,
}

const resultsPathEyebrowStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: '12px',
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const resultsPathTitleStyle: CSSProperties = {
  margin: '4px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(22px, 5vw, 30px)',
  lineHeight: 1.08,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const resultsPathIntroStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.55,
  fontWeight: 750,
  maxWidth: 560,
  overflowWrap: 'anywhere',
}

const resultsPathGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
  gap: '10px',
  minWidth: 0,
}

const resultsPathCardStyle: CSSProperties = {
  display: 'grid',
  gap: '7px',
  alignContent: 'start',
  minHeight: 148,
  minWidth: 0,
  padding: '12px',
  borderRadius: '16px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(8,16,34,0.72)',
  color: 'var(--shell-copy-muted)',
  textDecoration: 'none',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
  overflowWrap: 'anywhere',
}

const resultsPathQuestionStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: '12px',
  lineHeight: 1.3,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const resultsPathCardTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '15px',
  lineHeight: 1.2,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const resultsPathCtaStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: '12px',
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const resultPlayerIdProofStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
  gap: '12px',
  alignItems: 'stretch',
  padding: '16px',
  borderRadius: '22px',
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'linear-gradient(135deg, rgba(8,16,34,0.78), rgba(12,29,34,0.74))',
  boxShadow: '0 18px 48px rgba(2,10,24,0.20), inset 0 1px 0 rgba(255,255,255,0.05)',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const resultPlayerIdProofCopyStyle: CSSProperties = {
  display: 'grid',
  alignContent: 'center',
  gap: '6px',
  minWidth: 0,
}

const resultPlayerIdProofEyebrowStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: '12px',
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const resultPlayerIdProofTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(20px, 4vw, 28px)',
  lineHeight: 1.1,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const resultPlayerIdProofTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  lineHeight: 1.58,
  fontWeight: 750,
  overflowWrap: 'anywhere',
}

const resultPlayerIdProofGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: '8px',
  minWidth: 0,
}

const resultPlayerIdProofCardStyle: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: '5px',
  minWidth: 0,
  minHeight: 92,
  padding: '10px',
  borderRadius: '14px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(2,8,23,0.34)',
  overflowWrap: 'anywhere',
}

const resultPlayerIdProofLabelStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: '10px',
  lineHeight: 1.3,
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const resultPlayerIdProofValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '12px',
  lineHeight: 1.42,
  fontWeight: 850,
  overflowWrap: 'anywhere',
}

const resultPlayerIdProofActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  alignContent: 'center',
  gap: '8px',
  minWidth: 0,
}

const resultPlayerIdProofActionStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 36,
  maxWidth: '100%',
  padding: '8px 11px',
  borderRadius: '999px',
  border: '1px solid rgba(116,190,255,0.18)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--foreground-strong)',
  fontSize: '12px',
  fontWeight: 900,
  textDecoration: 'none',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
}

const resultPlayerIdProofPrimaryActionStyle: CSSProperties = {
  border: '1px solid rgba(155,225,29,0.34)',
  background: 'rgba(155,225,29,0.14)',
  color: 'var(--brand-green)',
}

const upgradeWrapStyle = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gap: '12px',
  marginTop: '24px',
} as const

const sectionEyebrowStyle = {
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: 'uppercase',
  color: 'var(--brand-blue-2)',
} as const

const sectionTextStyle = {
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.72,
} as const

const emptyResultsStyle = {
  display: 'grid',
  gap: '14px',
  padding: '16px',
  borderRadius: '18px',
  border: '1px dashed rgba(116,190,255,0.18)',
  color: 'var(--shell-copy-muted)',
  background: 'rgba(8,16,34,0.66)',
  minWidth: 0,
  overflowWrap: 'anywhere',
} as const

const emptyResultsCopyStyle = {
  display: 'grid',
  gap: '6px',
  minWidth: 0,
  overflowWrap: 'anywhere',
} as const

const emptyResultsActionRowStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  minWidth: 0,
} as const

const emptyResultsActionStyle = {
  minWidth: 0,
  maxWidth: '100%',
  padding: '10px 13px',
  borderRadius: '999px',
  border: '1px solid rgba(116,190,255,0.18)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  fontSize: '12px',
  fontWeight: 900,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
} as const

const listStyle = {
  display: 'grid',
  gap: '12px',
} as const

const rowStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
  gap: '12px',
  alignItems: 'center',
  padding: '14px',
  borderRadius: '18px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(8,16,34,0.66)',
  minWidth: 0,
} as const

const rowTitleStyle = {
  color: 'var(--foreground-strong)',
  fontSize: '16px',
  fontWeight: 800,
} as const

const rowMetaStyle = {
  marginTop: '4px',
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  lineHeight: 1.6,
} as const

const rowHintStyle = {
  marginTop: '8px',
  color: 'rgba(155,225,29,0.78)',
  fontSize: '12px',
  fontWeight: 750,
  lineHeight: 1.5,
} as const

const resultFollowThroughGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 118px), 1fr))',
  gap: '8px',
  marginTop: '12px',
  minWidth: 0,
} as const

const resultFollowThroughItemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '7px',
  minHeight: '34px',
  minWidth: 0,
  padding: '7px 9px',
  borderRadius: '12px',
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(255,255,255,0.035)',
  color: 'rgba(223,238,255,0.84)',
  fontSize: '12px',
  fontWeight: 850,
  overflow: 'hidden',
} as const

const resultNextActionStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '34px',
  minWidth: 0,
  padding: '7px 12px',
  borderRadius: '12px',
  border: '1px solid rgba(155,225,29,0.28)',
  background: 'rgba(155,225,29,0.11)',
  color: '#f5ffe2',
  fontSize: '12px',
  fontWeight: 900,
  textDecoration: 'none',
  overflowWrap: 'anywhere',
  textAlign: 'center',
} as const

const readinessDotReadyStyle = {
  width: 9,
  height: 9,
  borderRadius: '50%',
  background: 'var(--brand-lime)',
  boxShadow: '0 0 0 4px rgba(155,225,29,0.10)',
  flex: '0 0 auto',
} as const

const readinessDotWaitingStyle = {
  ...readinessDotReadyStyle,
  background: 'rgba(116,190,255,0.46)',
  boxShadow: '0 0 0 4px rgba(116,190,255,0.08)',
} as const

const rowActionStackStyle = {
  display: 'flex',
  justifyContent: 'flex-end',
  flexWrap: 'wrap',
  gap: '8px',
  minWidth: 0,
} as const

const rowLinkStyle = {
  color: '#dfeeff',
  fontSize: '13px',
  fontWeight: 800,
  textDecoration: 'none',
  maxWidth: '100%',
  overflowWrap: 'anywhere',
  whiteSpace: 'normal',
} as const

const statGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))',
  gap: '10px',
} as const

const statCardStyle = {
  padding: '12px',
  borderRadius: '16px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(8,16,34,0.66)',
} as const

const statValueStyle = {
  color: 'var(--foreground-strong)',
  fontSize: '20px',
  fontWeight: 900,
  lineHeight: 1.15,
} as const

const statLabelStyle = {
  marginTop: '4px',
  color: 'var(--shell-copy-muted)',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: 'uppercase',
} as const

const warningStyle = {
  padding: '10px 14px',
  borderRadius: '12px',
  border: '1px solid rgba(251,191,36,0.18)',
  background: 'rgba(120,80,0,0.18)',
  color: 'rgba(253,230,138,0.88)',
  fontSize: '13px',
  lineHeight: 1.55,
} as const
