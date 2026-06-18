import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/compete/leagues/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const pattern = new RegExp(`const ${styleName}(?:: CSSProperties)? = ([\\s\\S]*?)(?=\\nconst |\\nfunction |\\nexport |$)`)
  const match = source.match(pattern)
  if (!match) throw new Error(`Missing style block: ${styleName}`)
  return match[0]
}

describe('compete leagues readiness', () => {
  it('gives Leagues visitors a clear first-action path', () => {
    expect(source).toContain("import { DATA_ASSIST_STORY, LEAGUE_COORDINATOR_STORY, MY_LAB_STORY, PRODUCT_MOTTO } from '@/lib/product-story'")
    expect(source).toContain('const leaguePathActions')
    expect(source).toContain('function LeaguePathPanel')
    expect(source).toContain('League path')
    expect(source).toContain('id="compete-league-path-title"')
    expect(source).toContain('Start with the league job, then open the smallest action that keeps seasons, teams, and results organized.')
    expect(source).toContain('How do I run the season?')
    expect(source).toContain('Open League Office')
    expect(source).toContain('Which league am I looking for?')
    expect(source).toContain('Browse leagues')
    expect(source).toContain('How do I refresh schedules or scorecards?')
    expect(source).toContain('Upload league data')
    expect(source).toContain('What does this mean for my team?')
    expect(source).toContain('Open Team week')
    expect(source).toContain('data-compete-league-path-job={action.job}')
    expect(source).toContain('Open the path that matches the tennis job.')
    expect(source).not.toContain('Open the workspace that matches the job.')
  })

  it('keeps League path cards tappable on mobile', () => {
    expect(styleBlock('leaguePathStyle')).toContain('minWidth: 0')
    expect(styleBlock('leaguePathStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('leaguePathHeaderStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('leaguePathGridStyle')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))'")
    expect(styleBlock('leaguePathCardStyle')).toContain('minHeight: 148')
    expect(styleBlock('leaguePathCardStyle')).toContain("overflowWrap: 'anywhere'")
  })

  it('shows league readiness and keeps rows focused on one primary action', () => {
    expect(source).toContain('leagueReadinessItems')
    expect(source).toContain("label: 'Teams'")
    expect(source).toContain("label: 'Schedule'")
    expect(source).toContain("label: 'Season'")
    expect(source).toContain("label: 'Players'")
    expect(source).toContain("label: 'Results'")
    expect(source).toContain("label: 'Prompts'")
    expect(source).toContain('leagueReadinessGridStyle')
    expect(source).toContain('leaguePrimaryActionStyle')
    expect(source).toContain('Record results')
    expect(source).toContain('Log result')
    expect(source).toContain('Open league')
    expect(source).not.toContain("const secondaryActionLabel")
    expect(source).not.toContain("const secondaryActionHref")
  })

  it('keeps empty league sections actionable without duplicating row actions', () => {
    expect(source).toContain('function EmptyLeagueSection')
    expect(source).toContain('Team seasons start in League Office.')
    expect(source).toContain('Individual play starts with a league room.')
    expect(source).toContain('Create league')
    expect(source).toContain('Browse leagues')
    expect(source).not.toContain('No leagues in this format yet. Create one from League Coordinator.')
    expect(source).toContain('emptyLeagueActionRowStyle')
    expect(source).toContain('emptyLeagueActionStyle')
  })
})
