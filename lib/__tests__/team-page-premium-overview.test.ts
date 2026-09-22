import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/teams/[team]/page.tsx'), 'utf8')

describe('premium team profile overview', () => {
  it('keeps the public overview tied to real team performance data', () => {
    expect(source).toContain('const winRate = completedMatchCount > 0')
    expect(source).toContain('label="Win rate"')
    expect(source).toContain('summarySplitLabelStyle')
    expect(source).toContain('View full match history')
  })

  it('shows one featured latest result rather than a second match list', () => {
    expect(source).toContain('const latestResult = latestCompletedMatch')
    expect(source).toContain('Latest result · {formatCompactDate(latestResult.match_date)}')
    expect(source).toContain('featuredTeamResultStyle')
  })

  it('keeps Captain planning as a role-aware follow-on to free public discovery', () => {
    expect(source).toContain("import { CAPTAIN_STORY, DATA_ASSIST_STORY } from '@/lib/product-story'")
    expect(source).toContain('!canManageThisTeam')
    expect(source).toContain('CAPTAIN_STORY.quickStartKicker')
    expect(source).toContain('captainAccessTeaseStyle')
  })
})
