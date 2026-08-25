import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'lib/tennisrecord/service.ts'), 'utf8')

describe('TennisRecord checkpoint stability', () => {
  it('keeps scheduled checkpoints small and defers full rating recalculation', () => {
    expect(source).toContain('const BOOTSTRAP_TENNISRECORD_BATCH_LIMIT = 3')
    expect(source).toContain('const WEEKLY_TENNISRECORD_BATCH_LIMIT = 3')
    expect(source).toContain('const SCHEDULED_TENNISRECORD_REPLAY_BATCH_LIMIT = 1')
    expect(source).toContain('recalculateRatings: false')
    expect(source).toContain('shouldRecalculateRatings && ratingChanged')
  })

  it('keeps manual reconciliation on the existing TiQ rating path by default', () => {
    expect(source).toContain('const shouldRecalculateRatings = input.recalculateRatings !== false')
    expect(source).toContain('async function reconcileTennisRecordMatches(service: SupabaseClient, sourceMatchKeys: string[], shouldRecalculateRatings = true)')
  })
})
