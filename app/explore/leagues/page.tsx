'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import JsonLd from '@/app/components/json-ld'
import SiteShell from '@/app/components/site-shell'
import TiqDirectoryFallbackCard from '@/app/components/tiq-directory-fallback-card'
import TiqTrustStrip from '@/app/components/tiq-trust-strip'
import {
  buildExploreLeagueHref,
  getCompetitionLayerDescription,
  getCompetitionLayerLabel,
  getLeagueFormatLabel,
  type CompetitionLayer,
} from '@/lib/competition-layers'
import {
  getTiqIndividualCompetitionFormatLabel,
  getTiqIndividualCompetitionFormatPreview,
} from '@/lib/tiq-individual-format'
import type { LeagueCard, LeagueSummaryPayload } from '@/lib/league-summary'
import {
  buildLeagueCardsFromRegistry,
} from '@/lib/tiq-league-registry'
import { listTiqIndividualLeagueResults } from '@/lib/tiq-individual-results-service'
import { formatDate, cleanText as safeText } from '@/lib/captain-formatters'
import { loadRecentTiqAwards, type TiqAwardRecord } from '@/lib/tiq-awards-registry'
import {
  buildTiqIndividualLeagueSummaries,
  type TiqIndividualLeagueSummary,
} from '@/lib/tiq-individual-results-summary'
import { listTiqLeagues } from '@/lib/tiq-league-service'
import { buildPublicSectionBreadcrumbJsonLd } from '@/lib/structured-data'
import { DATA_ASSIST_STORY } from '@/lib/product-story'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

const LEAGUE_SUMMARY_TIMEOUT_MS = 12000
const LEAGUE_SECTION_DEFAULT_LIMIT = 1

type LayerFilter = 'all' | CompetitionLayer

function buildLeagueSubtitle(league: LeagueCard) {
  return [league.flight, league.ustaSection, league.districtArea]
    .map((value) => safeText(value))
    .filter(Boolean)
    .join(' | ')
}

export default function ExploreLeaguesPage() {
  return (
    <SiteShell active="/explore">
      <JsonLd id="explore-leagues-breadcrumb-jsonld" data={buildPublicSectionBreadcrumbJsonLd('Explore Leagues', '/explore/leagues')} />
      <ExploreLeaguesContent />
    </SiteShell>
  )
}

