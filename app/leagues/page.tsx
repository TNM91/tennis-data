'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { CSSProperties, useEffect, useMemo, useState } from 'react'
import AdsenseSlot from '@/app/components/adsense-slot'
import FollowButton from '@/app/components/follow-button'
import SiteShell from '@/app/components/site-shell'
import {
  getCompetitionLayerLabel,
  getLeagueFormatLabel,
} from '@/lib/competition-layers'
import type { LeagueCard, LeagueSummaryPayload } from '@/lib/league-summary'
import { formatDate } from '@/lib/captain-formatters'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

const LEAGUE_SUMMARY_TIMEOUT_MS = 12000
const LEAGUES_INLINE_AD_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT_LEAGUES_INLINE || null

function safeText(value: string | null | undefined) {
  return (value || '').trim()
}

function buildLeagueHref(league: LeagueCard) {
  const slugBase = safeText(league.leagueName) || 'league'
  const params = new URLSearchParams()

  if (safeText(league.leagueName)) params.set('league', league.leagueName)
  if (safeText(league.flight)) params.set('flight', league.flight)
  if (safeText(league.ustaSection)) params.set('section', league.ustaSection)
  if (safeText(league.districtArea)) params.set('district', league.districtArea)
  params.set('layer', league.competitionLayer)
  params.set('format', league.leagueFormat)

  const query = params.toString()
  return `/leagues/${encodeURIComponent(slugBase)}${query ? `?${query}` : ''}`
}

function buildLeagueSubtitle(league: LeagueCard) {
  return [league.flight, league.ustaSection, league.districtArea]
    .map((value) => safeText(value))
    .filter(Boolean)
    .join(' | ')
}

