import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/players/[id]/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const start = source.indexOf(`const ${styleName}`)
  expect(start, `Missing ${styleName}`).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('player profile player path', () => {
  it('turns the scorecard rail into clear player next actions', () => {
    expect(source).toContain('playerPathActions')
    expect(source).toContain('Player path')
    expect(source).toContain('Find the next useful move.')
    expect(source).toContain('{PRODUCT_MOTTO}')
    expect(source).toContain('What should I work on?')
    expect(source).toContain('Level Up My Game')
    expect(source).toContain('How am I improving?')
    expect(source).toContain('Open My Lab')
    expect(source).toContain('What matchup matters next?')
    expect(source).toContain('Find a Matchup')
    expect(source).toContain('What drills or resources can help?')
    expect(source).toContain('Find Drills')
    expect(source).toContain("href: '/level-up'")
    expect(source).toContain("href: '/mylab'")
    expect(source).toContain("href: '/resources?q=drills%20skills%20strategy'")
    expect(source).toContain('data-player-path-job={action.job}')
    expect(source).toContain('aria-label={`${action.label}: ${action.question}`}')
  })

  it('keeps player path rows mobile-safe in the dark shell', () => {
    expect(styleBlock('playerPathListStyle')).toContain('minWidth: 0')

    for (const styleName of [
      'playerPathActionStyle',
      'playerPathQuestionStyle',
      'playerPathLabelStyle',
      'playerPathBodyStyle',
    ]) {
      expect(styleBlock(styleName)).toContain("overflowWrap: 'anywhere'")
    }
  })
})