function ExploreLeaguesContent() {
  const { isMobile } = useViewportBreakpoints()
  const [leagues, setLeagues] = useState<LeagueCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [layerFilter, setLayerFilter] = useState<LayerFilter>('all')
  const [yearFilter, setYearFilter] = useState('all')
  const [seasonFilter, setSeasonFilter] = useState('all')
  const [genderFilter, setGenderFilter] = useState('all')
  const [ratingFilter, setRatingFilter] = useState('all')
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
  const [awardsByLeagueId, setAwardsByLeagueId] = useState<Record<string, TiqAwardRecord[]>>({})
  useEffect(() => {
    void loadLeagueSummary()
    void loadRegistryLeagues()
    void loadIndividualLeagueResults()
    void loadLeagueAwards()
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const nextSearch = params.get('q')?.trim() || ''
    const nextLayer = params.get('layer')

    setSearch(nextSearch)
    setLayerFilter(nextLayer === 'usta' || nextLayer === 'tiq' ? nextLayer : 'all')
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

  async function loadLeagueAwards() {
    const result = await loadRecentTiqAwards()
    const nextAwardsByLeagueId: Record<string, TiqAwardRecord[]> = {}

    for (const award of result.data) {
      if (award.sourceType !== 'league' || !award.sourceId) continue
      const existing = nextAwardsByLeagueId[award.sourceId] ?? []
      existing.push(award)
      nextAwardsByLeagueId[award.sourceId] = existing
    }

    setAwardsByLeagueId(nextAwardsByLeagueId)
    if (result.error) {
      setRegistryWarning((current) => current || result.error?.message || '')
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

      return matchesLayer && matchesYear && matchesSeason && matchesGender && matchesRating && matchesSearch
    })
  }, [decoratedLeagues, layerFilter, search, yearFilter, seasonFilter, genderFilter, ratingFilter])

  const years = useMemo(() => uniqueSorted(decoratedLeagues.map((league) => league.year)), [decoratedLeagues])
  const seasons = useMemo(() => uniqueSorted(decoratedLeagues.map((league) => league.season)), [decoratedLeagues])
  const genders = useMemo(() => uniqueSorted(decoratedLeagues.map((league) => league.gender)), [decoratedLeagues])
  const ratings = useMemo(() => uniqueSorted(decoratedLeagues.map((league) => league.rating)), [decoratedLeagues])
  const activeSecondaryFilterCount = [yearFilter, seasonFilter, genderFilter, ratingFilter].filter((value) => value !== 'all').length
  const dynamicHeroStyle = isMobile ? compactHeroStyle : heroStyle
  const dynamicPanelHeaderStyle = isMobile ? compactPanelHeaderStyle : panelHeaderStyle
  const dynamicHeroPillRowStyle = isMobile ? compactHeroPillRowStyle : heroPillRowStyle
  const dynamicHeroPillBlueStyle = isMobile ? compactHeroPillBlueStyle : heroPillBlueStyle
  const dynamicHeroPillGreenStyle = isMobile ? compactHeroPillGreenStyle : heroPillGreenStyle
  const dynamicFilterBarStyle = isMobile ? compactFilterBarStyle : filterBarStyle
  const dynamicMoreFiltersDetailsStyle = isMobile
    ? compactMoreFiltersDetailsStyle
    : moreFiltersDetailsStyle
  const dynamicInputStyle = isMobile
    ? { ...inputStyle, minHeight: '40px', padding: '0 12px', borderRadius: '12px' }
    : inputStyle
  const dynamicToggleStyle = isMobile
    ? { ...toggleStyle, minHeight: '38px', padding: '0 12px', borderRadius: '12px', fontSize: '12px' }
    : toggleStyle
  const dynamicToggleActiveStyle = isMobile
    ? { ...toggleActiveStyle, minHeight: '38px', padding: '0 12px', borderRadius: '12px', fontSize: '12px' }
    : toggleActiveStyle

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
    <section style={wrapStyle}>
        <div style={dynamicHeroStyle} aria-label="League discovery controls">
          <div aria-hidden="true" style={watermarkStyle} />
          <div style={dynamicPanelHeaderStyle}>
            <div>
              <div style={eyebrowStyle}>League discovery</div>
              <h1 style={titleStyle}>Find a league.</h1>
              {!isMobile ? (
                <p style={descriptionStyle}>
                  Search by league, flight, section, or district, then open the season view.
                </p>
              ) : null}
            </div>

            <div style={dynamicHeroPillRowStyle}>
              <span style={dynamicHeroPillBlueStyle}>{loading ? 'USTA refreshing' : `${layerCounts.usta} USTA`}</span>
              <span style={dynamicHeroPillGreenStyle}>{loading ? 'TIQ refreshing' : `${layerCounts.tiq} TIQ`}</span>
              {!isMobile ? <span style={dynamicHeroPillBlueStyle}>{loading ? 'Flights pending' : `${summary.totalFlights} flights`}</span> : null}
              {!isMobile ? <span style={dynamicHeroPillBlueStyle}>Latest: {loading ? 'Refreshing' : formatDate(summary.latestMatch)}</span> : null}
            </div>
          </div>

          <div style={dynamicFilterBarStyle}>
            <div style={searchGroupStyle}>
              <label htmlFor="explore-league-search" style={labelStyle}>
                Search leagues
              </label>
              <input
                className="tiq-focus-ring"
                id="explore-league-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="League, flight, section, or district"
                style={dynamicInputStyle}
              />
            </div>

            <div style={layerToggleGroupStyle}>
              <button
                type="button"
                onClick={() => setLayerFilter('all')}
                style={layerFilter === 'all' ? dynamicToggleActiveStyle : dynamicToggleStyle}
              >
                All Layers
              </button>
              <button
                type="button"
                onClick={() => setLayerFilter('usta')}
                style={layerFilter === 'usta' ? dynamicToggleActiveStyle : dynamicToggleStyle}
              >
                USTA
              </button>
              <button
                type="button"
                onClick={() => setLayerFilter('tiq')}
                style={layerFilter === 'tiq' ? dynamicToggleActiveStyle : dynamicToggleStyle}
              >
                TIQ
              </button>
            </div>
          </div>

          <details style={dynamicMoreFiltersDetailsStyle} open={!isMobile}>
            <summary style={moreFiltersSummaryStyle}>
              <span>More filters</span>
              <span style={moreFiltersSummaryMetaStyle}>
                {activeSecondaryFilterCount ? `${activeSecondaryFilterCount} active` : 'Year, season, rating'}
              </span>
            </summary>
            <div style={moreFiltersGridStyle}>
              <FilterSelect id="explore-league-year" label="Year" value={yearFilter} onChange={setYearFilter} options={years} />
              <FilterSelect id="explore-league-season" label="Season" value={seasonFilter} onChange={setSeasonFilter} options={seasons} />
              <FilterSelect id="explore-league-gender" label="Male/Female" value={genderFilter} onChange={setGenderFilter} options={genders} />
              <FilterSelect id="explore-league-rating" label="Rating / Flight" value={ratingFilter} onChange={setRatingFilter} options={ratings} />
            </div>
          </details>

          {notice ? <div style={noticeStyle}>{notice}</div> : null}
          {registryWarning ? <div style={noticeStyle}>{registryWarning}</div> : null}
        </div>

        {loading ? (
          <div style={isMobile ? compactStateStyle : stateStyle}>
            <strong>Choose a league path.</strong>
            <div style={{ marginTop: 8, color: 'var(--shell-copy-muted)', lineHeight: 1.6 }}>
              Find existing league context or start a TIQ League Office season. The live league layer is refreshing behind this starter view.
            </div>
            <TiqDirectoryFallbackCard
              eyebrow="Featured league path"
              title="Search a flight, section, or district."
              body={isMobile ? 'League cards appear after reviewed schedules, scorecards, or standings create enough season context.' : 'League cards become public after reviewed schedules, scorecards, or standings include enough season context to trust the view.'}
              chips={['USTA layer', 'TIQ layer', 'Data Assist']}
              actions={[
                { href: '/leagues', label: 'Find Leagues' },
                { href: DATA_ASSIST_STORY.href, label: DATA_ASSIST_STORY.cta },
              ]}
            />
          </div>
        ) : null}
        {error ? <div style={errorStyle}>{error}</div> : null}

        {!loading && !error ? (
          <>
            {layerFilter !== 'tiq' ? (
              <LeagueSection
                title="USTA Leagues"
                eyebrow={getCompetitionLayerLabel('usta')}
                description={getCompetitionLayerDescription('usta')}
                leagues={ustaLeagues}
                defaultOpen
                emptyKind="usta"
                emptyTitle="No imported TennisLink leagues matched this view."
                emptyBody={`USTA league views come from reviewed TennisLink exports. Try widening the search, switch back to all layers, or upload through Data Assist if this season should already be visible. ${DATA_ASSIST_STORY.shortCue}`}
              />
            ) : null}

            {layerFilter !== 'usta' ? (
              <>
                <LeagueSection
                  title="TIQ Team Leagues"
                  eyebrow="TIQ Team Competition"
                  description="Create and run team leagues with schedules, standings, results, lineups, and captain handoffs."
                  leagues={tiqTeamLeagues}
                  awardsByLeagueId={awardsByLeagueId}
                  defaultOpen={layerFilter === 'tiq'}
                  emptyKind="tiq-team"
                  emptyTitle="Create the first team league."
                  emptyBody="Team seasons become schedule, standings, result book, and Captain handoff spaces once a coordinator creates the league."
                />

                <LeagueSection
                  title="TIQ Individual Leagues"
                  eyebrow="TIQ Individual Competition"
                  description="Run ladders, round robins, challenge formats, standings, results, and awards for individual players."
                  leagues={tiqIndividualLeagues}
                  individualSummaries={individualLeagueSummaries}
                  awardsByLeagueId={awardsByLeagueId}
                  defaultOpen={layerFilter === 'tiq'}
                  emptyKind="tiq-individual"
                  emptyTitle="Start a player-vs-player season."
                  emptyBody="Individual leagues power ladders, round robins, challenge formats, standings, result books, and award paths."
                />
              </>
            ) : null}
          </>
        ) : null}
    </section>
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
    <div style={searchGroupStyle}>
      <label htmlFor={id} style={labelStyle}>{label}</label>
      <select className="tiq-focus-ring" id={id} value={value} onChange={(event) => onChange(event.target.value)} style={inputStyle}>
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

function LeagueSection({
  title,
  eyebrow,
  description,
  leagues,
  individualSummaries,
  awardsByLeagueId,
  defaultOpen,
  emptyKind,
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
  awardsByLeagueId?: Record<string, TiqAwardRecord[]>
  defaultOpen?: boolean
  emptyKind: 'usta' | 'tiq-team' | 'tiq-individual'
  emptyTitle: string
  emptyBody: string
}) {
  const { isMobile } = useViewportBreakpoints()
  const [showAllLeagues, setShowAllLeagues] = useState(false)
  const visibleLeagues = showAllLeagues ? leagues : leagues.slice(0, LEAGUE_SECTION_DEFAULT_LIMIT)
  const hasMoreLeagues = leagues.length > visibleLeagues.length
  const dynamicSectionStyle = isMobile
    ? { ...sectionStyle, margin: '8px auto 0', padding: '10px', borderRadius: '16px' }
    : sectionStyle
  const dynamicSectionSummaryStyle = isMobile
    ? { ...sectionSummaryStyle, gap: '8px' }
    : sectionSummaryStyle
  const dynamicSectionTitleStyle = isMobile
    ? { ...sectionTitleStyle, margin: '3px 0 0', fontSize: '1.05rem' }
    : sectionTitleStyle

  return (
    <details style={dynamicSectionStyle} open={defaultOpen && !isMobile}>
      <summary style={dynamicSectionSummaryStyle}>
        <div>
          <div style={sectionEyebrowStyle}>{eyebrow}</div>
          <h2 style={dynamicSectionTitleStyle}>{title}</h2>
        </div>
        <span style={sectionSummaryMetaStyle}>
          {leagues.length ? `${leagues.length} leagues` : 'No matches'}
        </span>
      </summary>
      {!isMobile ? <p style={sectionDescriptionStyle}>{description}</p> : null}

      {leagues.length === 0 ? (
        <div style={emptyCardStyle}>
          <div style={emptyTitleStyle}>{emptyTitle}</div>
          <div style={emptyBodyStyle}>{emptyBody}</div>
          <div style={emptyActionRowStyle}>
            {emptyKind === 'usta' ? (
              <>
                <GhostLink href={DATA_ASSIST_STORY.href}>{DATA_ASSIST_STORY.cta}</GhostLink>
                <GhostLink href="/explore/search?scope=leagues">Search leagues</GhostLink>
              </>
            ) : emptyKind === 'tiq-team' ? (
              <>
                <GhostLink href="/league-coordinator">Create team league</GhostLink>
                <GhostLink href="/captain">Open Captain</GhostLink>
              </>
            ) : (
              <>
                <GhostLink href="/league-coordinator">Create individual league</GhostLink>
                <GhostLink href="/leagues">Explore League Office</GhostLink>
              </>
            )}
          </div>
        </div>
      ) : (
        <>
          <div style={gridStyle}>
            {visibleLeagues.map((league) => {
            const leagueHref = buildExploreLeagueHref(league)
            const leagueAwards = awardsByLeagueId?.[league.leagueId || ''] || []

            return (
              <article key={league.key} style={cardStyle}>
                <div style={cardMetaRowStyle}>
                  <span style={league.competitionLayer === 'usta' ? metaBlueStyle : metaGreenStyle}>
                    {getCompetitionLayerLabel(league.competitionLayer)}
                  </span>
                  <span style={metaSlateStyle}>{getLeagueFormatLabel(league.leagueFormat)}</span>
                </div>
                <Link href={leagueHref} style={cardTitleLinkStyle}>
                  {league.leagueName}
                </Link>
                <div style={cardSubtitleStyle}>{league.subtitle || 'League context not yet labeled'}</div>
                <LeagueAwardBadges awards={leagueAwards} />
                <div style={miniStatsStyle}>
                  {league.competitionLayer === 'tiq' && league.leagueFormat === 'individual' ? (
                    <span>{getTiqIndividualCompetitionFormatLabel((league as LeagueCard & { individualCompetitionFormat?: string }).individualCompetitionFormat)}</span>
                  ) : null}
                  <span>{league.matchCount} matches</span>
                  <span>{league.teamCount} teams</span>
                  <span>{formatDate(league.latestMatchDate)}</span>
                </div>
                <LeagueCardDetails
                  eyebrow="Data check"
                  title={`${league.matchCount} matches - ${league.latestMatchDate ? formatDate(league.latestMatchDate) : 'review pending'}`}
                  cue="Show checks"
                >
                  <TiqTrustStrip
                    label={`${league.leagueName} data trust signals`}
                    signals={[
                      { label: 'Source', value: getCompetitionLayerLabel(league.competitionLayer), tone: league.competitionLayer === 'tiq' ? 'good' : 'info' },
                      { label: 'Freshness', value: league.latestMatchDate ? formatDate(league.latestMatchDate) : 'Review pending', tone: league.latestMatchDate ? 'good' : 'warn' },
                      { label: 'Confidence', value: league.matchCount >= 10 ? 'High' : league.matchCount >= 3 ? 'Medium' : 'Limited', tone: league.matchCount >= 10 ? 'good' : league.matchCount >= 3 ? 'warn' : 'info' },
                      { label: 'Status', value: 'Reviewable', tone: 'good' },
                    ]}
                    reviewContext={`League ${league.leagueName}`}
                  />
                </LeagueCardDetails>
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
                      if (!summary) return 'Results start with the first logged match.'
                      return `Leader: ${summary.leaderName} (${summary.leaderRecord})${summary.leaderRecentForm ? ` - Form ${summary.leaderRecentForm}` : ''} - ${summary.resultCount} results`
                    })()}
                  </div>
                ) : null}
                <Link href={leagueHref} style={cardCtaStyle}>Open league -&gt;</Link>
              </article>
            )
          })}
          </div>
          {hasMoreLeagues || showAllLeagues ? (
            <div style={leagueLaneLimitStyle}>
              <span style={leagueLaneLimitTextStyle}>
                {showAllLeagues
                  ? `Showing all ${leagues.length} leagues.`
                  : 'Showing the first league. Search, filter, or show more when you need another league.'}
              </span>
              <button
                type="button"
                style={leagueLaneLimitButtonStyle}
                onClick={() => setShowAllLeagues((current) => !current)}
              >
                {showAllLeagues ? 'Show fewer leagues' : 'Show more leagues'}
              </button>
            </div>
          ) : null}
        </>
      )}
    </details>
  )
}

