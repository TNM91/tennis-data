'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import SiteShell from '@/app/components/site-shell'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import { buildProductAccessState, type ProductEntitlementSnapshot } from '@/lib/access-model'
import {
  buildExploreLeagueHref,
  getCompetitionLayerDescription,
  getCompetitionLayerLabel,
  getLeagueFormatLabel,
  type CompetitionLayer,
} from '@/lib/competition-layers'
import { getClientAuthState } from '@/lib/auth'
import {
  getTiqIndividualCompetitionFormatLabel,
  getTiqIndividualCompetitionFormatPreview,
} from '@/lib/tiq-individual-format'
import type { LeagueCard, LeagueSummaryPayload } from '@/lib/league-summary'
import {
  buildLeagueCardsFromRegistry,
} from '@/lib/tiq-league-registry'
import { listTiqIndividualLeagueResults } from '@/lib/tiq-individual-results-service'
import { formatDate } from '@/lib/captain-formatters'
import {
  buildTiqIndividualLeagueSummaries,
  type TiqIndividualLeagueSummary,
} from '@/lib/tiq-individual-results-summary'
import { listTiqLeagues } from '@/lib/tiq-league-service'
import { type UserRole } from '@/lib/roles'

const LEAGUE_SUMMARY_TIMEOUT_MS = 12000

type LayerFilter = 'all' | CompetitionLayer

function safeText(value: string | null | undefined) {
  return (value || '').trim()
}

function buildLeagueSubtitle(league: LeagueCard) {
  return [league.flight, league.ustaSection, league.districtArea]
    .map((value) => safeText(value))
    .filter(Boolean)
    .join(' | ')
}

