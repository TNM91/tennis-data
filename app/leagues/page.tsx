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
import { shouldShowSponsoredPlacements } from '@/lib/access-model'
import type { LeagueCard, LeagueSummaryPayload } from '@/lib/league-summary'
import { formatDate, cleanText as safeText } from '@/lib/captain-formatters'
import { DATA_ASSIST_STORY } from '@/lib/product-story'
import { useProductAccess } from '@/lib/use-product-access'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

const LEAGUE_SUMMARY_TIMEOUT_MS = 12000
const LEAGUES_INLINE_AD_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT_LEAGUES_INLINE || null

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
  const [yearFilter, setYearFilter] = useState('all')
  const [seasonFilter, setSeasonFilter] = useState('all')
  const [genderFilter, setGenderFilter] = useState('all')
  const [ratingFilter, setRatingFilter] = useState('all')
  const { isMobile, isSmallMobile } = useViewportBreakpoints()
  const { access, authResolved } = useProductAccess()
  const shouldShowAds = authResolved && shouldShowSponsoredPlacements(access)

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

  const years = useMemo(() => uniqueSorted(leagues.map((league) => league.year)), [leagues])
  const seasons = useMemo(() => uniqueSorted(leagues.map((league) => league.season)), [leagues])
  const genders = useMemo(() => uniqueSorted(leagues.map((league) => league.gender)), [leagues])
  const ratings = useMemo(() => uniqueSorted(leagues.map((league) => league.rating)), [leagues])

  const filteredLeagues = useMemo(() => {
    const term = search.trim().toLowerCase()

    return leagues.filter((league) => {
      const matchesFlight = flightFilter === 'all' || league.flight === flightFilter
      const matchesYear = yearFilter === 'all' || league.year === yearFilter
      const matchesSeason = seasonFilter === 'all' || league.season === seasonFilter
      const matchesGender = genderFilter === 'all' || league.gender === genderFilter
      const matchesRating = ratingFilter === 'all' || league.rating === ratingFilter
      const matchesSearch =
        !term ||
        league.leagueName.toLowerCase().includes(term) ||
        league.flight.toLowerCase().includes(term) ||
        league.ustaSection.toLowerCase().includes(term) ||
        league.districtArea.toLowerCase().includes(term)

      return matchesFlight && matchesYear && matchesSeason && matchesGender && matchesRating && matchesSearch
    })
  }, [leagues, search, flightFilter, yearFilter, seasonFilter, genderFilter, ratingFilter])

  const hasActiveFilters =
    search.trim().length > 0 ||
    flightFilter !== 'all' ||
    yearFilter !== 'all' ||
    seasonFilter !== 'all' ||
    genderFilter !== 'all' ||
    ratingFilter !== 'all'

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

  const dynamicSummaryGrid: CSSProperties = {
    ...summaryGrid,
    gridTemplateColumns: isSmallMobile
      ? 'minmax(0, 1fr)'
      : isMobile
        ? 'repeat(2, minmax(0, 1fr))'
        : 'repeat(4, minmax(0, 1fr))',
  }

  const dynamicFilterGrid: CSSProperties = {
    ...filterGrid,
    gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  }

  const dynamicCardGrid: CSSProperties = {
    ...cardGrid,
    gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
  }

  const dynamicLeagueDetailGrid: CSSProperties = {
    ...leagueDetailGrid,
    gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))',
  }

  const dynamicLeagueTop: CSSProperties = {
    ...leagueTop,
    flexDirection: isMobile ? 'column' : 'row',
    alignItems: isMobile ? 'stretch' : 'flex-start',
  }

  return (
    <SiteShell active="leagues">
      <section style={contentWrap}>
        <article style={panelCard}>
          <div style={panelHead}>
            <div>
              <div style={sectionKicker}>League discovery</div>
              <h2 style={panelTitle}>Find a league.</h2>
              <p style={panelIntro}>
                Search by league, flight, section, or district, then open the season view.
              </p>
            </div>
            <div style={filterActionRow}>
              <button type="button" onClick={() => void loadLeagueSummary()} style={clearFilterButton}>
                {loading ? 'Refreshing...' : 'Refresh league summary'}
              </button>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    setFlightFilter('all')
                    setYearFilter('all')
                    setSeasonFilter('all')
                    setGenderFilter('all')
                    setRatingFilter('all')
                  }}
                  style={clearFilterButton}
                >
                  Clear active filters
                </button>
              ) : null}
            </div>
          </div>

          <div style={dynamicSummaryGrid}>
            <MetricCard label="Visible leagues" value={String(summary.totalLeagues)} />
            <MetricCard label="League matches" value={String(summary.totalMatches)} />
            <MetricCard label="Flights" value={String(summary.totalFlights)} />
            <MetricCard label="Latest match" value={formatDate(summary.latestMatch)} accent />
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

            <FilterSelect id="league-year-filter" label="Year" value={yearFilter} onChange={setYearFilter} options={years} />
            <FilterSelect id="league-season-filter" label="Season" value={seasonFilter} onChange={setSeasonFilter} options={seasons} />
            <FilterSelect id="league-gender-filter" label="Male/Female" value={genderFilter} onChange={setGenderFilter} options={genders} />
            <FilterSelect id="league-rating-filter" label="Rating / Flight" value={ratingFilter} onChange={setRatingFilter} options={ratings} />

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
                  : 'League cards only appear when reviewed uploads include a real league name, so this usually means more season data still needs to be uploaded through Data Assist or normalized.'}
              </div>
              {!hasActiveFilters ? (
                <div style={emptyActionRow}>
                  <Link href={DATA_ASSIST_STORY.href} style={clearFilterButton}>
                    {DATA_ASSIST_STORY.cta}
                  </Link>
                </div>
              ) : null}
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
                  {diagnostics.missingLeagueNameCount} reviewed parent matches are missing a visible league name, so they will not appear as league cards yet.
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
      {shouldShowAds ? (
        <div style={{ marginTop: 12 }}>
          <AdsenseSlot slot={LEAGUES_INLINE_AD_SLOT} label="Sponsored" minHeight={250} />
        </div>
      ) : null}
    </SiteShell>
  )
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => safeText(value)).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  )
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: string[]
}) {
  return (
    <div>
      <label htmlFor={id} style={inputLabel}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} style={selectStyle}>
        <option value="all">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
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
        borderColor: hovered ? 'rgba(125, 211, 252, 0.44)' : 'rgba(125, 211, 252, 0.18)',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: 'var(--shadow-soft)',
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

const heroHintPill: CSSProperties = {
  border: '1px solid rgba(125, 211, 252, 0.18)',
  background: 'rgba(15, 23, 42, 0.68)',
  color: 'var(--foreground-strong)',
  borderRadius: '999px',
  padding: '11px 16px',
  fontSize: '13px',
  fontWeight: 700,
  boxShadow: 'var(--shadow-soft)',
  maxWidth: '100%',
  minWidth: 0,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const contentWrap: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  width: 'min(1280px, calc(100% - clamp(24px, 5vw, 40px)))',
  margin: '12px auto 0',
  padding: 0,
  minWidth: 0,
  boxSizing: 'border-box',
  overflowX: 'clip',
}

const summaryGrid: CSSProperties = {
  display: 'grid',
  gap: '16px',
  marginBottom: '16px',
  minWidth: 0,
}

const metricCard: CSSProperties = {
  borderRadius: '20px',
  padding: '16px',
  border: '1px solid rgba(125, 211, 252, 0.16)',
  background: 'rgba(15, 23, 42, 0.62)',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const metricCardAccent: CSSProperties = {
  border: '1px solid rgba(155,225,29,0.34)',
  boxShadow: 'var(--shadow-soft)',
}

const metricLabel: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  lineHeight: 1.5,
  fontWeight: 750,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  overflowWrap: 'anywhere',
}

const metricValue: CSSProperties = {
  marginTop: '8px',
  color: 'var(--foreground-strong)',
  fontSize: '32px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const panelCard: CSSProperties = {
  position: 'relative',
  borderRadius: '26px',
  padding: '20px',
  overflow: 'hidden',
  border: '1px solid rgba(125, 211, 252, 0.22)',
  background: 'var(--portal-surface-bg)',
  boxShadow: '0 24px 70px rgba(2, 8, 23, 0.48)',
  minWidth: 0,
  marginBottom: '16px',
  overflowWrap: 'anywhere',
}

const panelHead: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '12px',
  marginBottom: '16px',
  flexWrap: 'wrap',
  minWidth: 0,
}

