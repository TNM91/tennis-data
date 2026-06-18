import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/compete/results/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const pattern = new RegExp(`const ${styleName}(?:: CSSProperties)? = ([\\s\\S]*?)(?=\\nconst |\\nfunction |\\nexport |$)`)
  const match = source.match(pattern)
  if (!match) throw new Error(`Missing style block: ${styleName}`)
  return match[0]
}

describe('compete results follow-through', () => {
  it('gives Results visitors a clear first-action path', () => {
    expect(source).toContain("import { DATA_ASSIST_STORY, PRODUCT_MOTTO } from '@/lib/product-story'")
    expect(source).toContain('const resultsPathActions')
    expect(source).toContain('function ResultsPathPanel')
    expect(source).toContain('Results path')
    expect(source).toContain('id="compete-results-path-title"')
    expect(source).toContain('Start with the result job, then open the smallest action that keeps prep, standings, or data moving.')
    expect(source).toContain('What happened?')
    expect(source).toContain('View recent results')
    expect(source).toContain('Who won the player match?')
    expect(source).toContain('Log a player result')
    expect(source).toContain('Which team match finished?')
    expect(source).toContain('Record a team match')
    expect(source).toContain('How do I avoid retyping?')
    expect(source).toContain('Upload a scorecard')
    expect(source).toContain('data-compete-results-path-job={action.job}')
    expect(source).toContain('href: \'#tiq-results-activity\'')
    expect(source).toContain('id="tiq-results-activity"')
  })

  it('keeps Results path cards tappable on mobile', () => {
    expect(styleBlock('resultsPathStyle')).toContain('minWidth: 0')
    expect(styleBlock('resultsPathStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('resultsPathHeaderStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('resultsPathGridStyle')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))'")
    expect(styleBlock('resultsPathCardStyle')).toContain('minHeight: 148')
    expect(styleBlock('resultsPathCardStyle')).toContain("overflowWrap: 'anywhere'")
  })

  it('keeps the Results top actions aligned with the League portal dock', () => {
    expect(source).toContain('title="Team book"')
    expect(source).toContain('title="Player book"')
    expect(source).toContain('title="Rankings"')
    expect(source).toContain('title="Improve results data"')
    expect(source).toContain('href="/league-coordinator/results"')
    expect(source).toContain('href="/league-coordinator/individual-results"')
    expect(source).not.toContain('title="My Lab"')
    expect(source).not.toContain('title="Player Profiles"')
    expect(source).not.toContain('title="Upload Scorecards"')
  })

  it('shows result readiness and one next action before secondary actions', () => {
    expect(source).toContain('resultFollowThroughItems')
    expect(source).toContain("label: 'Score'")
    expect(source).toContain("label: 'Profiles'")
    expect(source).toContain("label: 'Date'")
    expect(source).toContain('Compare rematch')
    expect(source).toContain('Create profiles')
    expect(source).toContain("value: profilesReady ? 'Ready' : 'Needed'")
    expect(source).toContain('resultFollowThroughGridStyle')
    expect(source).toContain('resultNextActionStyle')
    expect(source).toContain('Profiles are connected. Rerun the matchup before the next round.')
    expect(source).toContain('Create both player profiles so this result can feed TIQ history and awards.')
  })

  it('keeps the empty Results state actionable and mobile-safe', () => {
    expect(source).toContain('function EmptyResultsState')
    expect(source).toContain('Results start with one finished match.')
    expect(source).toContain('Log player result')
    expect(source).toContain('Open team book')
    expect(source).toContain('Fix tennis info')
    expect(source).not.toContain('No TIQ individual results have been logged yet.')
    expect(styleBlock('emptyResultsStyle')).toContain('minWidth: 0')
    expect(styleBlock('emptyResultsCopyStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('emptyResultsActionRowStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('emptyResultsActionStyle')).toContain("maxWidth: '100%'")
    expect(styleBlock('emptyResultsActionStyle')).toContain("whiteSpace: 'normal'")
  })
})