export default function ExploreLeaguesPage() {
  const [role, setRole] = useState<UserRole>('public')
  const [entitlements, setEntitlements] = useState<ProductEntitlementSnapshot | null>(null)
  const [leagues, setLeagues] = useState<LeagueCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [layerFilter, setLayerFilter] = useState<LayerFilter>('all')
  const [summary, setSummary] = useState({
    totalMatches: 0,
    totalFlights: 0,
    latestMatch: null as string | null,
  })
  const [registryLeagues, setRegistryLeagues] = useState<LeagueCard[]>([])
  const [registryWarning, setRegistryWarning] = useState('')
  const [individualLeagueSummaries, setIndividualLeagueSummaries] = useState<Map<string, TiqIndividualLeagueSummary>>(
    new Map(),
  )
  const access = useMemo(() => buildProductAccessState(role, entitlements), [role, entitlements])

  useEffect(() => {
    void loadLeagueSummary()
    void loadRegistryLeagues()
    void loadIndividualLeagueResults()
  }, [])

  useEffect(() => {
    let active = true

    async function loadAuth() {
      try {
        const authState = await getClientAuthState()
        if (!active) return
        setRole(authState.role)
        setEntitlements(authState.entitlements)
      } catch {
        if (!active) return
        setRole('public')
        setEntitlements(null)
      }
    }

    void loadAuth()

    return () => {
      active = false
    }
  }, [])

  async function loadLeagueSummary() {
    setLoading(true)
    setError('')
    setNotice('')

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), LEAGUE_SUMMARY_TIMEOUT_MS)

    try {
      const response = await fetch('/api/leagues/summary', {
        cache: 'no-store',
        signal: controller.signal,
      })

      const payload = (await response.json()) as LeagueSummaryPayload & { error?: string }

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load league summary.')
      }

      setLeagues(payload.leagues || [])
      setNotice(payload.notice || '')
      setSummary({
        totalMatches: payload.totalMatches || 0,
        totalFlights: payload.totalFlights || 0,
        latestMatch: payload.latestMatch || null,
      })
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setError('League loading timed out after 12 seconds.')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load leagues.')
      }
    } finally {
      window.clearTimeout(timeoutId)
      setLoading(false)
    }
  }

  async function loadRegistryLeagues() {
    const result = await listTiqLeagues()
    setRegistryLeagues(buildLeagueCardsFromRegistry(result.records))
    setRegistryWarning(result.warning || '')
  }

  async function loadIndividualLeagueResults() {
    const result = await listTiqIndividualLeagueResults()
    setIndividualLeagueSummaries(buildTiqIndividualLeagueSummaries(result.results))
    if (result.warning) {
      setRegistryWarning((current) => current || result.warning || '')
    }
  }

  const decoratedLeagues = useMemo(() => {
    return [...leagues, ...registryLeagues].map((league) => ({
      ...league,
      subtitle: buildLeagueSubtitle(league),
    }))
  }, [leagues, registryLeagues])

  const filteredLeagues = useMemo(() => {
    const term = search.trim().toLowerCase()

    return decoratedLeagues.filter((league) => {
      const matchesLayer = layerFilter === 'all' || league.competitionLayer === layerFilter
      const matchesSearch =
        !term ||
        league.leagueName.toLowerCase().includes(term) ||
        league.flight.toLowerCase().includes(term) ||
        league.ustaSection.toLowerCase().includes(term) ||
        league.districtArea.toLowerCase().includes(term)

      return matchesLayer && matchesSearch
    })
  }, [decoratedLeagues, layerFilter, search])

  const ustaLeagues = useMemo(
    () => filteredLeagues.filter((league) => league.competitionLayer === 'usta'),
    [filteredLeagues],
  )

  const tiqTeamLeagues = useMemo(
    () =>
      filteredLeagues.filter(
        (league) => league.competitionLayer === 'tiq' && league.leagueFormat === 'team',
      ),
    [filteredLeagues],
  )

  const tiqIndividualLeagues = useMemo(
    () =>
      filteredLeagues.filter(
        (league) => league.competitionLayer === 'tiq' && league.leagueFormat === 'individual',
      ),
    [filteredLeagues],
  )

  const layerCounts = useMemo(() => {
    const counts = {
      usta: 0,
      tiq: 0,
    }

    for (const league of decoratedLeagues) {
      counts[league.competitionLayer] += 1
    }

    return counts
  }, [decoratedLeagues])

  return (
    <SiteShell active="/explore">
      <section style={wrapStyle}>
        <div style={heroStyle}>
          <div style={noiseStyle} />

          <div style={heroGridStyle}>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={eyebrowStyle}>Explore leagues</div>
              <h1 style={titleStyle}>Separate official USTA context from TIQ competition growth.</h1>
              <p style={descriptionStyle}>
                Browse league containers the way the product should think about them: USTA as
                external baseline truth, and TIQ as the internal competition layer for strategy,
                monetization, and growth.
              </p>

              <div style={heroPillRowStyle}>
                <span style={heroPillBlueStyle}>{layerCounts.usta} USTA leagues</span>
                <span style={heroPillGreenStyle}>{layerCounts.tiq} TIQ leagues</span>
                <span style={heroPillBlueStyle}>{summary.totalFlights} flights</span>
                <span style={heroPillBlueStyle}>Latest: {formatDate(summary.latestMatch)}</span>
              </div>
            </div>

            <div style={heroPanelStyle}>
              <div style={heroPanelLabelStyle}>Product model</div>
              <div style={heroPanelValueStyle}>One player, multiple competition contexts.</div>
              <div style={heroPanelTextStyle}>
                USTA answers status questions. TIQ answers strategy questions. These routes now keep
                the two concepts structurally separate instead of blending them into one mixed league
                list.
              </div>
            </div>
          </div>

          <div style={filterBarStyle}>
            <div style={searchGroupStyle}>
              <label htmlFor="explore-league-search" style={labelStyle}>
                Search leagues
              </label>
              <input
                id="explore-league-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by league, flight, section, or district"
                style={inputStyle}
              />
            </div>

            <div style={layerToggleGroupStyle}>
              <button
                type="button"
                onClick={() => setLayerFilter('all')}
                style={layerFilter === 'all' ? toggleActiveStyle : toggleStyle}
              >
                All Layers
              </button>
              <button
                type="button"
                onClick={() => setLayerFilter('usta')}
                style={layerFilter === 'usta' ? toggleActiveStyle : toggleStyle}
              >
                USTA
              </button>
              <button
                type="button"
                onClick={() => setLayerFilter('tiq')}
                style={layerFilter === 'tiq' ? toggleActiveStyle : toggleStyle}
              >
                TIQ
              </button>
            </div>
          </div>

          {notice ? <div style={noticeStyle}>{notice}</div> : null}
          {registryWarning ? <div style={noticeStyle}>{registryWarning}</div> : null}
        </div>

        {loading ? <div style={stateStyle}>Loading league layers...</div> : null}
        {error ? <div style={errorStyle}>{error}</div> : null}

        {!loading && !error ? (
          <>
            <div style={upgradeGridStyle}>
              {!access.canUseCaptainWorkflow ? (
                <UpgradePrompt
                  planId="captain"
                  compact
                  headline="Need TIQ team leagues to turn into smarter weekly decisions?"
                  body="Unlock Captain to move from league discovery into availability, lineups, scenarios, and team messaging without losing context."
                  ctaLabel="Unlock Captain Tools"
                  ctaHref="/pricing"
                  secondaryLabel="See Captain value"
                  secondaryHref="/pricing"
                />
              ) : null}
              {!access.canUseLeagueTools ? (
                <UpgradePrompt
                  planId="league"
                  compact
                  headline="Want to run TIQ leagues without spreadsheets?"
                  body="League tools give organizers one place for season setup, scheduling, standings, and league-wide communication."
                  ctaLabel="Run Your League on TIQ"
                  ctaHref="/pricing"
                  secondaryLabel="See league plan"
                  secondaryHref="/pricing"
                />
              ) : null}
            </div>

            <LeagueSection
              title="USTA Leagues"
              eyebrow={getCompetitionLayerLabel('usta')}
              description={getCompetitionLayerDescription('usta')}
              leagues={ustaLeagues}
              emptyTitle="No USTA leagues matched this view."
              emptyBody="Try widening the search, or switch back to all layers if you filtered down too far."
            />

            <LeagueSection
              title="TIQ Team Leagues"
              eyebrow="TIQ Team Competition"
              description="Internal team-based leagues for captains, availability, lineups, doubles strategy, and seasonal team operations."
              leagues={tiqTeamLeagues}
              emptyTitle="No TIQ team leagues are visible yet."
              emptyBody="This lane is now carved out in the product model so team-based TIQ league growth can land cleanly without being mixed into USTA browse flows."
            />

            <LeagueSection
              title="TIQ Individual Leagues"
              eyebrow="TIQ Individual Competition"
              description="Internal player-vs-player leagues for ladders, round robins, challenge formats, and standings without team or captain requirements."
              leagues={tiqIndividualLeagues}
              individualSummaries={individualLeagueSummaries}
              emptyTitle="No TIQ individual leagues are visible yet."
              emptyBody="This route now has a dedicated lane for player-vs-player TIQ competition, which is the right structural home for ladders and individual seasonal formats."
            />
          </>
        ) : null}
      </section>
    </SiteShell>
  )
}

