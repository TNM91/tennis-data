import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import JsonLd from '@/app/components/json-ld'
import {
  CommandHero,
  PublicPageShell,
  SectionHeader,
  TrustStrip,
  pageWrapStyle,
} from '@/app/components/public-command-center'
import { TiqActionCard, TiqResourceCard } from '@/app/components/tiq-product-preview-cards'
import TrackedProductLink from '@/app/components/tracked-product-link'
import type { ProductUsageEventName, ProductUsageEventSurface } from '@/lib/product-usage-events'
import { buildRouteMetadata } from '@/lib/route-metadata'
import { buildFaqJsonLd, buildPublicSectionBreadcrumbJsonLd } from '@/lib/structured-data'

export const metadata: Metadata = buildRouteMetadata({
  title: 'Resources',
  description:
    'Tennis resources for finding places to play, improving, preparing, captaining, running leagues and tournaments, and fixing data.',
  path: '/resources',
})

const groups = [
  {
    id: 'play',
    title: 'Play',
    body: 'Find the fastest path from wanting a match, team, event, or court time to actually getting on court.',
    searchTerms: ['find a place to play', 'join tennis', 'open play near me', 'where can I play', 'court time'],
    items: ['Find players', 'Find teams', 'Find leagues', 'Find tournaments', 'Open play ideas', 'Court and club checklist'],
  },
  {
    id: 'drills',
    title: 'Drills',
    body: 'Find focused practice work that turns one tennis problem into one repeatable court task.',
    searchTerms: ['what drill should I do', 'practice plan', 'serve reps', 'return reps', 'court work'],
    items: ['Serve target ladder', 'Return depth reps', 'Crosscourt consistency', 'Approach and close', 'Second-serve pressure', 'Doubles poach timing'],
  },
  {
    id: 'skills',
    title: 'Skills',
    body: 'Break the game into simple skills players can understand, train, and track.',
    searchTerms: ['what skill should I improve', 'what should I work on', 'level up faster', 'how am I improving'],
    items: ['Serve routine', 'Return plan', 'Rally tolerance', 'Net finishing', 'Doubles communication', 'Pressure habits'],
  },
  {
    id: 'strategy',
    title: 'Strategy',
    body: 'Turn scouting and match patterns into plain-English plans players can remember under pressure.',
    searchTerms: ['what matchups matter', 'match plan', 'scout opponent', 'how do I compete', 'what strategy should I use'],
    items: ['Singles patterns', 'Doubles positioning', 'Tiebreaker plan', 'Playoff watch items', 'Opponent scouting', 'Ratings explained'],
  },
  {
    id: 'fitness-movement',
    title: 'Fitness / movement',
    body: 'Support tennis movement, readiness, recovery, and court habits without overcomplicating training.',
    searchTerms: ['movement', 'fitness', 'footwork', 'warm up', 'recovery', 'match readiness'],
    items: ['Split-step routine', 'Recovery patterns', 'Warm-up checklist', 'Lateral movement', 'Match-day readiness', 'Injury-aware practice'],
  },
  {
    id: 'match-prep',
    title: 'Match prep',
    body: 'Answer what matchups matter, what to watch, and what plan gives a player or team a better chance.',
    searchTerms: ['prepare for a match', 'matchup insight', 'matchups matter', 'what to watch', 'scouting'],
    items: ['Matchup prep', 'Player scouting', 'Team scouting', 'Singles/doubles split', 'Lineup pressure checks', 'Pre-match checklist'],
  },
  {
    id: 'captain-tools',
    title: 'Captain tools',
    body: 'Help captains answer who can play, what lineup to use, who should play together, and what to communicate.',
    searchTerms: ['who is available', 'best lineup', 'who should play together', 'what should I communicate', 'manage less chaos'],
    items: ['Captain checklist', 'Availability template', 'Lineup builder guide', 'Partner fit prompts', 'Team communication guide', 'Scorecard reminders'],
  },
  {
    id: 'coach-tools',
    title: 'Coach tools',
    body: 'Help coaches assign drills, track development, recommend resources, and support players between sessions.',
    searchTerms: ['assign drills', 'track player development', 'recommend resources', 'support players between sessions', 'lesson plan'],
    items: ['Find a coach', 'Lesson plan frame', 'Coach assignment templates', 'Player development check-in', 'Practice proof guide', 'Coach planner'],
  },
  {
    id: 'league-tournament-tools',
    title: 'League/tournament tools',
    body: 'Help organizers set up competition, manage schedules, track scores, and reduce admin work.',
    searchTerms: ['organize schedules', 'manage players teams', 'track scores', 'reduce admin work', 'run a league or tournament'],
    items: ['League setup checklist', 'Tournament setup checklist', 'Track scores checklist', 'Draw formats', 'Round-robin formats', 'Scheduling checklist', 'Tiebreaker guide'],
  },
  {
    id: 'player-development-modules',
    title: 'Player development modules',
    body: 'Use development paths to connect ratings, goals, drills, skills, and progress into a practical player plan.',
    searchTerms: ['what should I work on', 'how am I improving', 'drills or resources', 'level up faster', 'player progress'],
    items: ['Player development paths', 'Level Up cards', 'Match reflection templates', 'Progress tracking', 'Coach connection', 'Training resources'],
  },
  {
    id: 'fix-data',
    title: 'Fix tennis context',
    body: 'Upload source material, report corrections, and request a reviewed data refresh.',
    searchTerms: ['wrong score', 'missing result', 'fix data', 'upload source', 'data review'],
    items: ['Upload scorecard', 'Upload team summary', 'Upload schedule', 'Report wrong player', 'Report wrong team', 'Request data refresh'],
  },
] as const

