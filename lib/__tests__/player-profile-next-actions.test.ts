import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/players/[id]/page.tsx'), 'utf8')

describe('player profile next actions', () => {
  it('ties player profile actions back to More Tennis. Less Chaos.', () => {
    expect(source).toContain("import { DATA_ASSIST_STORY, PRODUCT_MOTTO } from '@/lib/product-story'")
    expect(source).toContain('Find the next useful move.')
    expect(source).toContain('{PRODUCT_MOTTO}{\' \'}')
    expect(source).toContain('Use this player ID to decide what to work on')
    expect(source).toContain('what drill or resource should come next')
  })

  it('answers player questions with practical CTAs', () => {
    expect(source).toContain("question: 'What should I work on?'")
    expect(source).toContain("label: 'Level Up My Game'")
    expect(source).toContain('Train first: ${playerPathIdentityRead.trainingPriority}')
    expect(source).toContain("question: 'How am I improving?'")
    expect(source).toContain("label: 'Open My Lab'")
    expect(source).toContain('Proof target: ${playerPathIdentityRead.proofTarget}')
    expect(source).toContain("question: 'What matchup matters next?'")
    expect(source).toContain("question: 'What drills or resources can help?'")
    expect(source).toContain("href: '/resources?q=drills%20skills%20strategy'")
    expect(source).toContain("question: 'How do I level up faster?'")
    expect(source).toContain("label: 'Open Level Up'")
    expect(source).toContain('body: playerPathIdentityRead.levelUpNudge')
    expect(source).toContain('href: playerPathLevelUpHref')
  })

  it('surfaces player ID signals before the action list', () => {
    expect(source).toContain('const playerPathIdentitySignals = [')
    expect(source).toContain("label: 'Player ID'")
    expect(source).toContain("value: playerId")
    expect(source).toContain("label: 'Profile source'")
    expect(source).toContain("label: 'Level Up input'")
    expect(source).toContain("label: 'First read'")
    expect(source).toContain('aria-label="Player identity signals"')
    expect(source.indexOf('aria-label="Player identity signals"')).toBeLessThan(source.indexOf('aria-label="Player path actions"'))
  })

  it('reuses the Level Up identity read for profile next actions', () => {
    expect(source).toContain("import { getPlayerDevelopmentIdentity, getPlayerDevelopmentIdentityActionRead } from '@/lib/player-development'")
    expect(source).toContain('const playerPathIdentitySlug = useMemo(() => {')
    expect(source).toContain("return 'doubles-commander-4-0'")
    expect(source).toContain("return 'pressure-closer-4-0'")
    expect(source).toContain("return 'smart-attacker-4-0-to-4-5'")
    expect(source).toContain("return 'singles-point-builder-4-0'")
    expect(source).toContain("return 'relentless-competitor-4-0'")
    expect(source).toContain('const playerPathLevelUpHref = `/level-up/${playerPathIdentity.slug}`')
    expect(source).toContain('const playerPathDevelopmentHref = `/player-development/${playerPathIdentity.slug}`')
    expect(source).toContain('aria-label={`Open ${playerPathIdentityRead.label} development read`}')
  })

  it('adds job hooks without changing the existing link surface', () => {
    expect(source).toContain("job: 'level_up_game'")
    expect(source).toContain("job: 'track_progress'")
    expect(source).toContain("job: 'prep_matchup'")
    expect(source).toContain("job: 'find_training_resources'")
    expect(source).toContain("job: 'level_up_faster'")
    expect(source).toContain('data-player-path-job={action.job}')
    expect(source).toContain('aria-label={`${action.label}: ${action.question}`}')
  })
})
