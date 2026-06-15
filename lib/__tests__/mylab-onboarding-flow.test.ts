import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/mylab/page.tsx'), 'utf8')

describe('My Lab onboarding flow', () => {
  it('guides first-time users through identity, goal, and first read', () => {
    expect(source).toContain('First My Lab read')
    expect(source).toContain('Find yourself, choose one focus, open the next useful card.')
    expect(source).toContain('Search for your player record or create a self-rated profile.')
    expect(source).toContain('Open your first read')
    expect(source).toContain('My Lab works best when setup feels like a tennis next step: connect your player record, name the focus, then act.')
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