const resourceFaqItems = [
  {
    question: 'What can I find in TenAceIQ Resources?',
    answer: 'Resources connect tennis players and organizers to play, improvement, match prep, captain tools, league and tournament operations, and Data Assist actions.',
  },
  {
    question: 'How do I fix wrong tennis data in TenAceIQ?',
    answer: 'Use Data Assist to upload a scorecard, team summary, schedule, or correction request so the context can move through review.',
  },
  {
    question: 'Does TenAceIQ replace official league or tournament records?',
    answer: 'No. TenAceIQ is a tennis intelligence and action layer. Source, freshness, confidence, and review status help users understand when tennis context needs verification.',
  },
] as const

type ResourcesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function getSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || ''
  return value || ''
}

export default async function ResourcesPage({ searchParams }: ResourcesPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const resourceQuery = getSearchParamValue(resolvedSearchParams.q).trim().slice(0, 80)
  const resourceMatches = getResourceMatches(resourceQuery)
  const visibleGroups = resourceMatches.length
    ? [
        ...resourceMatches.map((match) => match.group),
        ...groups.filter((group) => !resourceMatches.some((match) => match.group.id === group.id)),
      ]
    : groups

  return (
    <PublicPageShell active="resources">
      <main style={pageWrapStyle}>
        <JsonLd id="resources-breadcrumb-jsonld" data={buildPublicSectionBreadcrumbJsonLd('Resources', '/resources')} />
        <JsonLd id="resources-faq-jsonld" data={buildFaqJsonLd(resourceFaqItems)} />
        <CommandHero
          eyebrow="Resources"
          title="The tennis resource hub for less chaos."
          body="Find drills, skills, strategy, match prep, captain tools, coach tools, league and tournament tools, and player development modules in one approachable place."
          primary={{ href: '/player-development', label: 'Level Up My Game' }}
          secondary={{ href: '/matchup', label: 'Prep a Matchup' }}
        />
        <section style={needPathStyle} aria-labelledby="resource-need-title">
          <div style={needPathHeaderStyle}>
            <p style={needPathEyebrowStyle}>I need to...</p>
            <h2 id="resource-need-title" style={needPathTitleStyle}>
              Get to the right tennis help fast.
            </h2>
            <p style={needPathTextStyle}>
              Pick the job in your head. TenAceIQ turns it into a practical resource path instead of another search spiral.
            </p>
          </div>
          <div style={needPathGridStyle}>
            {resourceNeedPaths.map((path) => (
              <TrackedProductLink
                key={path.job}
                href={path.href}
                style={needPathCardStyle}
                ariaLabel={`${path.question}: ${path.cta}`}
                event={path.event}
              >
                <span style={needPathQuestionStyle}>{path.question}</span>
                <span style={needPathCtaStyle}>{path.cta}</span>
              </TrackedProductLink>
            ))}
          </div>
        </section>
        {resourceQuery ? (
          <section style={queryPanelStyle} aria-label="Resource search context">
            <div>
              <p style={queryKickerStyle}>Resource search</p>
              <h2 style={queryTitleStyle}>Showing useful paths for &quot;{resourceQuery}&quot;.</h2>
              <p style={queryTextStyle}>
                {resourceMatches.length
                  ? 'The most relevant resource paths are shown first, with the full hub still available below.'
                  : 'No exact resource path matched that phrase yet, so the full hub is ready below.'}
              </p>
            </div>
            {resourceMatches.length ? (
              <div style={queryActionRowStyle}>
                {resourceMatches.slice(0, 4).flatMap((match) =>
                  match.items.slice(0, 2).map((item) => (
                    <TrackedProductLink
                      key={`${match.group.id}-${item}`}
                      href={resourceHref(item)}
                      style={queryActionStyle}
                      event={resourceClickEvent(item, match.group.title)}
                    >
                      {item}
                    </TrackedProductLink>
                  )),
                )}
              </div>
            ) : null}
          </section>
        ) : null}
        <section style={quickStartSectionStyle} aria-labelledby="resource-quick-start-title">
          <SectionHeader
            eyebrow="Quick starts"
            title="Start with the tennis need, then open the right path."
            body="These routes cover the most common reasons someone lands here: improving, preparing, captaining, coaching, organizing, or fixing the context that powers TenAceIQ."
            titleId="resource-quick-start-title"
          />
          <div style={quickStartGridStyle}>
            {resourceQuickStarts.map((quickStart) => (
              <TiqActionCard
                key={quickStart.title}
                eyebrow={quickStart.eyebrow}
                title={quickStart.title}
                body={quickStart.body}
                metrics={[...quickStart.metrics]}
                href={quickStart.href}
                cta={quickStart.cta}
                event={quickStart.event}
                trust={[...quickStart.trust]}
              />
            ))}
          </div>
        </section>
        <section style={{ display: 'grid', gap: 14 }}>
          <SectionHeader
            eyebrow="Resource Hub"
            title="Drills, skills, strategy, tools, and development paths."
            body="TenAceIQ should feel like a resource hub people can come back to when they need one clear next tennis move."
          />
          <div style={resourceGridStyle}>
            {visibleGroups.map((group) => (
              <div key={group.id} id={group.id}>
                <TiqResourceCard
                  eyebrow="Resource path"
                  title={group.title}
                  body={group.body}
                  metrics={[
                    { label: 'Actions', value: String(group.items.length) },
                    { label: 'Path', value: group.title },
                  ]}
                >
                  <div style={resourceListStyle}>
                    {group.items.map((item) => (
                      <TrackedProductLink
                        key={item}
                        href={resourceHref(item)}
                        style={resourceLinkStyle}
                        event={resourceClickEvent(item, group.title)}
                      >
                        {item}
                      </TrackedProductLink>
                    ))}
                  </div>
                </TiqResourceCard>
              </div>
            ))}
          </div>
        </section>
        <section style={{ display: 'grid', gap: 10 }}>
          <SectionHeader
            eyebrow="Fix Data / Data Assist"
            title="The resource hub also explains what to trust."
            body="Every tennis read should make source, freshness, confidence, and review status visible enough that players and organizers know what to do next."
          />
          <TrustStrip
            context="Resources trust strip"
            signals={[
              { label: 'Source', value: 'USTA / TIQ / user upload', tone: 'info' },
              { label: 'Freshness', value: 'Last refreshed shown', tone: 'info' },
              { label: 'Confidence', value: 'High / medium / limited', tone: 'warn' },
              { label: 'Status', value: 'Verified or needs review', tone: 'good' },
            ]}
          />
        </section>
      </main>
    </PublicPageShell>
  )
}

