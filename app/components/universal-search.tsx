'use client'

import Link from 'next/link'
import { useId, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/components/auth-provider'
import { getPlanSignupHref, getPlanUnlockHref } from '@/lib/plan-intent'
import { trackProductUsageEvent } from '@/lib/product-usage-client'
import type { ProductUsageEventName, ProductUsageEventSurface } from '@/lib/product-usage-events'
import type { PricingPlanId } from '@/lib/pricing-plans'

type SearchGroup =
  | 'Players'
  | 'Teams'
  | 'Leagues'
  | 'Tournaments'
  | 'Coaches'
  | 'Courts / clubs'
  | 'Resources'
  | 'Actions'

type SearchResult = {
  group: SearchGroup
  title: string
  detail: string
  href: string
  keywords: string[]
  requiredPlan?: PricingPlanId
}

const results: SearchResult[] = [
  {
    group: 'Players',
    title: 'Find a player',
    detail: 'Search names, cities, ratings, teams, leagues, and recent context.',
    href: '/explore/players',
    keywords: ['player', 'name', 'rating', 'rating level', '4.0', '4.5', 'rankings', 'singles', 'doubles', 'doubles partner', 'opponent'],
  },
  {
    group: 'Teams',
    title: 'Find teams',
    detail: 'Browse rosters, flights, league context, opponents, and captains.',
    href: '/teams',
    keywords: ['team', 'captain', 'roster', 'lineup', 'flight', 'scout'],
  },
  {
    group: 'Leagues',
    title: 'Find leagues',
    detail: 'Search seasons, flights, districts, standings, schedules, and results.',
    href: '/leagues',
    keywords: ['league', '4.0 league near me', 'flight', 'standings', 'schedule', 'season'],
  },
  {
    group: 'Tournaments',
    title: 'Find tournaments',
    detail: 'Find events, divisions, draws, schedules, results, and winners.',
    href: '/tournaments',
    keywords: ['tournament', 'event', 'draw', 'division', 'round robin', 'ladder'],
  },
  {
    group: 'Coaches',
    title: 'Find a coach',
    detail: 'Connect goals, lesson notes, assignments, and player evidence.',
    href: '/coaches',
    keywords: ['coach', 'lesson', 'drill', 'serve practice', 'development'],
  },
  {
    group: 'Courts / clubs',
    title: 'Find courts and clubs',
    detail: 'Use resources to find places to play, clubs, ladders, and open play.',
    href: '/resources#play',
    keywords: ['court', 'club', 'open play', 'near me', 'city', 'location'],
  },
  {
    group: 'Resources',
    title: 'Tennis Resource Hub',
    detail: 'Play, improve, prepare, lead, run events, and fix tennis data.',
    href: '/resources',
    keywords: ['resource', 'practice', 'template', 'guide', 'ratings explained'],
  },
  {
    group: 'Actions',
    title: 'Open Data Assist',
    detail: 'Fix tennis data with scorecard uploads, schedule uploads, team summaries, corrections, and review requests.',
    href: '/data-assist?intent=upload-source&context=Universal%20search',
    keywords: ['open data assist', 'data assist', 'fix data', 'upload source'],
  },
  {
    group: 'Actions',
    title: 'Upload a scorecard',
    detail: 'Open Data Assist to upload scorecards, schedules, team summaries, and corrections.',
    href: '/data-assist?intent=upload-source&context=Universal%20search',
    keywords: ['scorecard upload', 'fix data', 'upload scorecard', 'data assist'],
  },
  {
    group: 'Actions',
    title: 'Report a data issue',
    detail: 'Tell TenAceIQ about a wrong player, team, score, rating, draw, standing, or source label.',
    href: '/data-assist?intent=report-issue&context=Universal%20search',
    keywords: ['report issue', 'wrong player', 'wrong team', 'wrong score', 'wrong rating', 'wrong draw', 'wrong standing', 'data issue'],
  },
  {
    group: 'Actions',
    title: 'Request data review',
    detail: 'Ask for reviewed tennis context after uploading source material or spotting missing data.',
    href: '/data-assist?intent=request-review&context=Universal%20search',
    keywords: ['request review', 'request data review', 'data review', 'review source', 'missing data', 'refresh data'],
  },
  {
    group: 'Actions',
    title: 'Compare two players',
    detail: 'Open Matchup for the edge, why, confidence, and watch item.',
    href: '/matchup',
    keywords: ['compare', 'matchup', 'prep', 'watch item', 'scout opponent'],
  },
  {
    group: 'Actions',
    title: 'Prep a matchup',
    detail: 'Search two players, preview the rating gap, and know what to watch before the match.',
    href: '/matchup',
    keywords: ['prepare for a match', 'prep a matchup', 'prep match', 'match prep', 'opponent prep'],
  },
  {
    group: 'Actions',
    title: 'Scout a team',
    detail: 'Open team context for roster depth, recent results, and matchup clues.',
    href: '/teams',
    keywords: ['scout team', 'scout a team', 'team scouting', 'opponent team', 'team strength'],
  },
  {
    group: 'Actions',
    title: 'Find a place to play',
    detail: 'Open Resource Hub play paths for teams, leagues, tournaments, courts, clubs, ladders, and open play.',
    href: '/resources#play',
    keywords: ['find a place to play', 'places to play', 'open play', 'find courts', 'find clubs', 'play tennis near me', 'join tennis'],
  },
  {
    group: 'Actions',
    title: 'Captain match week',
    detail: 'Open Teams for availability, lineup ideas, opponent scouting, communication, and scorecard reminders.',
    href: '/teams',
    keywords: ['captain match week', 'captain tools', 'team hub', 'availability', 'lineup ideas', 'scorecard reminders'],
  },
  {
    group: 'Actions',
    title: 'Build a lineup',
    detail: 'Open Captain Tools for availability, pairings, and court-by-court decisions.',
    href: '/captain/lineup-builder',
    keywords: ['captain lineup', 'lineup', 'availability', 'pairings', 'team edge'],
    requiredPlan: 'captain',
  },
  {
    group: 'Actions',
    title: 'Create a tournament',
    detail: 'Open Tournament Desk when it is time to run divisions, draws, courts, and results.',
    href: '/league-coordinator/tournaments',
    keywords: ['create tournament', 'run tournament', 'draws', 'entries', 'court schedule'],
    requiredPlan: 'full_court',
  },
  {
    group: 'Actions',
    title: 'Create a league',
    detail: 'Open League Office for schedules, standings, results, corrections, and messages.',
    href: '/league-coordinator',
    keywords: ['create league', 'league office', 'ladder', 'season', 'organizer'],
    requiredPlan: 'league',
  },
  {
    group: 'Actions',
    title: 'Find a coach',
    detail: 'Search coaching support, connect goals, and preview the Coach Hub loop.',
    href: '/coaches',
    keywords: ['find a coach', 'coach', 'coaching support', 'lesson', 'assignment', 'serve practice'],
  },
  {
    group: 'Actions',
    title: 'Open My Lab',
    detail: 'Choose a goal, save matchup notes, follow context, and track progress.',
    href: '/mylab',
    keywords: ['my lab', 'improve', 'goal', 'practice routine', 'follow'],
    requiredPlan: 'player_plus',
  },
]

const groupOrder: SearchGroup[] = [
  'Players',
  'Teams',
  'Leagues',
  'Tournaments',
  'Coaches',
  'Courts / clubs',
  'Resources',
  'Actions',
]

export default function UniversalSearch({
  compact = false,
  placeholder = 'Search a player, team, league, city, court, coach, tournament, or tennis resource',
}: {
  compact?: boolean
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const [activeGroup, setActiveGroup] = useState<SearchGroup | 'All'>('All')
  const [inputFocused, setInputFocused] = useState(false)
  const [focusedControl, setFocusedControl] = useState<string | null>(null)
  const searchId = useId()
  const resultRegionId = `${searchId}-results`
  const router = useRouter()
  const { session } = useAuth()

  const visibleResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    const scored = results
      .map((result) => {
        const haystack = [result.title, result.detail, ...result.keywords].join(' ').toLowerCase()
        const direct = haystack.includes(q)
        const tokenHits = q
          ? q.split(/\s+/).filter((token) => haystack.includes(token)).length
          : 0
        return { result, score: !q ? 1 : direct ? 3 + tokenHits : tokenHits }
      })
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)

    const filtered = activeGroup === 'All'
      ? scored
      : scored.filter((item) => item.result.group === activeGroup)

    return filtered.map((item) => item.result).slice(0, compact ? 6 : 10)
  }, [activeGroup, compact, query])

  const availableGroups = groupOrder.filter((group) =>
    results.some((result) => result.group === group),
  )

  const groupedResults = groupOrder
    .map((group) => ({
      group,
      items: visibleResults.filter((result) => result.group === group),
    }))
    .filter((group) => group.items.length > 0)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const q = query.trim()
    if (!q) {
      void trackProductUsageEvent({
        eventName: 'search_submitted',
        surface: 'search',
        metadata: { query: '', destination: '/explore', resultCount: visibleResults.length },
      })
      router.push('/explore')
      return
    }

    const first = visibleResults[0]
    const destination = first
      ? buildResultHref(first, q, Boolean(session?.user))
      : `/explore/search?q=${encodeURIComponent(q)}`
    const searchEvent = getSearchIntentEvent(q, first?.group)
    void trackProductUsageEvent({
      eventName: visibleResults.length ? searchEvent.eventName : 'zero_result_seen',
      surface: visibleResults.length ? searchEvent.surface : 'search',
      metadata: {
        query: q,
        destination,
        resultCount: visibleResults.length,
        topGroup: first?.group ?? null,
      },
    })
    router.push(destination)
  }

  function trackResultClick(item: SearchResult) {
    const clickEvent = getSearchIntentEvent([query.trim(), item.title, item.detail].join(' '), item.group)
    void trackProductUsageEvent({
      eventName: clickEvent.eventName === 'search_submitted' ? 'search_result_clicked' : clickEvent.eventName,
      surface: clickEvent.eventName === 'search_submitted' ? 'search' : clickEvent.surface,
      metadata: {
        query: query.trim(),
        group: item.group,
        title: item.title,
        href: item.href,
      },
    })
  }

  function selectGroup(group: SearchGroup | 'All') {
    setActiveGroup(group)
    void trackProductUsageEvent({
      eventName: 'search_category_selected',
      surface: 'search',
      metadata: {
        query: query.trim(),
        category: group,
      },
    })
  }

  function broadenZeroResultSearch() {
    void trackProductUsageEvent({
      eventName: 'zero_result_seen',
      surface: 'search',
      metadata: {
        query: query.trim(),
        category: activeGroup,
        recovery: 'all_categories',
      },
    })
    selectGroup('All')
  }

  return (
    <div style={searchShellStyle}>
      <form onSubmit={handleSubmit} role="search" aria-label="Search TenAceIQ" style={formStyle}>
        <label htmlFor={`tiq-universal-search-${searchId}`} style={srOnlyStyle}>
          Search tennis
        </label>
        <input
          id={`tiq-universal-search-${searchId}`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onBlur={() => setInputFocused(false)}
          onFocus={() => setInputFocused(true)}
          placeholder={placeholder}
          aria-controls={resultRegionId}
          style={{
            ...inputStyle,
            ...(inputFocused ? inputFocusStyle : null),
          }}
        />
        <button
          type="submit"
          onBlur={() => setFocusedControl(null)}
          onFocus={() => setFocusedControl('submit')}
          style={{
            ...buttonStyle,
            ...(focusedControl === 'submit' ? buttonFocusStyle : null),
          }}
        >
          Search Tennis
        </button>
      </form>
      {!compact ? (
        <div style={categoryRowStyle} aria-label="Search categories">
          {(['All', ...availableGroups] as Array<SearchGroup | 'All'>).map((group) => (
            <button
              key={group}
              type="button"
              aria-pressed={activeGroup === group}
              onBlur={() => setFocusedControl(null)}
              onFocus={() => setFocusedControl(`category-${group}`)}
              onClick={() => selectGroup(group)}
              style={{
                ...categoryButtonStyle,
                ...(activeGroup === group ? categoryButtonActiveStyle : null),
                ...(focusedControl === `category-${group}` ? buttonFocusStyle : null),
              }}
            >
              {group}
            </button>
          ))}
        </div>
      ) : null}
      <div id={resultRegionId} role="region" aria-label="Universal search results" style={resultGridStyle} aria-live="polite">
        {groupedResults.length ? (
          groupedResults.map(({ group, items }) => (
            <section key={group} style={resultGroupStyle} aria-label={`${group} search results`}>
              <div style={groupLabelStyle}>{group}</div>
              {items.map((item) => (
                <Link key={`${item.group}-${item.title}`} href={buildResultHref(item, query, Boolean(session?.user))} style={resultLinkStyle} onClick={() => trackResultClick(item)}>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </Link>
              ))}
            </section>
          ))
        ) : (
          <div role="status" style={noResultStyle}>
            <span>No matching tennis action in this category. Try All or search a broader tennis term.</span>
            <div style={noResultActionRowStyle}>
              {activeGroup !== 'All' ? (
                <button
                  type="button"
                  onBlur={() => setFocusedControl(null)}
                  onFocus={() => setFocusedControl('zero-result-all')}
                  onClick={broadenZeroResultSearch}
                  style={{
                    ...noResultButtonStyle,
                    ...(focusedControl === 'zero-result-all' ? buttonFocusStyle : null),
                  }}
                >
                  Search all categories
                </button>
              ) : null}
              <Link
                href={query.trim() ? `/resources?q=${encodeURIComponent(query.trim())}` : '/resources'}
                onBlur={() => setFocusedControl(null)}
                onFocus={() => setFocusedControl('zero-result-resource')}
                style={{
                  ...noResultLinkStyle,
                  ...(focusedControl === 'zero-result-resource' ? buttonFocusStyle : null),
                }}
              >
                Open Resource Hub
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function getSearchIntentEvent(query: string, group?: SearchGroup | null): { eventName: ProductUsageEventName; surface: ProductUsageEventSurface } {
  const q = query.toLowerCase()

  if (q.includes('captain match week') || q.includes('captain tools') || q.includes('team hub')) return { eventName: 'captain_tools_clicked', surface: 'teams' }
  if (group === 'Teams' || q.includes('team') || q.includes('scout team')) return { eventName: 'team_search_submitted', surface: 'teams' }
  if (group === 'Leagues' || q.includes('league')) return { eventName: 'league_search_submitted', surface: 'leagues' }
  if (group === 'Tournaments' || q.includes('tournament') || q.includes('draw')) return { eventName: 'tournament_search_submitted', surface: 'tournaments' }
  if (group === 'Coaches' || q.includes('coach')) return { eventName: 'find_coach_clicked', surface: 'coach' }
  if (q.includes('report issue') || q.includes('wrong player') || q.includes('wrong team') || q.includes('wrong score') || q.includes('wrong rating') || q.includes('data issue')) return { eventName: 'data_issue_reported', surface: 'data_assist' }
  if (q.includes('data assist') || q.includes('scorecard') || q.includes('upload') || q.includes('fix data') || q.includes('request review')) return { eventName: 'data_assist_opened', surface: 'data_assist' }
  if (q.includes('lineup')) return { eventName: 'lineup_preview_clicked', surface: 'teams' }
  if (q.includes('availability')) return { eventName: 'availability_clicked', surface: 'teams' }
  if (group === 'Actions' && (q.includes('matchup') || q.includes('compare') || q.includes('match prep') || q.includes('prepare for a match'))) return { eventName: 'matchup_started', surface: 'matchup' }

  return { eventName: 'search_submitted', surface: 'search' }
}

function buildResultHref(item: SearchResult, query: string, signedIn = false) {
  const q = query.trim()
  const destinationHref = appendSearchQuery(item.href, q)

  if (!item.requiredPlan) return destinationHref

  const upgradeHref = getPlanUnlockHref(item.requiredPlan, destinationHref)
  return signedIn ? upgradeHref : getPlanSignupHref(item.requiredPlan, upgradeHref)
}

function appendSearchQuery(href: string, query: string) {
  const q = query.trim()
  if (!q) return href

  const [pathWithSearch, hash = ''] = href.split('#')
  const separator = pathWithSearch.includes('?') ? '&' : '?'
  return `${pathWithSearch}${separator}q=${encodeURIComponent(q)}${hash ? `#${hash}` : ''}`
}

const searchShellStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  width: '100%',
  minWidth: 0,
}

const formStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(120px, auto)',
  gap: 10,
  minWidth: 0,
}

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 54,
  borderRadius: 18,
  border: '1px solid rgba(116,190,255,0.22)',
  background: 'rgba(5,12,26,0.82)',
  color: 'var(--foreground-strong)',
  padding: '0 16px',
  fontSize: 15,
  fontWeight: 750,
  outline: '2px solid transparent',
  outlineOffset: 2,
  minWidth: 0,
  boxShadow: 'var(--home-control-shadow)',
}

const inputFocusStyle: CSSProperties = {
  border: '1px solid color-mix(in srgb, var(--brand-green) 42%, var(--shell-panel-border) 58%)',
  outline: '2px solid color-mix(in srgb, var(--brand-green) 44%, transparent)',
  boxShadow: '0 0 0 5px rgba(155,225,29,0.12), var(--home-control-shadow)',
}

const buttonStyle: CSSProperties = {
  minHeight: 54,
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
  background: 'linear-gradient(180deg, #eaff9e 0%, #9be11d 100%)',
  color: '#071226',
  padding: '0 18px',
  fontSize: 14,
  fontWeight: 950,
  cursor: 'pointer',
  whiteSpace: 'normal',
}

const buttonFocusStyle: CSSProperties = {
  outline: '2px solid color-mix(in srgb, var(--brand-green) 54%, transparent)',
  outlineOffset: 3,
  boxShadow: '0 0 0 5px rgba(155,225,29,0.14)',
}

const categoryRowStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
}

