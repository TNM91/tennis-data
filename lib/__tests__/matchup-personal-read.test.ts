import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/matchup/page.tsx'), 'utf8')

describe('Matchup personal Player read', () => {
  it('only calls the prep personal when the linked player is on the active matchup', () => {
    expect(source).toContain('const isPersonalMatchup = Boolean(')
    expect(source).toContain("'Player-only read - Your Player view'")
    expect(source).toContain("'Player-only read - Player scouting'")
    expect(source).toContain("const playerMatchPrepTitle = isPersonalMatchup ? 'Your Match Prep' : 'Match Prep'")
  })
})
