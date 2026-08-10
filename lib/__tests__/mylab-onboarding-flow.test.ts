import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/mylab/page.tsx'), 'utf8')

describe('My Lab onboarding flow', () => {
  it('guides first-time users through identity, focus, and a first rep', () => {
    expect(source).toContain("title: 'Connect your player'")
    expect(source).toContain("title: 'Choose one focus'")
    expect(source).toContain("title: 'Finish your first rep'")
    expect(source).toContain('Find your record or create a self-rated profile.')
    expect(source).toContain('Take one short court card and leave proof behind.')
    expect(source).toContain('isProfileConfirmed && hasMyLabFocus && latestLevelUpProof')
    expect(source).toContain('open={!hasMyLabFocus}')
  })

  it('offers tennis-specific goal templates without exposing empty counters first', () => {
    for (const label of [
      'Next match plan',
      'Clean up losses',
      'Two-week focus',
    ]) {
      expect(source).toContain(label)
    }

    expect(source).toContain('Choose your first goal before assignment counters matter')
    expect(source).not.toContain('0 assignments')
    expect(source).not.toContain('Loading your lab')
  })
})
