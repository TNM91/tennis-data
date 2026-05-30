import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/resources/page.tsx'), 'utf8')

describe('Resources hub actions', () => {
  it('uses reusable resource cards instead of static directory cards', () => {
    expect(source).toContain('TiqActionCard')
    expect(source).toContain('Quick starts')
    expect(source).toContain('Start with the tennis job, then open the right path.')
    expect(source).toContain('resourceQuickStarts.map((quickStart)')
    expect(source).toContain('Find a place to play')
    expect(source).toContain('Find coaching support')
    expect(source).toContain('Captain match week')
    expect(source).toContain('Prep the next match')
    expect(source).toContain('Run an event')
    expect(source).toContain('Upload or report a source')
    expect(source).toContain('TiqResourceCard')
    expect(source).toContain('Resource path')
    expect(source).toContain('resourceGridStyle')
    expect(source).not.toContain('borderRadius: 22')
  })

  it('tracks resource clicks by tennis job and destination', () => {
    expect(source).toContain('TrackedProductLink')
    expect(source).toContain('resourceClickEvent(item, group.title)')
    expect(source).toContain("eventName = 'find_coach_clicked'")
    expect(source).toContain("eventName = 'team_search_submitted'")
    expect(source).toContain("eventName: 'captain_tools_clicked'")
    expect(source).toContain("eventName = 'league_search_submitted'")
    expect(source).toContain("'tournament_search_submitted'")
    expect(source).toContain("eventName = 'lineup_preview_clicked'")
    expect(source).toContain("'data_issue_reported'")
    expect(source).toContain("context: 'resources_hub'")
  })

  it('routes Fix Data resources to matching Data Assist intents', () => {
    expect(source).toContain("primary={{ href: '/data-assist?intent=upload-source&context=Resources%20hub', label: 'Open Data Assist' }}")
    expect(source).toContain("return '/data-assist?intent=report-issue&context=Resources%20hub'")
    expect(source).toContain("return '/data-assist?intent=request-review&context=Resources%20hub'")
    expect(source).toContain("return '/data-assist?intent=upload-source&context=Resources%20hub'")
    expect(source).toContain('context="Resources trust strip"')
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
})
