import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/rankings/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const match = source.match(new RegExp(`const ${styleName}: CSSProperties = \\{[\\s\\S]*?\\n\\}`))
  expect(match, `${styleName} style block`).not.toBeNull()
  return match![0]
}

describe('rankings next actions', () => {
  it('turns the rankings board into practical tennis next steps', () => {
    expect(source).toContain('RankingNextActionRail')
    expect(source).toContain('Ranking next actions')
    expect(source).toContain('Use rankings to decide what to check next.')
    expect(source).toContain('Compare')
    expect(source).toContain('Find the player record')
    expect(source).toContain('Check league context')
    expect(source).toContain('Fix ranking data')
    expect(source).toContain('DATA_ASSIST_STORY.href')
  })

  it('connects rankings to the Player ID trail', () => {
    expect(source).toContain('Ranking Player ID trail')
    expect(source).toContain('playerIdSignals')
    expect(source).toContain('Ranking signal')
    expect(source).toContain('Compare next')
    expect(source).toContain('Train or fix')
    expect(source).toContain('My Lab / Data Assist')
    expect(source).toContain('Open the player record before turning a rank, rating gap, or momentum signal into a tennis decision.')
    expect(source).toContain('Use Matchup to translate the board into edge, confidence, and a watch item.')
    expect(source).toContain('Save the takeaway to your tennis work, or route missing scorecards and profile context through review.')
  })

  it('keeps the ranking Player ID trail compact and mobile-safe', () => {
    expect(styleBlock('rankingPlayerIdTrailStyle')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))'")
    expect(styleBlock('rankingPlayerIdTrailStyle')).toContain('minWidth: 0')
    expect(styleBlock('rankingPlayerIdTrailStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('rankingPlayerIdSignalStyle')).toContain('minWidth: 0')
    expect(styleBlock('rankingPlayerIdSignalStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('rankingPlayerIdSignalTextStyle')).toContain("overflowWrap: 'anywhere'")
  })
})
