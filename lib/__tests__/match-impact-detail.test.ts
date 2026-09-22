import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/players/[id]/page.tsx'), 'utf8')

describe('match impact detail', () => {
  it('opens a concise match-impact read from mobile and desktop history', () => {
    expect(source).toContain('View match impact')
    expect(source).toContain('>Impact</button>')
    expect(source).toContain('<MatchImpactPanel')
  })

  it('uses stored match snapshots and protects detailed opponent context', () => {
    expect(source).toContain('TiQ before')
    expect(source).toContain('TiQ after')
    expect(source).toContain('Expected win chance')
    expect(source).toContain('Unlock opponent context and expected-score detail with Player')
  })
})
