'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import CompetePageFrame, {
  CompeteCard,
  CompeteGrid,
} from '@/app/compete/_components/compete-page-frame'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import { getLeagueFormatLabel } from '@/lib/competition-layers'
import { listTiqIndividualLeagueResults } from '@/lib/tiq-individual-results-service'
import {
  buildTiqIndividualLeagueSummaries,
  type TiqIndividualLeagueSummary,
} from '@/lib/tiq-individual-results-summary'
import { listTiqIndividualSuggestions } from '@/lib/tiq-individual-suggestions-service'
import {
  buildTiqIndividualSuggestionSummaries,
  type TiqIndividualSuggestionSummary,
} from '@/lib/tiq-individual-suggestions-summary'
import {
  getTiqIndividualCompetitionFormatLabel,
  getTiqIndividualCompetitionFormatNextAction,
  getTiqIndividualCompetitionFormatPreview,
} from '@/lib/tiq-individual-format'
import { type TiqLeagueRecord } from '@/lib/tiq-league-registry'
import { listTiqLeagues } from '@/lib/tiq-league-service'

export default function CompeteLeaguesPage() {
  const [records, setRecords] = useState<TiqLeagueRecord[]>([])
  const [storageWarning, setStorageWarning] = useState('')
  const [individualLeagueSummaries, setIndividualLeagueSummaries] = useState<
    Map<string, TiqIndividualLeagueSummary>
  >(new Map())
  const [individualSuggestionSummaries, setIndividualSuggestionSummaries] = useState<
    Map<string, TiqIndividualSuggestionSummary>
  >(new Map())

  useEffect(() => {
    async function load() {
      const [result, individualResults, suggestionResult] = await Promise.all([
        listTiqLeagues(),
        listTiqIndividualLeagueResults(),
        listTiqIndividualSuggestions(),
      ])
      setRecords(result.records)
      setStorageWarning(result.warning || individualResults.warning || suggestionResult.warning || '')
      setIndividualLeagueSummaries(buildTiqIndividualLeagueSummaries(individualResults.results))
      setIndividualSuggestionSummaries(
        buildTiqIndividualSuggestionSummaries(suggestionResult.suggestions),
      )
    }

    void load()
  }, [])

  const teamLeagues = useMemo(
    () => records.filter((record) => record.leagueFormat === 'team'),
    [records],
  )
  const individualLeagues = useMemo(
    () => records.filter((record) => record.leagueFormat === 'individual'),
    [records],
  )

  return (
    <CompetePageFrame
      eyebrow="My Leagues"
      title="League participation should start with the right format."
      description="Team leagues and individual leagues belong in the same workflow layer, but they should not be treated as the same thing. This view now uses the TIQ season registry so captains can move from structure into weekly execution."
    >
      <CompeteGrid>
        <CompeteCard
          href="/captain/season-dashboard"
          meta="Create TIQ leagues"
          title="Season Dashboard"
          text="Create TIQ team leagues and individual leagues, seed participants, and keep internal competition separate from USTA truth."
        />
        <CompeteCard
          href="/explore/leagues"
          meta="Explore"
          title="Browse League Layers"
          text="Review the combined browse surface for USTA leagues, TIQ team leagues, and TIQ individual leagues."
        />
        <CompeteCard
          href="/captain"
          meta="Captain workflow"
          title="Captain Command Center"
          text="Continue into the captain dashboard when this week requires action instead of season setup."
        />
      </CompeteGrid>

      {storageWarning ? <div style={warningStyle}>{storageWarning}</div> : null}

      <div style={upgradeWrapStyle}>
        <div style={upgradeIntroStyle}>
          <div style={sectionEyebrowStyle}>Need more control?</div>
          <div style={upgradeTitleStyle}>Pick the package that solves the friction you have right now.</div>
          <div style={sectionTextStyle}>
            Keep this simple: if you want better personal guidance, upgrade to Player+. If you are running team decisions, Captain is the answer. If you are organizing the season, use League.
          </div>
        </div>

        <div style={upgradeGridStyle}>
          <UpgradePrompt
            planId="player_plus"
            compact
            headline="Not sure where you should play?"
            body="Player+ gives you personal insight, projections, and clearer direction when you want to compete smarter."
            ctaLabel="Unlock Player+"
            ctaHref="/pricing"
            secondaryLabel="See plans"
            secondaryHref="/pricing"
          />
          <UpgradePrompt
            planId="captain"
            compact
            headline="Still building lineups manually?"
            body="Captain helps you save time, reduce stress, and move from availability to smarter lineups and team communication."
            ctaLabel="Unlock Captain Tools"
            ctaHref="/pricing"
            secondaryLabel="See plans"
            secondaryHref="/pricing"
          />
          <UpgradePrompt
            planId="league"
            compact
            headline="Running your league in spreadsheets?"
            body="League tools give organizers one place for scheduling, standings, structure, and league-wide coordination."
            ctaLabel="Run Your League on TIQ"
            ctaHref="/pricing"
            secondaryLabel="See plans"
            secondaryHref="/pricing"
          />
        </div>
      </div>

      <div style={sectionWrap}>
        <LeagueListSection
          title="Team Leagues"
          body="These TIQ team leagues are the captain-owned competition containers that can feed lineups, availability, messaging, and seasonal operations."
          records={teamLeagues}
        />
        <LeagueListSection
          title="Individual Leagues"
          body="These TIQ individual leagues are the player-vs-player containers that stay separate from captain-led team workflows."
          records={individualLeagues}
          individualSummaries={individualLeagueSummaries}
          individualSuggestionSummaries={individualSuggestionSummaries}
        />
      </div>

    </CompetePageFrame>
  )
}

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

