import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/players/[id]/page.tsx'), 'utf8')

describe('Player profile premium action', () => {
  it('explains personalized Player tools while ratings remain free', () => {
    expect(source).toContain('Player member view')
    expect(source).toContain('My Lab and personalized analysis')
    expect(source).toContain('Track your goals, follow players and teams, and prepare for your next match in My Lab.')
    expect(source).toContain('Follow this player and use matchup insight and personalized analysis before you play.')
    expect(source).toContain('Unlock Player')
  })
})
