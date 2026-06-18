import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/resources/page.tsx'), 'utf8')

describe('Resources hub actions', () => {
  it('gives visitors a fast I-need-to chooser before the full hub', () => {
    expect(source).toContain('I need to...')
    expect(source).toContain('Get to the right tennis help fast.')
    expect(source).toContain('Pick the job in your head. TenAceIQ turns it into a practical resource path instead of another search spiral.')
    expect(source).toContain('resourceNeedPaths.map((path)')
    expect(source).toContain('Work on my game')
    expect(source).toContain('Prepare for a match')
    expect(source).toContain('Captain this week')
    expect(source).toContain('Support a player')
    expect(source).toContain('Run a league or tournament')
    expect(source).toContain('Fix missing or wrong data')
    expect(source).toContain("href: '/resources#player-development-modules'")
    expect(source).toContain("href: '/resources#match-prep'")
    expect(source).toContain("href: '/resources#captain-tools'")
    expect(source).toContain("href: '/resources#coach-tools'")
    expect(source).toContain("href: '/resources#league-tournament-tools'")
    expect(source).toContain("href: '/resources#fix-data'")
  })

  it('uses reusable resource cards instead of static directory cards', () => {
    expect(source).toContain('TiqActionCard')
    expect(source).toContain('Quick starts')
    expect(source).toContain('Start with the tennis job, then open the right path.')
    expect(source).toContain('resourceQuickStarts.map((quickStart)')
    expect(source).toContain("id: 'play'")
    expect(source).toContain("title: 'Play'")
    expect(source).toContain('Find the fastest path from wanting a match')
    expect(source).toContain('Drills')
    expect(source).toContain('Skills')
    expect(source).toContain('Strategy')
    expect(source).toContain('Fitness / movement')
    expect(source).toContain('Match prep')
    expect(source).toContain('Captain tools')
    expect(source).toContain('Coach tools')
    expect(source).toContain('League/tournament tools')
    expect(source).toContain('Track scores checklist')
    expect(source).toContain('Player development modules')
    expect(source).toContain('Find drills and skills')
    expect(source).toContain("job: 'find_drills_skills'")
    expect(source).toContain("cta: 'Find Drills'")
    expect(source).toContain('Captain match week')
    expect(source).toContain('Prep the next match')
    expect(source).toContain('Run an event')
    expect(source).toContain("href: '/leagues-and-tournaments'")
    expect(source).toContain("cta: 'Open Organizer Hub'")
    expect(source).toContain('Upload or report a source')
    expect(source).toContain('TiqResourceCard')
    expect(source).toContain('Resource path')
    expect(source).toContain('resourceGridStyle')
    expect(source).toContain("const resourceLinkStyle: CSSProperties")
    expect(source).toContain("minHeight: 40")
    expect(source).toContain("borderRadius: 8")
    expect(source).not.toContain('borderRadius: 22')
  })

  it('tracks resource clicks by tennis job and destination', () => {
    expect(source).toContain('TrackedProductLink')
    expect(source).toContain("location: 'resources_need_path'")
    expect(source).toContain("job: 'improve_player_game'")
    expect(source).toContain("job: 'prepare_match'")
    expect(source).toContain("job: 'captain_week'")
    expect(source).toContain("job: 'support_player'")
    expect(source).toContain("job: 'fix_tennis_context'")
    expect(source).toContain('resourceClickEvent(item, group.title)')
    expect(source).toContain("eventName = 'find_coach_clicked'")
    expect(source).toContain("eventName = 'team_search_submitted'")
    expect(source).toContain("eventName: 'captain_tools_clicked'")
    expect(source).toContain("job: 'organize_competition'")
    expect(source).toContain("eventName = 'league_search_submitted'")
    expect(source).toContain("'tournament_search_submitted'")
    expect(source).toContain("eventName = 'lineup_preview_clicked'")
    expect(source).toContain("'data_issue_reported'")
    expect(source).toContain("context: 'resources_hub'")
  })

  it('routes Fix Data resources to matching Data Assist intents', () => {
    expect(source).toContain("title=\"The tennis resource hub for less chaos.\"")
    expect(source).toContain("primary={{ href: '/player-development', label: 'Level Up My Game' }}")
    expect(source).toContain('tennis intelligence and action layer')
    expect(source).toContain('tennis context needs verification')
    expect(source).toContain("return '/data-assist?intent=report-issue&context=Resources%20hub'")
    expect(source).toContain("return '/data-assist?intent=request-review&context=Resources%20hub'")
    expect(source).toContain("return '/data-assist?intent=upload-source&context=Resources%20hub'")
    expect(source).toContain("lower.includes('court and club')")
    expect(source).toContain("lower.includes('track scores')")
    expect(source).toContain("return '/leagues-and-tournaments'")
    expect(source).toContain('context="Resources trust strip"')
    expect(source).not.toContain('workflow layer')
  })

  it('keeps the I-need-to chooser tappable and mobile-safe', () => {
    expect(source).toContain('const needPathStyle')
    expect(source).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))'")
    expect(source).toContain('const needPathGridStyle')
    expect(source).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))'")
    expect(source).toContain('const needPathCardStyle')
    expect(source).toContain('minHeight: 100')
    expect(source).toContain('const needPathQuestionStyle')
    expect(source).toContain("overflowWrap: 'anywhere'")
    expect(source).toContain('ariaLabel={`${path.question}: ${path.cta}`}')
  })

  it('uses q search params to prioritize matching resource paths', () => {
    expect(source).toContain('type ResourcesPageProps')
    expect(source).toContain('searchParams?: Promise<Record<string, string | string[] | undefined>>')
    expect(source).toContain('const resourceQuery = getSearchParamValue(resolvedSearchParams.q).trim().slice(0, 80)')
    expect(source).toContain('const resourceMatches = getResourceMatches(resourceQuery)')
    expect(source).toContain('Showing useful paths for &quot;{resourceQuery}&quot;.')
    expect(source).toContain('visibleGroups.map((group)')
    expect(source).toContain('function getResourceMatches(query: string)')
    expect(source).toContain("!['a', 'an', 'the', 'to', 'for', 'and', 'or'].includes(token)")
    expect(source).toContain('const isFocusedQuery = tokens.length > 1')
    expect(source).toContain('const allTokenMatch = tokens.length > 0 && tokens.every((token) => itemText.includes(token))')
    expect(source).toContain('const looseTokenMatch = !isFocusedQuery && tokens.some((token) => itemText.includes(token))')
    expect(source).toContain('const score = exactMatch ? 12 : allTokenMatch ? 8 : looseTokenMatch ? 2 : 0')
  })

  it('matches plain role questions from the platform story', () => {
    for (const phrase of [
      'what should I work on',
      'how am I improving',
      'who is available',
      'best lineup',
      'who should play together',
      'what should I communicate',
      'assign drills',
      'track player development',
      'support players between sessions',
      'organize schedules',
      'track scores',
      'reduce admin work',
      'run a league or tournament',
    ]) {
      expect(source).toContain(phrase)
    }

    expect(source).toContain("searchTerms: ['who is available'")
    expect(source).toContain("searchTerms: ['assign drills'")
    expect(source).toContain("searchTerms: ['organize schedules'")
    expect(source).toContain("group.searchTerms.join(' ')")
  })
})
