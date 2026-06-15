import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/components/universal-search.tsx'), 'utf8')

describe('universal search result model', () => {
  it('keeps the public platform result groups available', () => {
    for (const group of [
      "'Players'",
      "'Teams'",
      "'Leagues'",
      "'Tournaments'",
      "'Coaches'",
      "'Courts / clubs'",
      "'Resources'",
      "'Actions'",
    ]) {
      expect(source).toContain(group)
    }
  })

  it('covers the high-intent action results from the public site brief', () => {
    for (const phrase of [
      'Upload a scorecard',
      'Compare two players',
      'Build a lineup',
      'Create a tournament',
      'Create a league',
      'Find a coach',
      'Open My Lab',
      'Open Data Assist',
      'Report a data issue',
      'Request data review',
      'Prep a matchup',
      'Scout a team',
      'Find a place to play',
      'Captain match week',
    ]) {
      expect(source).toContain(phrase)
    }
  })

  it('recognizes natural tennis search intents', () => {
    for (const keyword of [
      '4.0 league near me',
      'doubles partner',
      'scorecard upload',
      'captain lineup',
      'serve practice',
      'prepare for a match',
      'scout team',
      'rating level',
      'request review',
      'play tennis near me',
      'captain match week',
    ]) {
      expect(source).toContain(keyword)
    }
  })

  it('preserves typed queries when users click a result card', () => {
    expect(source).toContain('function buildResultHref')
    expect(source).toContain('function appendSearchQuery')
    expect(source).toContain('href={buildResultHref(item, query, Boolean(session?.user))}')
    expect(source).toContain('buildResultHref(first, q, Boolean(session?.user))')
    expect(source).toContain('const destinationHref = appendSearchQuery(item.href, q)')
    expect(source).toContain("href.split('#')")
    expect(source).toContain('encodeURIComponent(q)')
    expect(source).toContain("hash ? `#${hash}` : ''")
    expect(source).not.toContain('`${first.href}?q=${encodeURIComponent(q)}`')
  })

  it('routes Data Assist action results with upload intent and search context', () => {
    expect(source).toContain("href: '/data-assist?intent=upload-source&context=Universal%20search'")
    expect(source).toContain("keywords: ['open data assist', 'data assist', 'fix data', 'upload source']")
    expect(source).toContain("keywords: ['scorecard upload', 'fix data', 'upload scorecard', 'data assist']")
  })

  it('routes Data Assist issue and review actions to matching intents', () => {
    expect(source).toContain("href: '/data-assist?intent=report-issue&context=Universal%20search'")
    expect(source).toContain("href: '/data-assist?intent=request-review&context=Universal%20search'")
    expect(source).toContain("keywords: ['report issue', 'wrong player', 'wrong team', 'wrong score', 'wrong rating', 'wrong draw', 'wrong standing', 'data issue']")
    expect(source).toContain("keywords: ['request review', 'request data review', 'data review', 'review source', 'missing data', 'refresh data']")
  })

  it('routes private action results through upgrade intent', () => {
    expect(source).toContain("requiredPlan: 'captain'")
    expect(source).toContain("requiredPlan: 'player_plus'")
    expect(source).toContain("href: '/league-coordinator/tournaments'")
    expect(source).toContain("requiredPlan: 'full_court'")
    expect(source).toContain("href: '/league-coordinator'")
    expect(source).toContain("requiredPlan: 'league'")
    expect(source).toContain('getPlanUnlockHref(item.requiredPlan, destinationHref)')
    expect(source).not.toContain('getPlanSignupHref')
  })

  it('can keep compact header search from flooding mobile navigation', () => {
    expect(source).toContain('showResults = true')
    expect(source).toContain('showResults?: boolean')
    expect(source).toContain('showResults && !compact')
    expect(source).toContain('{showResults ? (')
  })
})