const resourceQuickStarts = [
  {
    eyebrow: 'Play',
    title: 'Find a place to play',
    body: 'Start with teams, leagues, tournaments, courts, clubs, ladders, or open play when the job is getting on court.',
    metrics: [
      { label: 'Paths', value: 'Play' },
      { label: 'Context', value: 'Local' },
      { label: 'Next', value: 'Join' },
    ],
    href: '/resources#play',
    cta: 'Find Play Paths',
    event: {
      eventName: 'search_result_clicked',
      surface: 'public_site',
      metadata: {
        location: 'resources_quick_start',
        job: 'play',
      },
    },
    trust: [
      { label: 'Source', value: 'Resource hub', tone: 'info' },
      { label: 'Status', value: 'Browse ready', tone: 'good' },
    ],
  },
  {
    eyebrow: 'Find',
    title: 'Find coaching support',
    body: 'Start with coaching when the next tennis action is a lesson, clinic, question, or practice plan.',
    metrics: [
      { label: 'Need', value: 'Coach' },
      { label: 'Path', value: 'Coaches' },
      { label: 'Next', value: 'Connect' },
    ],
    href: '/coaches',
    cta: 'Find a Coach',
    event: {
      eventName: 'find_coach_clicked',
      surface: 'coach',
      metadata: {
        location: 'resources_quick_start',
      },
    },
    trust: [
      { label: 'Source', value: 'Resource hub', tone: 'info' },
      { label: 'Status', value: 'Discovery ready', tone: 'good' },
    ],
  },
  {
    eyebrow: 'Improve',
    title: 'Find drills and skills',
    body: 'Open development paths when the next step should be a focused drill, skill cue, or simple practice plan.',
    metrics: [
      { label: 'Need', value: 'Improve' },
      { label: 'Path', value: 'Drills' },
      { label: 'Next', value: 'Practice' },
    ],
    href: '/player-development',
    cta: 'Find Drills',
    event: {
      eventName: 'search_result_clicked',
      surface: 'public_site',
      metadata: {
        location: 'resources_quick_start',
        job: 'find_drills_skills',
      },
    },
    trust: [
      { label: 'Source', value: 'Development paths', tone: 'info' },
      { label: 'Status', value: 'Practice ready', tone: 'good' },
    ],
  },
  {
    eyebrow: 'Lead',
    title: 'Captain match week',
    body: 'Use Teams when availability, lineup ideas, opponent scouting, communication, and scorecard reminders need one path.',
    metrics: [
      { label: 'Role', value: 'Captain' },
      { label: 'Tool', value: 'Team Hub' },
      { label: 'Tools', value: 'Match week' },
    ],
    href: '/teams',
    cta: 'Open Captain Tools',
    event: {
      eventName: 'captain_tools_clicked',
      surface: 'teams',
      metadata: {
        location: 'resources_quick_start',
      },
    },
    trust: [
      { label: 'Source', value: 'Team context', tone: 'info' },
      { label: 'Status', value: 'Public path', tone: 'good' },
    ],
  },
  {
    eyebrow: 'Prepare',
    title: 'Prep the next match',
    body: 'Use Matchup when a player, team, or ranking signal needs a practical read before match time.',
    metrics: [
      { label: 'Read', value: 'Edge' },
      { label: 'Signal', value: 'Watch item' },
      { label: 'Use', value: 'Match day' },
    ],
    href: '/matchup',
    cta: 'Prep Matchup',
    event: {
      eventName: 'matchup_started',
      surface: 'matchup',
      metadata: {
        location: 'resources_quick_start',
      },
    },
    trust: [
      { label: 'Source', value: 'Player context', tone: 'info' },
      { label: 'Confidence', value: 'Data-dependent', tone: 'warn' },
    ],
  },
  {
    eyebrow: 'Run',
    title: 'Run an event',
    body: 'Open tournament and league paths when draws, schedules, standings, results, or updates need one place.',
    metrics: [
      { label: 'Events', value: 'Tournaments' },
      { label: 'Seasons', value: 'Leagues' },
      { label: 'Next', value: 'Desk' },
    ],
    href: '/leagues-and-tournaments',
    cta: 'Open Organizer Hub',
    event: {
      eventName: 'league_office_clicked',
      surface: 'leagues',
      metadata: {
        location: 'resources_quick_start',
        job: 'organize_competition',
      },
    },
    trust: [
      { label: 'Status', value: 'Public path', tone: 'good' },
      { label: 'Source', value: 'Tournament Desk', tone: 'info' },
    ],
  },
  {
    eyebrow: 'Fix data',
    title: 'Upload or report a source',
    body: 'Use Data Assist when scorecards, schedules, rosters, player records, or standings need review.',
    metrics: [
      { label: 'Upload', value: 'Source' },
      { label: 'Review', value: 'Required' },
      { label: 'Feeds', value: 'Platform' },
    ],
    href: '/data-assist?intent=upload-source&context=Resources%20quick%20starts',
    cta: 'Open Data Assist',
    event: {
      eventName: 'data_assist_opened',
      surface: 'data_assist',
      metadata: {
        location: 'resources_quick_start',
      },
    },
    trust: [
      { label: 'Source', value: 'User upload', tone: 'info' },
      { label: 'Status', value: 'Review before use', tone: 'warn' },
    ],
  },
] as const

