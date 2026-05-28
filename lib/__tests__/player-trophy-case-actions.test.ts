import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('player trophy case actions', () => {
  it('links honors to certificates and source events or leagues', () => {
    const source = readFileSync(join(process.cwd(), 'app/players/[id]/page.tsx'), 'utf8')

    expect(source).toContain('id="profile-trophy-case"')
    expect(source).toContain('trophyActionRowStyle')
    expect(source).toContain('Certificate')
    expect(source).toContain('/awards/')
    expect(source).toContain('/tournaments/')
    expect(source).toContain('/explore/leagues/tiq/')
    expect(source).toContain('league_id=')
  })
})
