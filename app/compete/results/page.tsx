'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import QuickMessageComposer from '@/app/components/quick-message-composer'
import CompetePageFrame, {
  CompeteCard,
  CompeteGrid,
} from '@/app/compete/_components/compete-page-frame'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import { buildProductAccessState } from '@/lib/access-model'
import { useAuth } from '@/app/components/auth-provider'
import { DATA_ASSIST_STORY } from '@/lib/product-story'
import {
  listTiqIndividualLeagueResults,
  type TiqIndividualLeagueResultRecord,
} from '@/lib/tiq-individual-results-service'
import { listTiqLeagues } from '@/lib/tiq-league-service'
import { formatDate } from '@/lib/captain-formatters'

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
      title="Results belong in the weekly loop, not just the archive."
      description="This route surfaces recent TIQ individual-league outcomes and keeps Data Assist close when scorecards need to be uploaded before they shape standings, player context, and next-match decisions."
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
      <CompeteGrid>
        <CompeteCard
          href="/explore/rankings"
          meta="Movement"
          title="Rankings"
          text="Check leaderboard movement and competitive shifts after recent results settle."
        />
        <CompeteCard
          href="/mylab"
          meta="Personal insight"
          title="My Lab"
          text="Review followed entities, trend signals, and personalized feed items after the week closes."
        />
        <CompeteCard
          href="/players"
          meta="Player impact"
          title="Player Profiles"
          text="Jump into player-level context when a TIQ result changes how you should think about form or future matchups."
        />
        <CompeteCard
          href={DATA_ASSIST_STORY.href}
          meta="Refresh results"
          title="Upload Scorecards"
          text={DATA_ASSIST_STORY.shortCue}
        />
      </CompeteGrid>

      {authResolved && !access.canUseCaptainWorkflow ? (
        <div style={upgradeWrapStyle}>
          <UpgradePrompt
            planId="captain"
            compact
            headline="Want results to turn into smarter next-week decisions?"
            body="Unlock Captain to connect outcomes, availability, lineup planning, and team communication instead of reviewing results in isolation."
            ctaLabel="Unlock Captain Tools"
            ctaHref="/pricing"
            secondaryLabel="See Captain value"
            secondaryHref="/pricing"
            footnote="Best for captains who want each week’s results to feed the next lineup instead of starting over."
          />
        </div>
      ) : null}

      <section style={panelStyle}>
        <div style={sectionEyebrowStyle}>TIQ individual activity</div>
        <div style={sectionTextStyle}>
          Recent TIQ individual-league outcomes now live inside the weekly results loop instead of
          hiding only on league detail pages.
        </div>

        {results.length === 0 ? (
          <div style={emptyStyle}>
            No TIQ individual results have been logged yet. Upload reviewed scorecards through Data Assist when match play is ready to refresh this view.
          </div>
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
        <div style={rowHintStyle}>
          Review the profiles, then rerun the matchup before the next round.
        </div>
      </div>
      <div style={rowActionStackStyle}>
        <RowLink href={`/explore/leagues/tiq/${encodeURIComponent(result.leagueId)}?league_id=${encodeURIComponent(result.leagueId)}`}>
          Open league
        </RowLink>
        <RowLink href={matchupHref}>
          Compare rematch
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
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'linear-gradient(180deg, rgba(13,28,54,0.90) 0%, rgba(8,18,36,0.96) 100%)',
} as const

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
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'rgba(116,190,255,0.82)',
} as const

const sectionTextStyle = {
  color: 'rgba(214,228,246,0.74)',
  fontSize: '14px',
  lineHeight: 1.72,
} as const

const emptyStyle = {
  padding: '16px',
  borderRadius: '18px',
  border: '1px dashed rgba(116,190,255,0.18)',
  color: 'rgba(214,228,246,0.74)',
  background: 'rgba(255,255,255,0.04)',
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
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'rgba(255,255,255,0.04)',
} as const

const rowTitleStyle = {
  color: '#f4f9ff',
  fontSize: '16px',
  fontWeight: 800,
} as const

const rowMetaStyle = {
  marginTop: '4px',
  color: 'rgba(214,228,246,0.72)',
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
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'rgba(255,255,255,0.04)',
} as const

const statValueStyle = {
  color: '#f4f9ff',
  fontSize: '20px',
  fontWeight: 900,
  lineHeight: 1.15,
} as const

const statLabelStyle = {
  marginTop: '4px',
  color: 'rgba(214,228,246,0.68)',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.08em',
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