const resourceNeedPaths = [
  {
    question: 'Work on my game',
    cta: 'Open drills, skills, and development',
    href: '/resources#player-development-modules',
    job: 'improve_player_game',
    event: {
      eventName: 'search_result_clicked',
      surface: 'public_site',
      metadata: {
        location: 'resources_need_path',
        job: 'improve_player_game',
      },
    },
  },
  {
    question: 'Prepare for a match',
    cta: 'Open matchup and strategy help',
    href: '/resources#match-prep',
    job: 'prepare_match',
    event: {
      eventName: 'matchup_started',
      surface: 'matchup',
      metadata: {
        location: 'resources_need_path',
        job: 'prepare_match',
      },
    },
  },
  {
    question: 'Captain this week',
    cta: 'Open availability and lineup tools',
    href: '/resources#captain-tools',
    job: 'captain_week',
    event: {
      eventName: 'captain_tools_clicked',
      surface: 'teams',
      metadata: {
        location: 'resources_need_path',
        job: 'captain_week',
      },
    },
  },
  {
    question: 'Support a player',
    cta: 'Open coach tools',
    href: '/resources#coach-tools',
    job: 'support_player',
    event: {
      eventName: 'find_coach_clicked',
      surface: 'coach',
      metadata: {
        location: 'resources_need_path',
        job: 'support_player',
      },
    },
  },
  {
    question: 'Run a league or tournament',
    cta: 'Open organizer tools',
    href: '/resources#league-tournament-tools',
    job: 'organize_competition',
    event: {
      eventName: 'league_office_clicked',
      surface: 'leagues',
      metadata: {
        location: 'resources_need_path',
        job: 'organize_competition',
      },
    },
  },
  {
    question: 'Fix missing or wrong data',
    cta: 'Open Data Assist steps',
    href: '/resources#fix-data',
    job: 'fix_tennis_context',
    event: {
      eventName: 'data_assist_opened',
      surface: 'data_assist',
      metadata: {
        location: 'resources_need_path',
        job: 'fix_tennis_context',
      },
    },
  },
] as const