function LeagueSection({
  title,
  eyebrow,
  description,
  leagues,
  individualSummaries,
  emptyTitle,
  emptyBody,
}: {
  title: string
  eyebrow: string
  description: string
  leagues: Array<
    LeagueCard & {
      competitionLayer: CompetitionLayer
      leagueFormat: 'team' | 'individual'
      subtitle: string
    }
  >
  individualSummaries?: Map<string, TiqIndividualLeagueSummary>
  emptyTitle: string
  emptyBody: string
}) {
  return (
    <section style={sectionStyle}>
      <div style={sectionHeaderStyle}>
        <div>
          <div style={sectionEyebrowStyle}>{eyebrow}</div>
          <h2 style={sectionTitleStyle}>{title}</h2>
        </div>
        <p style={sectionDescriptionStyle}>{description}</p>
      </div>

      {leagues.length === 0 ? (
        <div style={emptyCardStyle}>
          <div style={emptyTitleStyle}>{emptyTitle}</div>
          <div style={emptyBodyStyle}>{emptyBody}</div>
          <div style={emptyActionRowStyle}>
            <GhostLink href="/compete">Open Compete</GhostLink>
            <GhostLink href="/captain">Open Captain</GhostLink>
          </div>
        </div>
      ) : (
        <div style={gridStyle}>
          {leagues.map((league) => (
            <Link key={league.key} href={buildExploreLeagueHref(league)} style={cardStyle}>
              <div style={cardMetaRowStyle}>
                <span style={league.competitionLayer === 'usta' ? metaBlueStyle : metaGreenStyle}>
                  {getCompetitionLayerLabel(league.competitionLayer)}
                </span>
                <span style={metaSlateStyle}>{getLeagueFormatLabel(league.leagueFormat)}</span>
              </div>
              <div style={cardTitleStyle}>{league.leagueName}</div>
              <div style={cardSubtitleStyle}>{league.subtitle || 'League context not yet labeled'}</div>
              <div style={miniStatsStyle}>
                {league.competitionLayer === 'tiq' && league.leagueFormat === 'individual' ? (
                  <span>{getTiqIndividualCompetitionFormatLabel((league as LeagueCard & { individualCompetitionFormat?: string }).individualCompetitionFormat)}</span>
                ) : null}
                <span>{league.matchCount} matches</span>
                <span>{league.teamCount} teams</span>
                <span>{formatDate(league.latestMatchDate)}</span>
              </div>
              {league.competitionLayer === 'tiq' && league.leagueFormat === 'individual' ? (
                <div style={formatPreviewStyle}>
                  {getTiqIndividualCompetitionFormatPreview(
                    (league as LeagueCard & { individualCompetitionFormat?: string })
                      .individualCompetitionFormat,
                  )}
                </div>
              ) : null}
              {league.competitionLayer === 'tiq' && league.leagueFormat === 'individual' ? (
                <div style={individualSummaryStyle}>
                  {(() => {
                    const summary = individualSummaries?.get(league.leagueId || '')
                    if (!summary) return 'No TIQ results logged yet'
                    return `Leader: ${summary.leaderName} (${summary.leaderRecord})${summary.leaderRecentForm ? ` • Form ${summary.leaderRecentForm}` : ''} • ${summary.resultCount} results`
                  })()}
                </div>
              ) : null}
              <div style={cardCtaStyle}>Open league -&gt;</div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

const wrapStyle: CSSProperties = {
  padding: '14px 16px 28px',
}

const heroStyle: CSSProperties = {
  position: 'relative',
  maxWidth: '1280px',
  margin: '0 auto',
  padding: '34px 28px 28px',
  borderRadius: '32px',
  overflow: 'hidden',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg-strong)',
  boxShadow: 'var(--shadow-card)',
}

const noiseStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  background: `
    radial-gradient(circle at 0% 0%, rgba(74,163,255,0.18) 0%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(155,225,29,0.08) 0%, transparent 26%),
    linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%)
  `,
}

const heroGridStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.08fr) minmax(320px, 0.92fr)',
  gap: '24px',
}

const eyebrowStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'rgba(155,225,29,0.88)',
}

const titleStyle: CSSProperties = {
  margin: '10px 0 0',
  maxWidth: '760px',
  fontSize: '58px',
  lineHeight: 0.98,
  letterSpacing: '-0.04em',
  color: '#f4f9ff',
}

const descriptionStyle: CSSProperties = {
  margin: '16px 0 0',
  maxWidth: '700px',
  fontSize: '17px',
  lineHeight: 1.8,
  color: 'rgba(214,228,246,0.78)',
}

const heroPillRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  marginTop: '18px',
}

const heroPillBlueStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '34px',
  padding: '0 14px',
  borderRadius: '999px',
  background: 'rgba(74,163,255,0.14)',
  color: '#dfeeff',
  fontSize: '13px',
  fontWeight: 700,
}