function LeagueListSection({
  title,
  body,
  records,
  individualSummaries,
  individualSuggestionSummaries,
}: {
  title: string
  body: string
  records: TiqLeagueRecord[]
  individualSummaries?: Map<string, TiqIndividualLeagueSummary>
  individualSuggestionSummaries?: Map<string, TiqIndividualSuggestionSummary>
}) {
  return (
    <section style={panelStyle}>
      <div style={sectionEyebrowStyle}>{title}</div>
      <div style={sectionTextStyle}>{body}</div>

      {records.length === 0 ? (
        <div style={emptyStyle}>No leagues in this format yet. Create one from the season dashboard.</div>
      ) : (
        <div style={listStyle}>
          {records.map((record) => {
            const summary = individualSummaries?.get(record.id)
            const suggestionSummary = individualSuggestionSummaries?.get(record.id)

            return (
              <div key={record.id} style={rowStyle}>
                <div>
                  <div style={rowTitleStyle}>{record.leagueName}</div>
                  <div style={rowMetaStyle}>
                    {[
                      getLeagueFormatLabel(record.leagueFormat),
                      record.leagueFormat === 'individual'
                        ? getTiqIndividualCompetitionFormatLabel(record.individualCompetitionFormat)
                        : null,
                      record.seasonLabel,
                      record.locationLabel,
                    ]
                      .filter(Boolean)
                      .join(' | ')}
                  </div>
                  <div style={rowPreviewStyle}>
                    {record.leagueFormat === 'team'
                      ? record.teams.slice(0, 3).join(' • ') || 'No team entries yet'
                      : summary
                        ? `${getTiqIndividualCompetitionFormatPreview(record.individualCompetitionFormat)} Leader ${summary.leaderName} (${summary.leaderRecord})${summary.leaderRecentForm ? ` • Form ${summary.leaderRecentForm}` : ''}`
                        : record.players.slice(0, 3).join(' • ') ||
                          getTiqIndividualCompetitionFormatPreview(record.individualCompetitionFormat)}
                  </div>
                  {record.leagueFormat === 'individual' ? (
                    <div style={rowActionHintStyle}>
                      {getTiqIndividualCompetitionFormatNextAction(
                        record.individualCompetitionFormat,
                        record.leagueName,
                      )}
                    </div>
                  ) : null}
                  {record.leagueFormat === 'individual' && suggestionSummary ? (
                    <div style={rowSuggestionStyle}>
                      {suggestionSummary.openCount > 0
                        ? `${suggestionSummary.openCount} open TIQ prompt${suggestionSummary.openCount === 1 ? '' : 's'}${suggestionSummary.claimedOpenCount ? ` • ${suggestionSummary.claimedOpenCount} claimed${suggestionSummary.latestClaimedByLabel ? ` by ${suggestionSummary.latestClaimedByLabel}` : ''}` : ''}${suggestionSummary.latestOpenTitle ? ` • ${suggestionSummary.latestOpenTitle}` : ''}`
                        : `${suggestionSummary.completedCount} TIQ prompt${suggestionSummary.completedCount === 1 ? '' : 's'} completed`}
                    </div>
                  ) : null}
                </div>
                <div style={rowActionStackStyle}>
                  <div style={rowMetaStrongStyle}>
                    {record.leagueFormat === 'team'
                      ? `${record.teams.length} teams`
                      : `${summary?.resultCount || 0} results`}
                  </div>
                  <RowLink href={`/explore/leagues/tiq/${encodeURIComponent(record.id)}?league_id=${encodeURIComponent(record.id)}`}>
                    Open league
                  </RowLink>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

const warningStyle = {
  padding: '10px 14px',
  borderRadius: '12px',
  border: '1px solid rgba(251,191,36,0.18)',
  background: 'rgba(120,80,0,0.18)',
  color: 'rgba(253,230,138,0.88)',
  fontSize: '13px',
  lineHeight: 1.55,
} as const

const upgradeWrapStyle = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gap: '16px',
  marginTop: '24px',
} as const

const upgradeIntroStyle = {
  display: 'grid',
  gap: '10px',
} as const

const upgradeTitleStyle = {
  color: '#f4f9ff',
  fontSize: 'clamp(1.4rem, 2vw, 2rem)',
  lineHeight: 1.08,
  fontWeight: 900,
  letterSpacing: '-0.04em',
} as const

const upgradeGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '16px',
} as const

const sectionWrap = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '16px',
  marginTop: '24px',
} as const

const panelStyle = {
  display: 'grid',
  gap: '12px',
  padding: '20px',
  borderRadius: '24px',
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'linear-gradient(180deg, rgba(13,28,54,0.90) 0%, rgba(8,18,36,0.96) 100%)',
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

const rowPreviewStyle = {
  marginTop: '8px',
  color: 'rgba(233,241,252,0.82)',
  fontSize: '13px',
  lineHeight: 1.6,
} as const

const rowActionHintStyle = {
  marginTop: '8px',
  color: 'rgba(155,225,29,0.86)',
  fontSize: '12px',
  lineHeight: 1.55,
} as const

const rowSuggestionStyle = {
  marginTop: '8px',
  color: 'rgba(147,197,253,0.84)',
  fontSize: '12px',
  lineHeight: 1.55,
} as const

const rowActionStackStyle = {
  display: 'grid',
  justifyItems: 'end',
  gap: '8px',
} as const

const rowMetaStrongStyle = {
  color: '#dffad5',
  fontSize: '13px',
  fontWeight: 800,
  whiteSpace: 'nowrap',
} as const

const rowLinkStyle = {
  color: '#dfeeff',
  fontSize: '13px',
  fontWeight: 800,
  textDecoration: 'none',
} as const
