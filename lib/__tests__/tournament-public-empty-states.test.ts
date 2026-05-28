import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('public tournament empty states', () => {
  it('shows readiness and useful actions before the draw is published', () => {
    const source = readFileSync(join(process.cwd(), 'app/tournaments/[id]/page.tsx'), 'utf8')

    expect(source).toContain('publicReadinessItems')
    expect(source).toContain('Tournament readiness')
    expect(source).toContain('publicReadinessStyle')
    expect(source).toContain('publicEmptyStateStyle')
    expect(source).toContain('The draw will land here.')
    expect(source).toContain('matchDayActions')
    expect(source).toContain('After finish')
  })
})
