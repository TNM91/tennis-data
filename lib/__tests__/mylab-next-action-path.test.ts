import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/mylab/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const start = source.indexOf(`const ${styleName}`)
  expect(start, styleName).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('My Lab next action path', () => {
  it('makes the personal lab questions visible before deeper panels', () => {
    expect(source).toContain('PRODUCT_MOTTO')
    expect(source).toContain('Personal lab path')
    expect(source).toContain('My Lab next action path')
    expect(source).toContain('What should I work on?')
    expect(source).toContain('How am I improving?')
    expect(source).toContain('What matchup matters?')
    expect(source).toContain('What drills or resources can help?')
    expect(source).toContain("href: '/resources?q=drills%20skills%20strategy'")
    expect(source).toContain('data-my-lab-path-job={card.job}')
    expect(source).toContain('aria-label={`${card.cta}: ${card.question}`}')
  })

  it('connects Level Up proof back to the My Lab player ID', () => {
    expect(source).toContain('const playerIdProofSignals = [')
    expect(source).toContain("label: 'Player ID'")
    expect(source).toContain("label: 'Train first'")
    expect(source).toContain("label: 'Proof target'")
    expect(source).toContain("label: 'Match test'")
    expect(source).toContain('getPlayerDevelopmentIdentityActionRead')
    expect(source).toContain('My Lab player ID proof trail')
    expect(source).toContain('Set a profile so proof belongs to the right player.')
    expect(source).toContain('feeds the next court decision.')
    expect(source).toContain('Use this signal for My Lab progress, matchup prep, or coach follow-up.')
    expect(source).toContain('buildMyLabTacticsBoardHref')
    expect(source).toContain('const myLabTacticsBoardHref = buildMyLabTacticsBoardHref(')
    expect(source).toContain('href: myLabTacticsBoardHref')
    expect(source).toContain('Open the starter tactic board with this Player ID and Level Up card already attached.')
  })

  it('keeps the personal path compact and mobile-safe', () => {
    expect(source).toContain('personalLabPathGridStyle(isTablet)')
    expect(styleBlock('personalLabPathStyle')).toContain('minWidth: 0')
    expect(styleBlock('personalLabPathStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('personalLabPathGridStyle')).toContain("gridTemplateColumns: isTablet")
    expect(styleBlock('personalLabPathGridStyle')).toContain("'minmax(0, 1fr)'")
    expect(styleBlock('personalLabPathCardStyle')).toContain('minHeight: 166')
    expect(styleBlock('personalLabPathCardTextStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('myLabPlayerIdProofRailStyle')).toContain('minmax(min(100%, 170px), 1fr)')
    expect(styleBlock('myLabPlayerIdProofCardStyle')).toContain('minWidth: 0')
    expect(styleBlock('myLabPlayerIdProofValueStyle')).toContain("overflowWrap: 'anywhere'")
  })
})