const heroPillGreenStyle: CSSProperties = {
  ...heroPillBlueStyle,
  background: 'rgba(155,225,29,0.14)',
}

const heroPanelStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  padding: '22px',
  borderRadius: '24px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  boxShadow: 'var(--shadow-soft)',
}

const heroPanelLabelStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'rgba(116,190,255,0.82)',
}

const heroPanelValueStyle: CSSProperties = {
  marginTop: '12px',
  fontSize: '28px',
  lineHeight: 1.15,
  fontWeight: 800,
  color: '#f4f9ff',
}

const heroPanelTextStyle: CSSProperties = {
  marginTop: '14px',
  fontSize: '15px',
  lineHeight: 1.8,
  color: 'rgba(214,228,246,0.74)',
}

const filterBarStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: '16px',
  marginTop: '24px',
}

const searchGroupStyle: CSSProperties = {
  display: 'grid',
  gap: '8px',
}

const labelStyle: CSSProperties = {
  color: '#f4f9ff',
  fontSize: '13px',
  fontWeight: 700,
}

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: '48px',
  padding: '0 16px',
  borderRadius: '16px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  outline: 'none',
}

const layerToggleGroupStyle: CSSProperties = {
  display: 'flex',
  gap: '10px',
  alignItems: 'end',
}

const toggleStyle: CSSProperties = {
  minHeight: '48px',
  padding: '0 16px',
  borderRadius: '16px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  fontWeight: 700,
  cursor: 'pointer',
}

const toggleActiveStyle: CSSProperties = {
  ...toggleStyle,
  border: '1px solid rgba(155,225,29,0.26)',
  background: 'rgba(155,225,29,0.12)',
  color: '#f4f9ff',
}

const noticeStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  marginTop: '18px',
  padding: '14px 16px',
  borderRadius: '18px',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  fontSize: '14px',
  lineHeight: 1.7,
  border: '1px solid var(--shell-panel-border)',
}

const sectionStyle: CSSProperties = {
  maxWidth: '1280px',
  margin: '18px auto 0',
  padding: '22px',
  borderRadius: '28px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  boxShadow: 'var(--shadow-soft)',
}

const sectionHeaderStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 0.9fr) minmax(260px, 1.1fr)',
  gap: '22px',
  alignItems: 'end',
}

const sectionEyebrowStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'rgba(116,190,255,0.82)',
}

const sectionTitleStyle: CSSProperties = {
  margin: '8px 0 0',
  fontSize: '34px',
  lineHeight: 1.05,
  letterSpacing: '-0.03em',
  color: '#f4f9ff',
}

const sectionDescriptionStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(214,228,246,0.72)',
  fontSize: '15px',
  lineHeight: 1.8,
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
  gap: '16px',
  marginTop: '20px',
}

const cardStyle: CSSProperties = {
  display: 'grid',
  gap: '12px',
  minHeight: '228px',
  padding: '20px',
  borderRadius: '24px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  textDecoration: 'none',
  boxShadow: 'var(--shadow-soft)',
}

const cardMetaRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
}

const metaBlueStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '28px',
  padding: '0 10px',
  borderRadius: '999px',
  background: 'rgba(74,163,255,0.14)',
  color: '#dfeeff',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const metaGreenStyle: CSSProperties = {
  ...metaBlueStyle,
  background: 'rgba(155,225,29,0.14)',
}

const metaSlateStyle: CSSProperties = {
  ...metaBlueStyle,
  background: 'rgba(142, 161, 189, 0.14)',
}

const cardTitleStyle: CSSProperties = {
  fontSize: '25px',
  lineHeight: 1.1,
  fontWeight: 800,
  color: '#f4f9ff',
}

const cardSubtitleStyle: CSSProperties = {
  color: 'rgba(214,228,246,0.72)',
  fontSize: '14px',
  lineHeight: 1.75,
}

const miniStatsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px 14px',
  color: 'rgba(190,205,226,0.68)',
  fontSize: '13px',
  fontWeight: 700,
}

const formatPreviewStyle: CSSProperties = {
  color: 'rgba(214,228,246,0.76)',
  fontSize: '13px',
  lineHeight: 1.65,
}

const cardCtaStyle: CSSProperties = {
  alignSelf: 'end',
  fontSize: '13px',
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'rgba(155,225,29,0.88)',
}

const individualSummaryStyle: CSSProperties = {
  padding: '10px 12px',
  borderRadius: '14px',
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'rgba(255,255,255,0.04)',
  color: 'rgba(228,238,252,0.84)',
  fontSize: '12px',
  lineHeight: 1.6,
}

const emptyCardStyle: CSSProperties = {
  marginTop: '20px',
  padding: '22px',
  borderRadius: '24px',
  border: '1px solid rgba(116,190,255,0.08)',
  background: 'rgba(9,18,35,0.84)',
}

const emptyTitleStyle: CSSProperties = {
  fontSize: '20px',
  fontWeight: 800,
  color: '#f4f9ff',
}

const emptyBodyStyle: CSSProperties = {
  marginTop: '10px',
  color: 'rgba(214,228,246,0.72)',
  fontSize: '14px',
  lineHeight: 1.8,
  maxWidth: '760px',
}

const emptyActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  marginTop: '16px',
}

const ghostButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '42px',
  padding: '0 14px',
  borderRadius: '999px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  fontWeight: 700,
}

const stateStyle: CSSProperties = {
  maxWidth: '1280px',
  margin: '18px auto 0',
  padding: '18px 20px',
  borderRadius: '22px',
  background: 'var(--shell-panel-bg)',
  color: 'var(--foreground-strong)',
  border: '1px solid var(--shell-panel-border)',
}

const errorStyle: CSSProperties = {
  ...stateStyle,
  color: '#ffd8d8',
  border: '1px solid rgba(255,120,120,0.18)',
}

const upgradeGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: '16px',
  marginBottom: '24px',
}

function GhostLink({ href, children }: { href: string; children: ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      style={{ ...ghostButtonStyle, ...(hovered ? { background: 'rgba(20,36,66,0.90)', transform: 'translateY(-2px)', boxShadow: '0 6px 18px rgba(2,10,24,0.28)' } : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </Link>
  )
}
