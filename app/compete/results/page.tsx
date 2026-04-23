'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import CompetePageFrame, {
  CompeteCard,
  CompeteGrid,
} from '@/app/compete/_components/compete-page-frame'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import { buildProductAccessState } from '@/lib/access-model'
import { useAuth } from '@/app/components/auth-provider'
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
  const { role, entitlements } = useAuth()
  const [results, setResults] = useState<TiqIndividualLeagueResultRecord[]>([])
  const [leagueNames, setLeagueNames] = useState<Record<string, string>>({})
  const [storageWarning, setStorageWarning] = useState('')
  const access = useMemo(() => buildProductAccessState(role, entitlements), [role, entitlements])

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
    <CompetePageFrame
      eyebrow="Results"
      title="Results belong in the weekly loop, not just the archive."
      description="This route now surfaces recent TIQ individual-league outcomes so completed play feeds straight back into standings, player context, and next-match decisions."
    >
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
      </CompeteGrid>

      {!access.canUseCaptainWorkflow ? (
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
          <div style={emptyStyle}>No TIQ individual results have been logged yet.</div>
        ) : (
          <div style={listStyle}>
            {results.map((result) => {
              const loser =
                result.winnerPlayerName === result.playerAName ? result.playerBName : result.playerAName

              return (
                <div key={result.id} style={rowStyle}>
                  <div>
                    <div style={rowTitleStyle}>
                      {result.winnerPlayerName} def. {loser}
                    </div>
                    <div style={rowMetaStyle}>
                      {[
                        leagueNames[result.leagueId] || 'TIQ Individual League',
                        result.score,
                        formatDate(result.resultDate, 'Recently'),
                        result.notes,
                      ]
                        .filter(Boolean)
                        .join(' | ')}
                    </div>
                  </div>
                  <div style={rowActionStackStyle}>
                    <RowLink href={`/explore/leagues/tiq/${encodeURIComponent(result.leagueId)}?league_id=${encodeURIComponent(result.leagueId)}`}>
                      Open league
                    </RowLink>
                    {result.winnerPlayerId ? (
                      <RowLink href={`/players/${encodeURIComponent(result.winnerPlayerId)}`}>
                        Winner profile
                      </RowLink>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {storageWarning ? <div style={warningStyle}>{storageWarning}</div> : null}
    </CompetePageFrame>
  )
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
  display: 'flex',
  justifyContent: 'space-between',
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

const rowActionStackStyle = {
  display: 'grid',
  justifyItems: 'end',
  gap: '8px',
} as const

const rowLinkStyle = {
  color: '#dfeeff',
  fontSize: '13px',
  fontWeight: 800,
  textDecoration: 'none',
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