const sectionKicker: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontWeight: 800,
  fontSize: '13px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '8px',
  overflowWrap: 'anywhere',
}

const panelTitle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  fontSize: 'clamp(1.55rem, 3vw, 2.25rem)',
  lineHeight: 1.08,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const panelIntro: CSSProperties = {
  margin: '8px 0 0',
  maxWidth: '720px',
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.6,
  overflowWrap: 'anywhere',
}

const filterGrid: CSSProperties = {
  display: 'grid',
  gap: '14px',
  marginBottom: '16px',
  minWidth: 0,
}

const inputLabel: CSSProperties = {
  display: 'block',
  marginBottom: '8px',
  color: 'var(--foreground-strong)',
  fontSize: '13px',
  fontWeight: 800,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const searchWrap: CSSProperties = {
  position: 'relative',
  minWidth: 0,
}

const searchIconWrap: CSSProperties = {
  position: 'absolute',
  left: '14px',
  top: '50%',
  transform: 'translateY(-50%)',
  color: 'var(--shell-copy-muted)',
  pointerEvents: 'none',
}

const searchInput: CSSProperties = {
  width: '100%',
  borderRadius: '18px',
  border: '1px solid rgba(125, 211, 252, 0.18)',
  background: 'rgba(15, 23, 42, 0.66)',
  color: 'var(--foreground-strong)',
  padding: '15px 16px 15px 46px',
  fontSize: '15px',
  outline: 'none',
  boxShadow: 'var(--home-control-shadow)',
  colorScheme: 'dark',
}

const clearFilterButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '38px',
  padding: '0 14px',
  borderRadius: '999px',
  border: '1px solid rgba(125, 211, 252, 0.18)',
  background: 'rgba(15, 23, 42, 0.66)',
  color: 'var(--foreground-strong)',
  fontWeight: 800,
  cursor: 'pointer',
  textDecoration: 'none',
  maxWidth: '100%',
  minWidth: 0,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
}