function LeagueCardDetails({
  eyebrow,
  title,
  cue,
  children,
}: {
  eyebrow: string
  title: string
  cue: string
  children: ReactNode
}) {
  return (
    <details style={leagueCardDetailsStyle}>
      <summary style={leagueCardSummaryStyle}>
        <span style={leagueCardSummaryCopyStyle}>
          <span style={leagueCardSummaryEyebrowStyle}>{eyebrow}</span>
          <strong style={leagueCardSummaryTitleStyle}>{title}</strong>
        </span>
        <span style={leagueCardSummaryCueStyle}>{cue}</span>
      </summary>
      <div style={leagueCardDetailsBodyStyle}>{children}</div>
    </details>
  )
}

function LeagueAwardBadges({ awards }: { awards: TiqAwardRecord[] }) {
  if (!awards.length) return null

  return (
    <div style={leagueAwardRowStyle} aria-label="League award winners">
      {awards.slice(0, 3).map((award) => (
        <Link
          key={award.id}
          href={`/awards/${encodeURIComponent(award.id)}`}
          style={leagueAwardPillStyle}
          title={`${award.badgeLabel}: ${award.recipientName}`}
        >
          <span>{award.badgeCode}</span>
          <small>{award.recipientName}</small>
        </Link>
      ))}
    </div>
  )
}

