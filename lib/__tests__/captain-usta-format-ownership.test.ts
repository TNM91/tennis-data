import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { resolveTeamMatchFormat } from '@/lib/competition-format-registry'

const projectRoot = process.cwd()
const builderSource = readFileSync(
  join(projectRoot, 'app', 'captain', 'lineup-builder', 'page.tsx'),
  'utf8',
)

describe('captain USTA format ownership', () => {
  it('recognizes a USTA Tri-Level league from its connected league context', () => {
    expect(resolveTeamMatchFormat({
      leagueName: '2026 STL Tri-Level 18 & Over',
      flight: 'Men 3.5/4.0/4.5',
    }).id).toBe('tri_level')
  })

  it('does not let a saved TiQ league format override a USTA team', () => {
    expect(builderSource).toContain("const isTiqLeagueContext = competitionLayer === 'tiq'")
    expect(builderSource).toContain('const storedTiqMatchFormatId = isTiqLeagueContext')
    expect(builderSource).toContain('rulesOverride: isTiqLeagueContext')
  })
})