const filterActionRow: CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  minWidth: 0,
}

const selectStyle: CSSProperties = {
  width: '100%',
  height: '52px',
  borderRadius: '18px',
  border: '1px solid rgba(125, 211, 252, 0.18)',
  background: 'rgba(15, 23, 42, 0.66)',
  color: 'var(--foreground-strong)',
  padding: '0 14px',
  fontSize: '14px',
  fontWeight: 700,
  outline: 'none',
  colorScheme: 'dark',
}

const stateBox: CSSProperties = {
  marginTop: '8px',
  borderRadius: '18px',
  padding: '18px',
  background: 'rgba(15, 23, 42, 0.68)',
  border: '1px solid rgba(125, 211, 252, 0.18)',
  color: 'var(--foreground-strong)',
  fontSize: '15px',
  lineHeight: 1.7,
  fontWeight: 600,
  textAlign: 'center',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
  overflowWrap: 'anywhere',
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
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const noticeBox: CSSProperties = {
  marginTop: '8px',
  marginBottom: '14px',
  borderRadius: '16px',
  padding: '12px 14px',
  background: 'rgba(56,189,248,0.12)',
  border: '1px solid rgba(125, 211, 252, 0.18)',
  color: 'var(--foreground-strong)',
  fontWeight: 600,
  fontSize: '14px',
  lineHeight: 1.6,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const stateHelperTextStyle: CSSProperties = {
  marginTop: '10px',
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.65,
  fontWeight: 500,
  overflowWrap: 'anywhere',
}

const diagnosticWrap: CSSProperties = {
  marginTop: '16px',
  paddingTop: '16px',
  borderTop: '1px solid rgba(125, 211, 252, 0.14)',
  display: 'grid',
  gap: '10px',
  textAlign: 'left',
  minWidth: 0,
}

const diagnosticTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '14px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  overflowWrap: 'anywhere',
}

const diagnosticText: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.65,
  fontWeight: 500,
  overflowWrap: 'anywhere',
}

const diagnosticChipRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  minWidth: 0,
}