function getResourceMatches(query: string) {
  const normalizedQuery = query.toLowerCase()
  if (!normalizedQuery) return []
  const tokens = normalizedQuery
    .split(/\s+/)
    .filter((token) => token.length > 1 && !['a', 'an', 'the', 'to', 'for', 'and', 'or'].includes(token))
  const isFocusedQuery = tokens.length > 1

  return groups
    .map((group) => {
      const scoredItems = group.items
        .map((item) => {
          const itemText = item.toLowerCase()
          const exactMatch = itemText.includes(normalizedQuery)
          const allTokenMatch = tokens.length > 0 && tokens.every((token) => itemText.includes(token))
          const looseTokenMatch = !isFocusedQuery && tokens.some((token) => itemText.includes(token))
          const score = exactMatch ? 12 : allTokenMatch ? 8 : looseTokenMatch ? 2 : 0
          return { item, score }
        })
        .filter((item) => item.score > 0)
        .sort((left, right) => right.score - left.score)
      const items = scoredItems.map((item) => item.item)
      const groupText = `${group.title} ${group.body} ${group.searchTerms.join(' ')}`.toLowerCase()
      const groupExactMatch = groupText.includes(normalizedQuery)
      const groupAllTokenMatch = tokens.length > 0 && tokens.every((token) => groupText.includes(token))
      const groupLooseTokenMatch = !isFocusedQuery && tokens.some((token) => groupText.includes(token))
      const groupMatches = groupExactMatch || groupAllTokenMatch || groupLooseTokenMatch
      const groupScore = groupExactMatch ? 6 : groupAllTokenMatch ? 4 : groupLooseTokenMatch ? 1 : 0
      const itemScore = scoredItems.reduce((sum, item) => sum + item.score, 0)
      const score = itemScore + groupScore
      return { group, items: items.length ? items : groupMatches ? [...group.items].slice(0, 2) : [], score }
    })
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score)
}