const categoryButtonStyle: CSSProperties = {
  minHeight: 34,
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.15)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--shell-copy-muted)',
  padding: '0 11px',
  fontSize: 12,
  fontWeight: 900,
  cursor: 'pointer',
}

const categoryButtonActiveStyle: CSSProperties = {
  border: '1px solid color-mix(in srgb, var(--brand-green) 34%, var(--shell-panel-border) 66%)',
  background: 'color-mix(in srgb, var(--brand-green) 12%, var(--shell-chip-bg) 88%)',
  color: 'var(--foreground-strong)',
}

const resultGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const resultGroupStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  minWidth: 0,
}

const noResultStyle: CSSProperties = {
  gridColumn: '1 / -1',
  display: 'grid',
  gap: 12,
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--shell-copy-muted)',
  padding: 14,
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 850,
}

const noResultActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
}

const noResultButtonStyle: CSSProperties = {
  minHeight: 36,
  border: '1px solid rgba(116,190,255,0.22)',
  borderRadius: 999,
  background: 'rgba(15,23,42,0.72)',
  color: 'var(--foreground-strong)',
  padding: '0 12px',
  font: 'inherit',
  fontSize: 12,
  fontWeight: 950,
  cursor: 'pointer',
}

const noResultLinkStyle: CSSProperties = {
  ...noResultButtonStyle,
  display: 'inline-flex',
  alignItems: 'center',
  textDecoration: 'none',
}

const groupLabelStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const resultLinkStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minHeight: 76,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--shell-copy-muted)',
  textDecoration: 'none',
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 760,
  overflowWrap: 'anywhere',
}

const srOnlyStyle: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
}
