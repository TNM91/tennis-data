import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/mylab/page.tsx'), 'utf8')
const checklist = readFileSync(join(process.cwd(), 'app/components/tennis-setup-checklist.tsx'), 'utf8')

describe('My Lab onboarding flow', () => {
  it('puts one player setup path ahead of normal tools for first-time users', () => {
    expect(source).toContain("const myLabTitle = isProfileConfirmed ? welcomeLine : 'My Lab.'")
    expect(source).toContain('{!isProfileConfirmed ? (')
    expect(source).toContain('<TennisSetupChecklist')
    expect(checklist).toContain('aria-label="Tennis setup"')
    expect(checklist).toContain('Connect your player.')
    expect(checklist).toContain('Find my player')
    expect(checklist).toContain("playerHref = '/profile#profile-identity'")
    expect(checklist).toContain('Upload a scorecard if your match history is missing.')
    expect(checklist).toContain('if (nextIndex === -1) return null')
    expect(source).not.toContain('Finish setup')
    expect(source).not.toContain('Set your player profile once.')
  })

  it('keeps onboarding behind help after the player is connected', () => {
    expect(source).toContain('{isProfileConfirmed && !showLockedMobileMyLabPreview ? (')
    expect(source).toContain('<strong>Need help?</strong>')
    expect(source).toContain('Review your player, goal, and first read.')
    expect(source).not.toContain('open={!isMobile}')
  })

  it('offers tennis-specific goal templates without exposing empty counters first', () => {
    for (const label of [
      'Win more singles',
      'Improve doubles',
      'Get ready for 4.0 / 4.5',
      'Prepare for playoffs',
      'Captain a team',
      'Find a coach',
      'Build a practice routine',
    ]) {
      expect(source).toContain(label)
    }

    expect(source).toContain('Choose your first goal before assignment counters matter')
    expect(source).not.toContain('0 assignments')
    expect(source).not.toContain('Loading your lab')
  })
})