function resourceHref(item: string) {
  const lower = item.toLowerCase()
  if (lower.includes('coach')) return '/coaches'
  if (lower.includes('team')) return '/teams'
  if (
    lower.includes('league setup') ||
    lower.includes('tournament setup') ||
    lower.includes('track scores') ||
    lower.includes('round-robin') ||
    lower.includes('scheduling checklist') ||
    lower.includes('tiebreaker guide') ||
    lower.includes('court and club')
  ) return '/leagues-and-tournaments'
  if (lower.includes('league')) return '/leagues'
  if (lower.includes('tournament') || lower.includes('draw')) return '/tournaments'
  if (lower.includes('wrong')) return '/data-assist?intent=report-issue&context=Resources%20hub'
  if (lower.includes('refresh') || lower.includes('review')) return '/data-assist?intent=request-review&context=Resources%20hub'
  if (lower.includes('scorecard') || lower.includes('upload')) return '/data-assist?intent=upload-source&context=Resources%20hub'
  if (lower.includes('matchup') || lower.includes('scouting')) return '/matchup'
  if (
    lower.includes('development') ||
    lower.includes('level up') ||
    lower.includes('practice') ||
    lower.includes('serve') ||
    lower.includes('return') ||
    lower.includes('rally') ||
    lower.includes('doubles') ||
    lower.includes('movement') ||
    lower.includes('recovery') ||
    lower.includes('warm-up') ||
    lower.includes('skills') ||
    lower.includes('training')
  ) return '/player-development'
  if (lower.includes('lineup') || lower.includes('availability') || lower.includes('captain') || lower.includes('partner')) return '/captain'
  return '/explore'
}

