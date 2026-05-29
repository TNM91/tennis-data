import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/explore/matchups/page.tsx'), 'utf8')

describe('explore matchups redirect', () => {
  it('sends legacy Explore matchup traffic to the public Matchup hook', () => {
    expect(source).toContain("redirect('/matchup')")
    expect(source).not.toContain("redirect('/mylab')")
  })
})
