import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function source(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

describe('captain tri-level first run', () => {
  const captainSource = source('app/captain/page.tsx')
  const dataAssistSource = source('app/data-assist/page.tsx')
  const playerProfileSource = source('app/players/[id]/page.tsx')
  const importEngineSource = source('lib/ingestion/importEngine.ts')

  it('keeps the league scoreboard first on desktop and puts the Captain command center first on phones', () => {
    expect(captainSource).toContain('currentLeagueStatsHref')
    expect(captainSource).toContain('Ultimate scoreboard')
    expect(captainSource).toContain('League scoreboard')
    expect(captainSource).toContain('Open league rankings')
    expect(captainSource).toContain('name="captainDashboard"')
    expect(captainSource).toContain('name="teamRankings"')
    expect(captainSource.indexOf('{isMobile ? captainMobileCommandCenter : null}')).toBeLessThan(captainSource.indexOf('aria-label="League rankings"'))
    expect(captainSource.indexOf('aria-label="League rankings"')).toBeLessThan(captainSource.indexOf('{!isMobile ? captainMobileCommandCenter : null}'))
    expect(captainSource).not.toContain('watermarkStyle')
  })

  it('turns scorecard review into an explicit, exact-upload action', () => {
    expect(dataAssistSource).toContain('need your confirmation')
    expect(dataAssistSource).toContain('League stats update only after confirmation.')
    expect(dataAssistSource).toContain('Review scorecards now')
    expect(dataAssistSource).toContain('Review now')
    expect(dataAssistSource).toContain('data-assist-submission-${submission.id}')
    expect(dataAssistSource).toContain("focusedSubmissionId ? 'needs_review' : 'all'")
  })

  it('keeps review cards compact and gives player profiles a dominant first-glance scorecard', () => {
    expect(dataAssistSource).toContain("alignItems: 'start'")
    expect(dataAssistSource).toContain("alignSelf: 'start'")
    expect(playerProfileSource).toContain('playerHeroIdentityStyle')
    expect(playerProfileSource).toContain('playerHeroScoreboardStyle')
    expect(playerProfileSource).toContain('playerPrimaryRatingValueStyle')
    expect(playerProfileSource).toContain('playerPrimaryActionStyle')
    expect(playerProfileSource).toContain('useSplitProfileHero')
    expect(playerProfileSource).toContain("gridTemplateColumns: 'minmax(0, 1fr)'")
    expect(playerProfileSource).toContain('Turn this rating into action.')
  })

  it('does not preserve a flattened scorecard export as the league identity', () => {
    expect(importEngineSource).toContain('normalizeScorecardLeagueName(existingMatch.league_name)')
    expect(importEngineSource).toContain('extractScorecardLeagueName')
  })
})