const wrapStyle: CSSProperties = {
  padding: '16px 0 64px',
  minWidth: 0,
  overflowX: 'clip',
  boxSizing: 'border-box',
}

const heroStyle: CSSProperties = {
  position: 'relative',
  width: 'min(1280px, calc(100% - clamp(24px, 5vw, 40px)))',
  margin: '0 auto',
  padding: '20px',
  borderRadius: '26px',
  overflow: 'hidden',
  border: '1px solid rgba(116,190,255,0.15)',
  background: 'linear-gradient(135deg, rgba(8,13,30,0.96), rgba(4,10,24,0.9))',
  boxShadow: '0 30px 86px rgba(2, 8, 23, 0.46), inset 0 1px 0 rgba(255,255,255,0.05)',
  minWidth: 0,
}

const compactHeroStyle: CSSProperties = {
  ...heroStyle,
  padding: '9px',
  borderRadius: '16px',
}

const eyebrowStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: 'uppercase',
  color: 'rgba(155,225,29,0.88)',
  overflowWrap: 'anywhere',
}

const titleStyle: CSSProperties = {
  margin: '8px 0 0',
  maxWidth: '760px',
  fontSize: 'clamp(1.55rem, 3vw, 2.25rem)',
  lineHeight: 1.08,
  letterSpacing: 0,
  color: 'var(--foreground-strong)',
  overflowWrap: 'anywhere',
}

