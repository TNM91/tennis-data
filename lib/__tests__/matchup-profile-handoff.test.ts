import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/matchup/page.tsx'), 'utf8')

describe('Matchup profile handoff', () => {
  it('confirms the linked player and selected opponent in the matchup read', () => {
    expect(source).toContain('aria-label="Personal matchup handoff"')
    expect(source).toContain('Your matchup')
    expect(source).toContain('{profilePlayer.name} vs {playerB.name}')
    expect(source).toContain('Your Player ID is locked into this read.')
  })
})
