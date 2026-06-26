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
    expect(source).toContain('playerPathIdentitySignals')
    expect(source).toContain('Player path')
    expect(source).toContain('Find the next useful move.')
    expect(source).toContain('{PRODUCT_MOTTO}')
    expect(source).toContain('Use this player ID to decide what to work on')
    expect(source).toContain('Player ID')
    expect(source).toContain('Level Up input')
    expect(source).toContain('First read')
    expect(source).toContain('Player ID first read')
    expect(source).toContain('Train first')
    expect(source).toContain('Proof target')
    expect(source).toContain('Match test')
    expect(source).toContain('Player profile Player ID handoff')
    expect(source).toContain('Profile ID handoff')
    expect(source).toContain('Log proof')
    expect(source).toContain('Save in My Lab')
    expect(source).toContain('Message coach')
    expect(source).toContain('What should I work on?')
    expect(source).toContain('Level Up My Game')
    expect(source).toContain('How am I improving?')
    expect(source).toContain('Open My Lab')
    expect(source).toContain('What matchup matters next?')
    expect(source).toContain('Find a Matchup')
    expect(source).toContain('What drills or resources can help?')
    expect(source).toContain('Find Drills')
    expect(source).toContain('How do I level up faster?')
    expect(source).toContain('Open Level Up')
    expect(source).toContain('playerPathIdentityRead.levelUpNudge')
    expect(source).toContain('playerPathLevelUpHref')
    expect(source).toContain('playerPathDevelopmentHref')
    expect(source).toContain("href: '/mylab'")
    expect(source).toContain("href: '/resources?q=drills%20skills%20strategy'")
    expect(source).toContain('data-player-path-job={action.job}')
    expect(source).toContain('aria-label={`${action.label}: ${action.question}`}')
  })

  it('keeps player path rows mobile-safe in the dark shell', () => {
    expect(styleBlock('playerPathListStyle')).toContain('minWidth: 0')
    expect(styleBlock('playerPathIdentityGridStyle')).toContain('minmax(min(100%, 128px), 1fr)')
    expect(styleBlock('playerPathIdentityChipStyle')).toContain('minWidth: 0')
    expect(styleBlock('playerPathIdentityChipStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('playerPathReadGridStyle')).toContain('minmax(min(100%, 132px), 1fr)')
    expect(styleBlock('playerPathReadStyle')).toContain('minWidth: 0')
    expect(styleBlock('playerPathReadItemStyle')).toContain('minWidth: 0')
    expect(styleBlock('playerPathReadItemStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('playerPathHandoffGridStyle')).toContain('minmax(min(100%, 118px), 1fr)')
    expect(styleBlock('playerPathHandoffActionsStyle')).toContain('minmax(min(100%, 112px), 1fr)')
    expect(styleBlock('playerPathHandoffStyle')).toContain('minWidth: 0')
    expect(styleBlock('playerPathHandoffItemStyle')).toContain('minWidth: 0')
    expect(styleBlock('playerPathHandoffItemStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('playerPathHandoffActionStyle')).toContain("whiteSpace: 'normal'")
    expect(styleBlock('playerPathHandoffActionStyle')).toContain("overflowWrap: 'anywhere'")

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