const descriptionStyle: CSSProperties = {
  margin: '8px 0 0',
  maxWidth: '700px',
  fontSize: '14px',
  lineHeight: 1.6,
  color: 'rgba(214,228,246,0.78)',
  overflowWrap: 'anywhere',
}

const panelHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '16px',
  flexWrap: 'wrap',
  minWidth: 0,
}

const compactPanelHeaderStyle: CSSProperties = {
  ...panelHeaderStyle,
  display: 'grid',
  gap: '7px',
}

const heroPillRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  marginTop: '6px',
  minWidth: 0,
}

const compactHeroPillRowStyle: CSSProperties = {
  ...heroPillRowStyle,
  gap: '6px',
  marginTop: '4px',
}

const heroPillBlueStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  maxWidth: '100%',
  minWidth: 0,
  minHeight: '32px',
  padding: '0 12px',
  borderRadius: '999px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(7,17,33,0.72)',
  color: 'var(--foreground-strong)',
  fontSize: '12px',
  fontWeight: 800,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const compactHeroPillBlueStyle: CSSProperties = {
  ...heroPillBlueStyle,
  minHeight: '26px',
  padding: '0 9px',
  fontSize: '11px',
}

const heroPillGreenStyle: CSSProperties = {
  ...heroPillBlueStyle,
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'rgba(155,225,29,0.10)',
}