const diagnosticChip: CSSProperties = {
  borderRadius: '999px',
  padding: '8px 12px',
  border: '1px solid rgba(125, 211, 252, 0.16)',
  background: 'rgba(15, 23, 42, 0.62)',
  color: 'var(--foreground-strong)',
  fontSize: '12px',
  fontWeight: 700,
  maxWidth: '100%',
  minWidth: 0,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const diagnosticSampleList: CSSProperties = {
  display: 'grid',
  gap: '10px',
  minWidth: 0,
}

const diagnosticSampleCard: CSSProperties = {
  borderRadius: '16px',
  padding: '12px 14px',
  border: '1px solid rgba(125, 211, 252, 0.16)',
  background: 'rgba(15, 23, 42, 0.62)',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const diagnosticSampleTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '14px',
  fontWeight: 700,
  lineHeight: 1.5,
  overflowWrap: 'anywhere',
}

const diagnosticSampleMeta: CSSProperties = {
  marginTop: '4px',
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  lineHeight: 1.55,
  overflowWrap: 'anywhere',
}

const summaryBadgeRow: CSSProperties = {
  marginTop: '4px',
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
  marginBottom: '16px',
  minWidth: 0,
}

const emptyActionRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  flexWrap: 'wrap',
  gap: '10px',
  marginTop: '14px',
  minWidth: 0,
}

const cardGrid: CSSProperties = {
  display: 'grid',
  gap: '16px',
  minWidth: 0,
}

const leagueCard: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  borderRadius: '28px',
  padding: '20px',
  border: '1px solid rgba(125, 211, 252, 0.18)',
  background: 'rgba(8, 13, 28, 0.66)',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const cardGlow: CSSProperties = {
  position: 'absolute',
  top: '-70px',
  right: '-50px',
  width: 'min(100%, 180px)',
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
  flexWrap: 'wrap',
  minWidth: 0,
}

const leagueHeading: CSSProperties = {
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const leagueMetaRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  marginBottom: '10px',
  minWidth: 0,
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
  maxWidth: '100%',
  minWidth: 0,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const leagueMetaBluePill: CSSProperties = {
  ...leagueMetaPillBase,
  background: 'rgba(56,189,248,0.14)',
  color: 'var(--foreground-strong)',
}

const leagueMetaGreenPill: CSSProperties = {
  ...leagueMetaPillBase,
  background: 'rgba(155,225,29,0.14)',
  color: 'var(--foreground-strong)',
}

const leagueMetaSlatePill: CSSProperties = {
  ...leagueMetaPillBase,
  background: 'rgba(15, 23, 42, 0.68)',
  color: 'var(--shell-copy-muted)',
}

const leagueTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '28px',
  lineHeight: 1.1,
  fontWeight: 900,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const leagueFlight: CSSProperties = {
  marginTop: '8px',
  color: 'var(--brand-blue-2)',
  fontSize: '15px',
  lineHeight: 1.5,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const leagueActionStack: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  alignItems: 'flex-end',
  maxWidth: '100%',
  minWidth: 0,
}

const followWrap: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  maxWidth: '100%',
  minWidth: 0,
}

const primaryButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '44px',
  padding: '0 16px',
  borderRadius: '999px',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.32), rgba(34,211,238,0.16))',
  color: 'var(--foreground-strong)',
  border: '1px solid rgba(155,225,29,0.38)',
  fontWeight: 900,
  fontSize: '13px',
  letterSpacing: '0.01em',
  textDecoration: 'none',
  whiteSpace: 'normal',
  boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--foreground-strong) 10%, transparent)',
  maxWidth: '100%',
  minWidth: 0,
  overflowWrap: 'anywhere',
  textAlign: 'center',
}

const leagueDetailGrid: CSSProperties = {
  display: 'grid',
  gap: '12px',
  minWidth: 0,
}

const detailCard: CSSProperties = {
  borderRadius: '18px',
  padding: '14px',
  border: '1px solid rgba(125, 211, 252, 0.16)',
  background: 'rgba(15, 23, 42, 0.62)',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const detailLabel: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '12px',
  fontWeight: 700,
  marginBottom: '6px',
  overflowWrap: 'anywhere',
}

const detailValue: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '16px',
  lineHeight: 1.45,
  fontWeight: 800,
  wordBreak: 'break-word',
}

const leagueBottom: CSSProperties = {
  marginTop: '16px',
  paddingTop: '16px',
  borderTop: '1px solid rgba(125, 211, 252, 0.14)',
}

const leagueBottomMeta: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.6,
  fontWeight: 600,
  overflowWrap: 'anywhere',
}

const iconSvgStyle: CSSProperties = {
  width: '22px',
  height: '22px',
}
