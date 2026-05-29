import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/components/universal-search.tsx'), 'utf8')

describe('universal search intent events', () => {
  it('routes high-intent tennis searches to product-specific events', () => {
    expect(source).toContain('getSearchIntentEvent')
    expect(source).toContain("[query.trim(), item.title, item.detail].join(' ')")
    expect(source).toContain("eventName: 'team_search_submitted'")
    expect(source).toContain("q.includes('scout team')")
    expect(source).toContain("eventName: 'league_search_submitted'")
    expect(source).toContain("eventName: 'tournament_search_submitted'")
    expect(source).toContain("eventName: 'find_coach_clicked'")
    expect(source).toContain("eventName: 'data_assist_opened'")
    expect(source).toContain("eventName: 'data_issue_reported'")
    expect(source).toContain("q.includes('data assist')")
    expect(source).toContain("q.includes('report issue')")
    expect(source).toContain("q.includes('wrong player')")
    expect(source).toContain("q.includes('request review')")
    expect(source).toContain("eventName: 'lineup_preview_clicked'")
    expect(source).toContain("eventName: 'availability_clicked'")
    expect(source).toContain("eventName: 'matchup_started'")
    expect(source).toContain("q.includes('match prep')")
    expect(source).toContain("q.includes('prepare for a match')")
  })

  it('keeps generic searches and zero-result searches on the search surface', () => {
    expect(source).toContain("return { eventName: 'search_submitted', surface: 'search' }")
    expect(source).toContain("eventName: visibleResults.length ? searchEvent.eventName : 'zero_result_seen'")
    expect(source).toContain("surface: visibleResults.length ? searchEvent.surface : 'search'")
    expect(source).toContain('function broadenZeroResultSearch')
    expect(source).toContain("eventName: 'zero_result_seen'")
    expect(source).toContain("recovery: 'all_categories'")
  })

  it('checks data issue searches before generic Data Assist searches', () => {
    const issueIndex = source.indexOf("q.includes('report issue')")
    const genericIndex = source.indexOf("q.includes('data assist') || q.includes('scorecard')")

    expect(issueIndex).toBeGreaterThan(-1)
    expect(genericIndex).toBeGreaterThan(-1)
    expect(issueIndex).toBeLessThan(genericIndex)
  })
})