const compactHeroPillGreenStyle: CSSProperties = {
  ...compactHeroPillBlueStyle,
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'rgba(155,225,29,0.10)',
}

const filterBarStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  gap: '12px',
  marginTop: '18px',
  minWidth: 0,
}

const compactFilterBarStyle: CSSProperties = {
  ...filterBarStyle,
  gap: '7px',
  marginTop: '9px',
}

const moreFiltersDetailsStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  marginTop: '12px',
  minWidth: 0,
  borderRadius: '18px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(7,17,33,0.42)',
  overflow: 'hidden',
  overflowWrap: 'anywhere',
}

const compactMoreFiltersDetailsStyle: CSSProperties = {
  ...moreFiltersDetailsStyle,
  marginTop: '7px',
  borderRadius: '12px',
}

const moreFiltersSummaryStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: '10px',
  minWidth: 0,
  padding: '12px 14px',
  color: 'var(--foreground-strong)',
  fontSize: '13px',
  fontWeight: 900,
  cursor: 'pointer',
  listStyle: 'none',
  overflowWrap: 'anywhere',
}

const moreFiltersSummaryMetaStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  maxWidth: '100%',
  minHeight: '28px',
  padding: '0 10px',
  borderRadius: '999px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(7,17,33,0.72)',
  color: 'var(--shell-copy-muted)',
  fontSize: '12px',
  fontWeight: 800,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const moreFiltersGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  gap: '12px',
  minWidth: 0,
  padding: '0 14px 14px',
}

const searchGroupStyle: CSSProperties = {
  display: 'grid',
  gap: '8px',
  minWidth: 0,
}

const labelStyle: CSSProperties = {
  color: '#f4f9ff',
  fontSize: '13px',
  fontWeight: 700,
  overflowWrap: 'anywhere',
}

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: '48px',
  padding: '0 16px',
  borderRadius: '16px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(7,17,33,0.72)',
  color: 'var(--foreground-strong)',
  outline: '2px solid transparent',
  outlineOffset: 2,
  colorScheme: 'dark',
}

const layerToggleGroupStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  alignItems: 'end',
  minWidth: 0,
}

