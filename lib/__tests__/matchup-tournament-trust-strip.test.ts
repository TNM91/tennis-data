import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('matchup and tournament trust strips', () => {
  it('adds compact trust signals to the public Matchup demo hook', () => {
    const source = read('app/matchup/page.tsx')

    expect(source).toContain("import TiqTrustStrip from '@/app/components/tiq-trust-strip'")
    expect(source).toContain('Sample matchup data trust signals')
    expect(source).toContain("value: 'TIQ demo'")
    expect(source).toContain("value: 'Preview'")
    expect(source).toContain("value: 'Medium'")
    expect(source).toContain('reviewContext="Matchup demo"')
  })

  it('adds compact trust signals and Data Assist review actions to tournament public detail pages', () => {
    const source = read('app/tournaments/[id]/page.tsx')

    expect(source).toContain("import TiqTrustStrip from '@/app/components/tiq-trust-strip'")
    expect(source).toContain('compact data trust signals')
    expect(source).toContain("source === 'cloud' ? 'Tournament Desk' : 'Device preview'")
    expect(source).toContain("summary?.completedMatches ? 'Results reviewed' : 'Limited until scores'")
    expect(source).toContain('reviewContext={`Tournament ${record.name}`}')
  })
})