function resourceClickEvent(item: string, group: string) {
  const href = resourceHref(item)
  const lower = item.toLowerCase()
  let eventName: ProductUsageEventName = 'search_result_clicked'
  let surface: ProductUsageEventSurface = 'public_site'

  if (lower.includes('coach')) {
    eventName = 'find_coach_clicked'
    surface = 'coach'
  } else if (lower.includes('team')) {
    eventName = 'team_search_submitted'
    surface = 'teams'
  } else if (lower.includes('league') || lower.includes('track scores')) {
    eventName = 'league_search_submitted'
    surface = 'leagues'
  } else if (lower.includes('tournament') || lower.includes('draw')) {
    eventName = lower.includes('draw') ? 'draw_preview_clicked' : 'tournament_search_submitted'
    surface = 'tournaments'
  } else if (lower.includes('lineup')) {
    eventName = 'lineup_preview_clicked'
    surface = 'teams'
  } else if (lower.includes('availability')) {
    eventName = 'availability_clicked'
    surface = 'teams'
  } else if (lower.includes('scorecard') || lower.includes('upload') || lower.includes('wrong') || lower.includes('refresh')) {
    eventName = lower.includes('wrong') ? 'data_issue_reported' : 'data_assist_opened'
    surface = 'data_assist'
  } else if (lower.includes('matchup') || lower.includes('scouting')) {
    eventName = 'matchup_started'
    surface = 'matchup'
  }

  return {
    eventName,
    surface,
    metadata: {
      item,
      group,
      href,
      context: 'resources_hub',
    },
  }
}

const resourceGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
  gap: 14,
  minWidth: 0,
}

const quickStartSectionStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  minWidth: 0,
}

const quickStartGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
  gap: 14,
  minWidth: 0,
}

const needPathStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
  gap: 14,
  alignItems: 'stretch',
  minWidth: 0,
  border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
  borderRadius: 8,
  padding: 'clamp(14px, 3vw, 20px)',
  background:
    'linear-gradient(135deg, color-mix(in srgb, var(--brand-green) 10%, var(--shell-panel-bg) 90%), color-mix(in srgb, var(--brand-blue-2) 9%, var(--shell-panel-bg) 91%))',
}

const needPathHeaderStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  alignContent: 'center',
  minWidth: 0,
}

const needPathEyebrowStyle: CSSProperties = {
  margin: 0,
  color: 'var(--brand-green)',
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
}

const needPathTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(21px, 3vw, 30px)',
  lineHeight: 1.08,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const needPathTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.55,
  overflowWrap: 'anywhere',
}

const needPathGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const needPathCardStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minHeight: 100,
  minWidth: 0,
  alignContent: 'space-between',
  padding: 13,
  borderRadius: 8,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 18%, var(--shell-panel-border) 82%)',
  background: 'color-mix(in srgb, var(--shell-chip-bg) 78%, var(--brand-blue-2) 22%)',
  color: 'inherit',
  textDecoration: 'none',
}

const needPathQuestionStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 15,
  lineHeight: 1.25,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const needPathCtaStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 12,
  lineHeight: 1.25,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const resourceListStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
}

const resourceLinkStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  minHeight: 40,
  maxWidth: '100%',
  padding: '9px 11px',
  borderRadius: 8,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 16%, var(--shell-panel-border) 84%)',
  background: 'color-mix(in srgb, var(--brand-blue-2) 7%, var(--shell-chip-bg) 93%)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  fontSize: 14,
  fontWeight: 850,
  lineHeight: 1.35,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const queryPanelStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  borderRadius: 8,
  padding: 18,
  minWidth: 0,
}

const queryKickerStyle: CSSProperties = {
  margin: 0,
  color: 'var(--brand-blue-2)',
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const queryTitleStyle: CSSProperties = {
  margin: '4px 0',
  color: 'var(--foreground-strong)',
  fontSize: '1.2rem',
  lineHeight: 1.2,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const queryTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.55,
  overflowWrap: 'anywhere',
}

const queryActionRowStyle: CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const queryActionStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 38,
  maxWidth: '100%',
  padding: '0 12px',
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-green) 28%, var(--shell-panel-border) 72%)',
  background: 'color-mix(in srgb, var(--brand-green) 12%, var(--shell-chip-bg) 88%)',
  color: 'var(--foreground-strong)',
  fontSize: 13,
  fontWeight: 900,
  textDecoration: 'none',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}