const toggleStyle: CSSProperties = {
  minHeight: '48px',
  padding: '0 16px',
  borderRadius: '16px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(7,17,33,0.72)',
  color: 'var(--foreground)',
  fontWeight: 700,
  cursor: 'pointer',
  maxWidth: '100%',
  minWidth: 0,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
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
  background: 'rgba(7,17,33,0.72)',
  color: 'var(--foreground)',
  fontSize: '14px',
  lineHeight: 1.7,
  border: '1px solid rgba(116,190,255,0.13)',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const sectionStyle: CSSProperties = {
  width: 'min(1280px, calc(100% - clamp(24px, 5vw, 40px)))',
  margin: '12px auto 0',
  padding: '16px',
  borderRadius: '20px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(8,16,34,0.74)',
  boxShadow: '0 18px 48px rgba(2,10,24,0.24), inset 0 1px 0 rgba(255,255,255,0.04)',
  minWidth: 0,
}

const sectionSummaryStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, auto)',
  gap: '12px',
  alignItems: 'center',
  minWidth: 0,
  cursor: 'pointer',
  listStyle: 'none',
  overflowWrap: 'anywhere',
}

const sectionEyebrowStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: 'uppercase',
  color: 'rgba(116,190,255,0.82)',
  overflowWrap: 'anywhere',
}

const sectionTitleStyle: CSSProperties = {
  margin: '6px 0 0',
  fontSize: 'clamp(1.45rem, 3vw, 1.9rem)',
  lineHeight: 1.05,
  letterSpacing: 0,
  color: '#f4f9ff',
  overflowWrap: 'anywhere',
}

const sectionDescriptionStyle: CSSProperties = {
  margin: '10px 0 0',
  color: 'rgba(214,228,246,0.72)',
  fontSize: '14px',
  lineHeight: 1.55,
  overflowWrap: 'anywhere',
}

const sectionSummaryMetaStyle: CSSProperties = {
  justifySelf: 'end',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '34px',
  padding: '0 12px',
  borderRadius: '999px',
  border: '1px solid rgba(155,225,29,0.22)',
  background: 'rgba(155,225,29,0.08)',
  color: 'var(--foreground-strong)',
  fontSize: '12px',
  fontWeight: 900,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
  gap: '12px',
  marginTop: '14px',
  minWidth: 0,
}

const cardStyle: CSSProperties = {
  display: 'grid',
  gap: '10px',
  minHeight: 0,
  padding: '14px',
  borderRadius: '20px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(8,16,34,0.66)',
  textDecoration: 'none',
  boxShadow: '0 18px 48px rgba(2,10,24,0.24), inset 0 1px 0 rgba(255,255,255,0.04)',
  minWidth: 0,
}

const cardMetaRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  minWidth: 0,
}

const metaBlueStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  maxWidth: '100%',
  minWidth: 0,
  minHeight: '28px',
  padding: '0 10px',
  borderRadius: '999px',
  background: 'rgba(74,163,255,0.14)',
  color: '#dfeeff',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: 'uppercase',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
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
  overflowWrap: 'anywhere',
}

const cardTitleLinkStyle: CSSProperties = {
  ...cardTitleStyle,
  textDecoration: 'none',
}

const cardSubtitleStyle: CSSProperties = {
  color: 'rgba(214,228,246,0.72)',
  fontSize: '14px',
  lineHeight: 1.75,
  overflowWrap: 'anywhere',
}

const miniStatsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px 14px',
  color: 'rgba(190,205,226,0.68)',
  fontSize: '13px',
  fontWeight: 700,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const formatPreviewStyle: CSSProperties = {
  color: 'rgba(214,228,246,0.76)',
  fontSize: '13px',
  lineHeight: 1.65,
  overflowWrap: 'anywhere',
}

const cardCtaStyle: CSSProperties = {
  alignSelf: 'end',
  fontSize: '13px',
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: 'uppercase',
  color: 'rgba(155,225,29,0.88)',
  textDecoration: 'none',
  overflowWrap: 'anywhere',
}

const leagueAwardRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
  minWidth: 0,
}

const leagueAwardPillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  maxWidth: '100%',
  minHeight: '26px',
  padding: '0 9px',
  borderRadius: '999px',
  border: '1px solid rgba(245, 158, 11, 0.32)',
  background: 'rgba(245, 158, 11, 0.12)',
  color: '#fff7ed',
  fontSize: '10px',
  fontWeight: 900,
  textDecoration: 'none',
  overflowWrap: 'anywhere',
}