export default function LeaguesPage() {
  const [leagues, setLeagues] = useState<LeagueCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [datasetTotalMatches, setDatasetTotalMatches] = useState(0)
  const [datasetTotalParentMatches, setDatasetTotalParentMatches] = useState(0)
  const [datasetTotalFlights, setDatasetTotalFlights] = useState(0)
  const [datasetLatestMatch, setDatasetLatestMatch] = useState<string | null>(null)
  const [diagnostics, setDiagnostics] = useState<LeagueSummaryPayload['diagnostics']>({
    totalParentMatches: 0,
    namedParentMatches: 0,
    missingLeagueNameCount: 0,
    missingTeamCount: 0,
    sampleMissingLeagueRows: [],
  })
  const [search, setSearch] = useState('')
  const [flightFilter, setFlightFilter] = useState('all')
  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()

  useEffect(() => {
    void loadLeagueSummary()
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
      setDatasetTotalMatches(payload.totalMatches || 0)
      setDatasetTotalParentMatches(payload.diagnostics?.totalParentMatches || payload.totalMatches || 0)
      setDatasetTotalFlights(payload.totalFlights || 0)
      setDatasetLatestMatch(payload.latestMatch || null)
      setNotice(payload.notice || '')
      setDiagnostics(
        payload.diagnostics || {
          totalParentMatches: 0,
          namedParentMatches: 0,
          missingLeagueNameCount: 0,
          missingTeamCount: 0,
          sampleMissingLeagueRows: [],
        }
      )
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setError(
          'League loading timed out after 12 seconds. The import likely succeeded, but the summary request took too long.'
        )
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load leagues.')
      }
    } finally {
      window.clearTimeout(timeoutId)
      setLoading(false)
    }
  }

  const flights = useMemo(() => {
    const unique = [...new Set(leagues.map((league) => league.flight).filter(Boolean))]
    return unique.sort((a, b) => a.localeCompare(b))
  }, [leagues])

  const filteredLeagues = useMemo(() => {
    const term = search.trim().toLowerCase()

    return leagues.filter((league) => {
      const matchesFlight = flightFilter === 'all' || league.flight === flightFilter
      const matchesSearch =
        !term ||
        league.leagueName.toLowerCase().includes(term) ||
        league.flight.toLowerCase().includes(term) ||
        league.ustaSection.toLowerCase().includes(term) ||
        league.districtArea.toLowerCase().includes(term)

      return matchesFlight && matchesSearch
    })
  }, [leagues, search, flightFilter])

  const hasActiveFilters = search.trim().length > 0 || flightFilter !== 'all'

  const visibleMatchCount = useMemo(() => {
    return filteredLeagues.reduce((sum, league) => sum + league.matchCount, 0)
  }, [filteredLeagues])

  const summary = useMemo(() => {
    return {
      totalLeagues: filteredLeagues.length,
      totalMatches: datasetTotalMatches,
      totalFlights: datasetTotalFlights,
      latestMatch: datasetLatestMatch,
    }
  }, [datasetLatestMatch, datasetTotalFlights, datasetTotalMatches, filteredLeagues.length])

  const dynamicHeroWrap: CSSProperties = {
    ...heroWrap,
    padding: isMobile ? '14px 16px 22px' : '10px 18px 24px',
  }

  const dynamicHeroShell: CSSProperties = {
    ...heroShell,
    padding: isMobile ? '28px 18px 22px' : '34px 28px 24px',
  }

  const dynamicHeroContent: CSSProperties = {
    ...heroContent,
    gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 0.95fr) minmax(0, 1.05fr)',
    gap: isMobile ? '18px' : '22px',
  }

  const dynamicHeroTitle: CSSProperties = {
    ...heroTitle,
    fontSize: isSmallMobile ? '34px' : isMobile ? '46px' : '60px',
    lineHeight: isMobile ? 1.04 : 0.98,
    maxWidth: '560px',
  }

  const dynamicHeroText: CSSProperties = {
    ...heroText,
    fontSize: isMobile ? '16px' : '18px',
    maxWidth: '560px',
  }

  const dynamicCoverageCard: CSSProperties = {
    ...coverageCard,
    position: isTablet ? 'relative' : 'sticky',
    top: isTablet ? 'auto' : '24px',
  }

  const dynamicSummaryGrid: CSSProperties = {
    ...summaryGrid,
    gridTemplateColumns: isSmallMobile
      ? '1fr'
      : isMobile
        ? 'repeat(2, minmax(0, 1fr))'
        : 'repeat(4, minmax(0, 1fr))',
  }

  const dynamicFilterGrid: CSSProperties = {
    ...filterGrid,
    gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 220px',
  }

  const dynamicCardGrid: CSSProperties = {
    ...cardGrid,
    gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))',
  }

  const dynamicLeagueDetailGrid: CSSProperties = {
    ...leagueDetailGrid,
    gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
  }

  const dynamicLeagueTop: CSSProperties = {
    ...leagueTop,
    flexDirection: isMobile ? 'column' : 'row',
    alignItems: isMobile ? 'stretch' : 'flex-start',
  }

  return (
    <SiteShell active="leagues">
      <section style={dynamicHeroWrap}>
        <div style={dynamicHeroShell}>
          <div style={heroNoise} />

          <div style={dynamicHeroContent}>
            <div style={heroLeft}>
              <div style={eyebrow}>League Explorer</div>
              <h1 style={dynamicHeroTitle}>Browse imported league seasons.</h1>
              <p style={dynamicHeroText}>
                Explore league groupings by league name, flight, section, and district.
                This is the foundation for season views, team pages, matchup prep, and future lineup
                projections across TenAceIQ.
              </p>

              <div style={heroHintRow}>
                <span style={heroHintPill}>{summary.totalLeagues} leagues</span>
                <span style={heroHintPill}>{datasetTotalParentMatches} imported parent matches</span>
                <span style={heroHintPill}>Latest: {formatDate(summary.latestMatch)}</span>
              </div>
            </div>

            <div style={dynamicCoverageCard}>
              <div style={coverageLabel}>Coverage snapshot</div>
              <div style={coverageValue}>{summary.totalFlights}</div>
              <div style={coverageText}>
                Unique flights currently represented across matches with a real league name.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={contentWrap}>
        {!loading && !error ? (
          <article style={editorialPanel}>
            <div style={sectionKicker}>Season context</div>
            <h2 style={panelTitle}>League cards are strongest when they explain structure, not just existence.</h2>
            <p style={editorialText}>
              Use this board to understand how season data is grouped across league name, flight,
              section, and district. It is the discovery layer for season browsing, and it becomes
              much more useful once you move from a league card into the underlying team and season view.
            </p>
            <div style={editorialGrid}>
              <div style={editorialCard}>
                <div style={editorialCardLabel}>Visible leagues</div>
                <div style={editorialCardValue}>{summary.totalLeagues}</div>
                <div style={editorialCardText}>Named league groupings currently available to browse.</div>
              </div>
              <div style={editorialCard}>
                <div style={editorialCardLabel}>Imported parent matches</div>
                <div style={editorialCardValue}>{datasetTotalParentMatches}</div>
                <div style={editorialCardText}>The schedule-level season rows powering league discovery.</div>
              </div>
              <div style={editorialCard}>
                <div style={editorialCardLabel}>Best next step</div>
                <div style={editorialCardValue}>Open season</div>
                <div style={editorialCardText}>Use league cards to narrow the field, then inspect the actual season detail.</div>
              </div>
            </div>
          </article>
        ) : null}

        <div style={dynamicSummaryGrid}>
          <MetricCard label="Visible leagues" value={String(summary.totalLeagues)} />
          <MetricCard label="League matches" value={String(summary.totalMatches)} />
          <MetricCard label="Flights" value={String(summary.totalFlights)} />
          <MetricCard label="Latest match" value={formatDate(summary.latestMatch)} accent />
        </div>

        <article style={panelCard}>
          <div style={panelHead}>
            <div>
              <div style={sectionKicker}>Filters</div>
              <h2 style={panelTitle}>Search and narrow league groups</h2>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => void loadLeagueSummary()} style={clearFilterButton}>
                {loading ? 'Refreshing...' : 'Refresh league summary'}
              </button>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    setFlightFilter('all')
                  }}
                  style={clearFilterButton}
                >
                  Clear active filters
                </button>
              ) : null}
            </div>
          </div>

          <div style={dynamicFilterGrid}>
            <div>
              <label htmlFor="league-search" style={inputLabel}>Search</label>
              <div style={searchWrap}>
                <div style={searchIconWrap}>
                  <SearchIcon />
                </div>
                <input
                  id="league-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by league, flight, section, or district"
                  style={searchInput}
                />
              </div>
            </div>

            <div>
              <label htmlFor="league-flight-filter" style={inputLabel}>Flight</label>
              <select
                id="league-flight-filter"
                value={flightFilter}
                onChange={(e) => setFlightFilter(e.target.value)}
                style={selectStyle}
              >
                <option value="all">All Flights</option>
                {flights.map((flight) => (
                  <option key={flight} value={flight}>
                    {flight}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div style={stateBox}>
              <div style={sectionKicker}>Directory loading</div>
              <div>Loading leagues...</div>
              <div style={stateHelperTextStyle}>
                Rebuilding the browse layer from current league summary data.
              </div>
            </div>
          ) : error ? (
            <div style={errorBox}>
              <div style={sectionKicker}>Directory error</div>
              <div>{error}</div>
              <div style={stateHelperTextStyle}>
                Refresh the league summary to try again without leaving the page.
              </div>
              <div style={{ marginTop: 12 }}>
                <button type="button" onClick={() => void loadLeagueSummary()} style={clearFilterButton}>
                  Retry league load
                </button>
              </div>
            </div>
          ) : filteredLeagues.length === 0 ? (
            <div style={stateBox}>
              <div style={sectionKicker}>Directory reset</div>
              {hasActiveFilters
                ? 'No leagues matched the current search or flight filters.'
                : 'League records are not available yet.'}
              <div style={stateHelperTextStyle}>
                {hasActiveFilters
                  ? 'Clear the active filters to widen the season view, or try a broader search term across league, flight, section, or district.'
                  : 'League cards only appear when imported matches include a real league name, so this usually means more season data still needs to be imported or normalized.'}
              </div>
              {!hasActiveFilters && diagnostics.totalParentMatches > 0 ? (
                <div style={diagnosticWrap}>
                  <div style={diagnosticTitle}>Import diagnostics</div>
                  <div style={diagnosticText}>
                    I can see {diagnostics.totalParentMatches} parent matches in the dataset, but only {diagnostics.namedParentMatches} currently have a visible league name.
                  </div>
                  <div style={diagnosticChipRow}>
                    <span style={diagnosticChip}>
                      Missing league names: {diagnostics.missingLeagueNameCount}
                    </span>
                    <span style={diagnosticChip}>
                      Missing team names: {diagnostics.missingTeamCount}
                    </span>
                  </div>
                  {diagnostics.sampleMissingLeagueRows.length > 0 ? (
                    <div style={diagnosticSampleList}>
                      {diagnostics.sampleMissingLeagueRows.map((row) => (
                        <div key={row.externalMatchId} style={diagnosticSampleCard}>
                          <div style={diagnosticSampleTitle}>
                            {row.homeTeam || 'Home team not set'} vs {row.awayTeam || 'Away team not set'}
                          </div>
                          <div style={diagnosticSampleMeta}>
                            Match ID: {row.externalMatchId}
                          </div>
                          <div style={diagnosticSampleMeta}>
                            Scope: {[row.flight, row.ustaSection, row.districtArea].filter(Boolean).join(' | ') || 'No scope fields'}
                          </div>
                          <div style={diagnosticSampleMeta}>
                            Source: {row.source || 'Unknown'}{row.matchDate ? ` | ${formatDate(row.matchDate)}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <>
              {notice ? <div style={noticeBox}>{notice}</div> : null}
              {diagnostics.missingLeagueNameCount > 0 ? (
                <div style={noticeBox}>
                  {diagnostics.missingLeagueNameCount} imported parent matches are missing a visible league name, so they will not appear as league cards yet.
                </div>
              ) : null}

              <div style={summaryBadgeRow}>
                <span style={heroHintPill}>{filteredLeagues.length} visible leagues</span>
                <span style={heroHintPill}>{visibleMatchCount} visible league matches</span>
              </div>

              <div style={dynamicCardGrid}>
                {filteredLeagues.map((league) => (
                  <LeagueCardItem
                    key={league.key}
                    league={league}
                    isMobile={isMobile}
                    dynamicLeagueTop={dynamicLeagueTop}
                    dynamicLeagueDetailGrid={dynamicLeagueDetailGrid}
                  />
                ))}
              </div>
            </>
          )}
        </article>
      </section>
      <div style={{ marginTop: 12 }}>
        <AdsenseSlot slot={LEAGUES_INLINE_AD_SLOT} label="Sponsored" minHeight={250} />
      </div>
    </SiteShell>
  )
}

function LeagueCardItem({
  league,
  dynamicLeagueTop,
  dynamicLeagueDetailGrid,
}: {
  league: LeagueCard
  isMobile: boolean
  dynamicLeagueTop: CSSProperties
  dynamicLeagueDetailGrid: CSSProperties
}) {
  const [hovered, setHovered] = useState(false)
  const subtitle = buildLeagueSubtitle(league)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...leagueCard,
        borderColor: hovered ? 'rgba(140,184,255,0.34)' : 'rgba(140,184,255,0.18)',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered
          ? '0 22px 50px rgba(9,25,54,0.22), inset 0 1px 0 rgba(255,255,255,0.07)'
          : '0 14px 34px rgba(9,25,54,0.14), inset 0 1px 0 rgba(255,255,255,0.05)',
        transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
      }}
    >
      <div style={cardGlow} />

      <div style={dynamicLeagueTop}>
        <div style={leagueHeading}>
          <div style={leagueMetaRow}>
            <span style={league.competitionLayer === 'usta' ? leagueMetaBluePill : leagueMetaGreenPill}>
              {getCompetitionLayerLabel(league.competitionLayer)}
            </span>
            <span style={leagueMetaSlatePill}>
              {getLeagueFormatLabel(league.leagueFormat)}
            </span>
          </div>
          <div style={leagueTitle}>{league.leagueName}</div>
          {subtitle ? <div style={leagueFlight}>{subtitle}</div> : null}
        </div>

        <div style={leagueActionStack}>
          <div onClick={(e) => e.stopPropagation()} style={followWrap}>
            <FollowButton
              entityType="league"
              entityId={league.key}
              entityName={league.leagueName}
              subtitle={subtitle}
            />
          </div>

          <ViewSeasonButton href={buildLeagueHref(league)} />
        </div>
      </div>

      <div style={dynamicLeagueDetailGrid}>
        <DetailCard label="USTA Section" value={league.ustaSection} hideWhenEmpty />
        <DetailCard label="District / Area" value={league.districtArea} hideWhenEmpty />
        <DetailCard label="Matches" value={String(league.matchCount)} />
        <DetailCard label="Teams Seen" value={String(league.teamCount)} />
      </div>

      <div style={leagueBottom}>
        <span style={leagueBottomMeta}>
          Latest match: <strong>{formatDate(league.latestMatchDate)}</strong>
        </span>
      </div>
    </div>
  )
}

function ViewSeasonButton({ href }: { href: string }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...primaryButton,
        transform: hovered ? 'translateY(-1px)' : 'none',
        boxShadow: hovered
          ? '0 16px 36px rgba(43,195,104,0.28), inset 0 1px 0 rgba(255,255,255,0.30)'
          : '0 12px 30px rgba(43,195,104,0.20), inset 0 1px 0 rgba(255,255,255,0.26)',
        transition: 'transform 140ms ease, box-shadow 140ms ease',
      }}
    >
      View Season
    </Link>
  )
}

function MetricCard({
  label,
  value,
  accent = false,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div
      style={{
        ...metricCard,
        ...(accent ? metricCardAccent : {}),
      }}
    >
      <div style={metricLabel}>{label}</div>
      <div style={metricValue}>{value}</div>
    </div>
  )
}

function DetailCard({
  label,
  value,
  hideWhenEmpty = false,
}: {
  label: string
  value: string
  hideWhenEmpty?: boolean
}) {
  const text = safeText(value)

  if (hideWhenEmpty && !text) {
    return null
  }

  return (
    <div style={detailCard}>
      <div style={detailLabel}>{label}</div>
      <div style={detailValue}>{text || '-'}</div>
    </div>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" style={iconSvgStyle} aria-hidden="true">
      <circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <path d="M16 16l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
}

const heroWrap: CSSProperties = {
  position: 'relative',
  zIndex: 1,
}

const heroShell: CSSProperties = {
  width: '100%',
  maxWidth: '1280px',
  margin: '0 auto',
  borderRadius: '30px',
  background: 'var(--shell-panel-bg-strong)',
  border: '1px solid var(--shell-panel-border)',
  boxShadow: 'var(--shadow-card)',
  overflow: 'hidden',
  position: 'relative',
}

const heroNoise: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: `
    radial-gradient(circle at 12% 0%, rgba(116,190,255,0.26), transparent 28%),
    radial-gradient(circle at 72% 8%, rgba(88,170,255,0.18), transparent 24%),
    radial-gradient(circle at 100% 0%, rgba(155,225,29,0.10), transparent 26%),
    linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 26%)
  `,
  pointerEvents: 'none',
}

const heroContent: CSSProperties = {
  display: 'grid',
  alignItems: 'stretch',
  position: 'relative',
  zIndex: 1,
}

const heroLeft: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: '16px',
  minWidth: 0,
}

const heroTitle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  letterSpacing: '-0.045em',
}

const heroText: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.65,
  fontWeight: 500,
}

const eyebrow: CSSProperties = {
  display: 'inline-flex',
  width: 'fit-content',
  alignItems: 'center',
  padding: '8px 14px',
  borderRadius: '999px',
  color: 'var(--home-eyebrow-color)',
  background: 'var(--home-eyebrow-bg)',
  border: '1px solid var(--home-eyebrow-border)',
  fontSize: '12px',
  fontWeight: 900,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const heroHintRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  marginTop: '4px',
}

const heroHintPill: CSSProperties = {
  border: '1px solid rgba(116,190,255,0.22)',
  background:
    'linear-gradient(180deg, rgba(54,108,198,0.22) 0%, rgba(29,63,121,0.18) 100%)',
  color: '#eaf4ff',
  borderRadius: '999px',
  padding: '11px 16px',
  fontSize: '13px',
  fontWeight: 700,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
}

const coverageCard: CSSProperties = {
  borderRadius: '24px',
  padding: '18px',
  border: '1px solid var(--shell-panel-border)',
  background: 'color-mix(in srgb, var(--shell-panel-bg) 88%, var(--brand-blue-2) 12%)',
  boxShadow: 'var(--shadow-soft)',
}

const coverageLabel: CSSProperties = {
  color: 'rgba(217, 231, 255, 0.82)',
  fontSize: '12px',
  lineHeight: 1.5,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const coverageValue: CSSProperties = {
  marginTop: '8px',
  color: '#ffffff',
  fontSize: '34px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const coverageText: CSSProperties = {
  marginTop: '10px',
  color: 'rgba(219, 234, 254, 0.88)',
  fontSize: '14px',
  lineHeight: 1.65,
  fontWeight: 500,
}

const contentWrap: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  maxWidth: '1280px',
  margin: '0 auto',
  padding: '0 24px 0',
}

const editorialPanel: CSSProperties = {
  display: 'grid',
  gap: '14px',
  padding: '24px',
  borderRadius: '26px',
  background: 'var(--shell-panel-bg)',
  border: '1px solid var(--shell-panel-border)',
  boxShadow: 'var(--shadow-soft)',
  marginBottom: '18px',
}

const editorialText: CSSProperties = {
  margin: 0,
  color: 'rgba(220,233,248,0.78)',
  fontSize: '15px',
  lineHeight: 1.8,
  maxWidth: '860px',
}

const editorialGrid: CSSProperties = {
  display: 'grid',
  gap: '14px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
}

const editorialCard: CSSProperties = {
  display: 'grid',
  gap: '8px',
  padding: '18px',
  borderRadius: '20px',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.015) 100%)',
  border: '1px solid rgba(116,190,255,0.12)',
}

const editorialCardLabel: CSSProperties = {
  color: 'rgba(188,208,232,0.78)',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.11em',
  textTransform: 'uppercase',
}

const editorialCardValue: CSSProperties = {
  color: '#f8fbff',
  fontSize: '24px',
  lineHeight: 1.04,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const editorialCardText: CSSProperties = {
  color: 'rgba(215,229,247,0.76)',
  fontSize: '13px',
  lineHeight: 1.65,
}

const summaryGrid: CSSProperties = {
  display: 'grid',
  gap: '16px',
  marginBottom: '16px',
}

const metricCard: CSSProperties = {
  borderRadius: '24px',
  padding: '18px',
  border: '1px solid var(--shell-panel-border)',
  background: 'color-mix(in srgb, var(--shell-panel-bg) 90%, var(--brand-blue-2) 10%)',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const metricCardAccent: CSSProperties = {
  border: '1px solid color-mix(in srgb, var(--brand-green) 34%, var(--shell-panel-border) 66%)',
  boxShadow: 'var(--shadow-soft)',
}

const metricLabel: CSSProperties = {
  color: 'rgba(198,216,248,0.78)',
  fontSize: '13px',
  lineHeight: 1.5,
  fontWeight: 750,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const metricValue: CSSProperties = {
  marginTop: '8px',
  color: '#f8fbff',
  fontSize: '32px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const panelCard: CSSProperties = {
  borderRadius: '28px',
  padding: '20px',
  border: '1px solid var(--shell-panel-border)',
  background:
    'radial-gradient(circle at top right, color-mix(in srgb, var(--brand-green) 10%, transparent), transparent 34%), var(--shell-panel-bg)',
  boxShadow: 'var(--shadow-card)',
  minWidth: 0,
  marginBottom: '16px',
}

const panelHead: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '12px',
  marginBottom: '16px',
  flexWrap: 'wrap',
}

const sectionKicker: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontWeight: 800,
  fontSize: '13px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '8px',
}

const panelTitle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  fontSize: '28px',
  letterSpacing: '-0.04em',
}

const filterGrid: CSSProperties = {
  display: 'grid',
  gap: '14px',
  marginBottom: '16px',
}

const inputLabel: CSSProperties = {
  display: 'block',
  marginBottom: '8px',
  color: 'rgba(198,216,248,0.84)',
  fontSize: '13px',
  fontWeight: 800,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
}

const searchWrap: CSSProperties = {
  position: 'relative',
}

const searchIconWrap: CSSProperties = {
  position: 'absolute',
  left: '14px',
  top: '50%',
  transform: 'translateY(-50%)',
  color: 'rgba(210,226,244,0.82)',
  pointerEvents: 'none',
}

const searchInput: CSSProperties = {
  width: '100%',
  borderRadius: '18px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  padding: '15px 16px 15px 46px',
  fontSize: '15px',
  outline: 'none',
  boxShadow: 'var(--home-control-shadow)',
}

const clearFilterButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '38px',
  padding: '0 14px',
  borderRadius: '999px',
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.05)',
  color: '#e6eefb',
  fontWeight: 800,
  cursor: 'pointer',
}

const selectStyle: CSSProperties = {
  width: '100%',
  height: '52px',
  borderRadius: '18px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  padding: '0 14px',
  fontSize: '14px',
  fontWeight: 700,
  outline: 'none',
}

const stateBox: CSSProperties = {
  marginTop: '8px',
  borderRadius: '18px',
  padding: '18px',
  background: 'linear-gradient(180deg, rgba(38,67,118,0.46) 0%, rgba(22,40,78,0.58) 100%)',
  border: '1px solid rgba(128,174,255,0.14)',
  color: '#dbeafe',
  fontSize: '15px',
  lineHeight: 1.7,
  fontWeight: 600,
  textAlign: 'center',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
}

const errorBox: CSSProperties = {
  marginTop: '8px',
  borderRadius: '16px',
  padding: '12px 14px',
  background: 'rgba(239, 68, 68, 0.08)',
  border: '1px solid rgba(239, 68, 68, 0.18)',
  color: '#fecaca',
  fontWeight: 700,
  fontSize: '14px',
}

const noticeBox: CSSProperties = {
  marginTop: '8px',
  marginBottom: '14px',
  borderRadius: '16px',
  padding: '12px 14px',
  background: 'rgba(59, 130, 246, 0.10)',
  border: '1px solid rgba(96, 165, 250, 0.22)',
  color: '#dbeafe',
  fontWeight: 600,
  fontSize: '14px',
  lineHeight: 1.6,
}

const stateHelperTextStyle: CSSProperties = {
  marginTop: '10px',
  color: 'rgba(219,234,254,0.82)',
  fontSize: '14px',
  lineHeight: 1.65,
  fontWeight: 500,
}

const diagnosticWrap: CSSProperties = {
  marginTop: '16px',
  paddingTop: '16px',
  borderTop: '1px solid rgba(255,255,255,0.08)',
  display: 'grid',
  gap: '10px',
  textAlign: 'left',
}

const diagnosticTitle: CSSProperties = {
  color: '#f8fbff',
  fontSize: '14px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const diagnosticText: CSSProperties = {
  color: 'rgba(219,234,254,0.88)',
  fontSize: '14px',
  lineHeight: 1.65,
  fontWeight: 500,
}

const diagnosticChipRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
}

const diagnosticChip: CSSProperties = {
  borderRadius: '999px',
  padding: '8px 12px',
  border: '1px solid rgba(116,190,255,0.18)',
  background: 'rgba(18,34,67,0.54)',
  color: '#dbeafe',
  fontSize: '12px',
  fontWeight: 700,
}

const diagnosticSampleList: CSSProperties = {
  display: 'grid',
  gap: '10px',
}

const diagnosticSampleCard: CSSProperties = {
  borderRadius: '16px',
  padding: '12px 14px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(8,20,43,0.5)',
}

const diagnosticSampleTitle: CSSProperties = {
  color: '#f8fbff',
  fontSize: '14px',
  fontWeight: 700,
  lineHeight: 1.5,
}

const diagnosticSampleMeta: CSSProperties = {
  marginTop: '4px',
  color: 'rgba(219,234,254,0.8)',
  fontSize: '13px',
  lineHeight: 1.55,
}

const summaryBadgeRow: CSSProperties = {
  marginTop: '4px',
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
  marginBottom: '16px',
}

const cardGrid: CSSProperties = {
  display: 'grid',
  gap: '16px',
}

const leagueCard: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  borderRadius: '28px',
  padding: '20px',
  border: '1px solid var(--shell-panel-border)',
  background: 'color-mix(in srgb, var(--shell-panel-bg) 90%, var(--brand-blue-2) 10%)',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const cardGlow: CSSProperties = {
  position: 'absolute',
  top: '-70px',
  right: '-50px',
  width: '180px',
  height: '180px',
  borderRadius: '999px',
  background: 'radial-gradient(circle, rgba(78,178,255,0.24), rgba(78,178,255,0) 70%)',
  pointerEvents: 'none',
}

const leagueTop: CSSProperties = {
  position: 'relative',
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'flex-start',
  marginBottom: '16px',
}

const leagueHeading: CSSProperties = {
  minWidth: 0,
}

const leagueMetaRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  marginBottom: '10px',
}

const leagueMetaPillBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '28px',
  padding: '0 10px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const leagueMetaBluePill: CSSProperties = {
  ...leagueMetaPillBase,
  background: 'rgba(74,163,255,0.14)',
  color: '#dfeeff',
}

const leagueMetaGreenPill: CSSProperties = {
  ...leagueMetaPillBase,
  background: 'rgba(155,225,29,0.14)',
  color: '#e7ffd1',
}

const leagueMetaSlatePill: CSSProperties = {
  ...leagueMetaPillBase,
  background: 'rgba(142, 161, 189, 0.14)',
  color: '#dfe8f8',
}

const leagueTitle: CSSProperties = {
  color: '#f8fbff',
  fontSize: '28px',
  lineHeight: 1.1,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const leagueFlight: CSSProperties = {
  marginTop: '8px',
  color: '#8ec5ff',
  fontSize: '15px',
  lineHeight: 1.5,
  fontWeight: 800,
}

const leagueActionStack: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  alignItems: 'flex-end',
}

const followWrap: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
}

const primaryButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '44px',
  padding: '0 16px',
  borderRadius: '999px',
  background: 'linear-gradient(135deg, rgba(103, 241, 154, 1), rgba(40, 205, 110, 0.94))',
  color: '#071622',
  fontWeight: 900,
  fontSize: '13px',
  letterSpacing: '0.01em',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  boxShadow: '0 12px 30px rgba(43, 195, 104, 0.20), inset 0 1px 0 rgba(255,255,255,0.26)',
}

const leagueDetailGrid: CSSProperties = {
  display: 'grid',
  gap: '12px',
}

const detailCard: CSSProperties = {
  borderRadius: '18px',
  padding: '14px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  minWidth: 0,
}

const detailLabel: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  fontSize: '12px',
  fontWeight: 700,
  marginBottom: '6px',
}

const detailValue: CSSProperties = {
  color: '#f8fbff',
  fontSize: '16px',
  lineHeight: 1.45,
  fontWeight: 800,
  wordBreak: 'break-word',
}

const leagueBottom: CSSProperties = {
  marginTop: '16px',
  paddingTop: '16px',
  borderTop: '1px solid rgba(255,255,255,0.08)',
}

const leagueBottomMeta: CSSProperties = {
  color: '#d5e5fb',
  fontSize: '14px',
  lineHeight: 1.6,
  fontWeight: 600,
}

const iconSvgStyle: CSSProperties = {
  width: '22px',
  height: '22px',
}
