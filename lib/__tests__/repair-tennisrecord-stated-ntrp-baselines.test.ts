import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const script = readFileSync(join(process.cwd(), 'scripts/repair-tennisrecord-stated-ntrp-baselines.mjs'), 'utf8')

describe('TennisRecord stated-NTRP baseline repair', () => {
  it('is dry by default and reserves verified status for computer-rated evidence', () => {
    expect(script).toContain("const APPLY = process.argv.includes('--apply')")
    expect(script).toContain("function statedNtrpDesignation(value)")
    expect(script).toContain("rating_source: evidence.designation === 'computer' ? 'verified' : 'self'")
    expect(script).toContain('if (!APPLY) {')
    expect(script).toContain("mode: 'dry-run'")
    expect(script).toContain("mode: 'apply'")
    expect(script).toContain('async function fetchStatedNtrpRows(service)')
    expect(script).toContain(".range(start, start + pageSize - 1)")
    expect(script).toContain("TennisRecord's dynamic estimate is")
  })
})