const individualSummaryStyle: CSSProperties = {
  padding: '10px 12px',
  borderRadius: '14px',
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'rgba(255,255,255,0.04)',
  color: 'rgba(228,238,252,0.84)',
  fontSize: '12px',
  lineHeight: 1.6,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const leagueCardDetailsStyle: CSSProperties = {
  minWidth: 0,
  borderRadius: '14px',
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'rgba(7,17,33,0.56)',
  overflow: 'hidden',
  overflowWrap: 'anywhere',
}

const leagueCardSummaryStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '10px',
  minWidth: 0,
  padding: '10px 12px',
  cursor: 'pointer',
  listStyle: 'none',
  color: 'var(--foreground-strong)',
}

const leagueCardSummaryCopyStyle: CSSProperties = {
  display: 'grid',
  gap: '3px',
  minWidth: 0,
}

const leagueCardSummaryEyebrowStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: '10px',
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const leagueCardSummaryTitleStyle: CSSProperties = {
  color: 'rgba(228,238,252,0.84)',
  fontSize: '12px',
  lineHeight: 1.25,
  fontWeight: 850,
  overflowWrap: 'anywhere',
}

const leagueCardSummaryCueStyle: CSSProperties = {
  flex: '0 0 auto',
  color: 'var(--brand-lime)',
  fontSize: '11px',
  fontWeight: 950,
  textAlign: 'right',
  overflowWrap: 'anywhere',
}

const leagueCardDetailsBodyStyle: CSSProperties = {
  padding: '0 12px 12px',
  minWidth: 0,
}

const leagueLaneLimitStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: '10px',
  marginTop: '16px',
  padding: '12px',
  borderRadius: '18px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(7,17,33,0.72)',
  minWidth: 0,
}

const leagueLaneLimitTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const leagueLaneLimitButtonStyle: CSSProperties = {
  minHeight: '38px',
  padding: '0 12px',
  borderRadius: '999px',
  border: '1px solid rgba(155,225,29,0.22)',
  background: 'rgba(155,225,29,0.10)',
  color: 'var(--foreground-strong)',
  fontSize: '12px',
  fontWeight: 900,
  cursor: 'pointer',
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const emptyCardStyle: CSSProperties = {
  marginTop: '20px',
  padding: '22px',
  borderRadius: '24px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(8,16,34,0.66)',
  minWidth: 0,
}

const emptyTitleStyle: CSSProperties = {
  fontSize: '20px',
  fontWeight: 800,
  color: '#f4f9ff',
  overflowWrap: 'anywhere',
}

const emptyBodyStyle: CSSProperties = {
  marginTop: '10px',
  color: 'rgba(214,228,246,0.72)',
  fontSize: '14px',
  lineHeight: 1.8,
  maxWidth: '760px',
  overflowWrap: 'anywhere',
}

const emptyActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  marginTop: '16px',
  minWidth: 0,
}

const ghostButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '42px',
  padding: '0 14px',
  borderRadius: '999px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(7,17,33,0.72)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  fontWeight: 700,
  maxWidth: '100%',
  minWidth: 0,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
}

const stateStyle: CSSProperties = {
  width: 'min(1280px, calc(100% - clamp(24px, 5vw, 40px)))',
  margin: '18px auto 0',
  padding: '18px 20px',
  borderRadius: '22px',
  background: 'rgba(8,16,34,0.74)',
  color: 'var(--foreground-strong)',
  border: '1px solid rgba(116,190,255,0.13)',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const compactStateStyle: CSSProperties = {
  ...stateStyle,
  margin: '10px auto 0',
  padding: '10px',
  borderRadius: '16px',
}

const errorStyle: CSSProperties = {
  ...stateStyle,
  color: '#ffd8d8',
  border: '1px solid rgba(255,120,120,0.18)',
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

const watermarkStyle: CSSProperties = {
  position: 'absolute',
  right: 0,
  top: '-108px',
  width: 'min(280px, 58vw)',
  aspectRatio: '1045 / 490',
  background: 'url("/tiq/logo/tiq-mark-light.png") center / contain no-repeat',
  opacity: 0.14,
  pointerEvents: 'none',
}
