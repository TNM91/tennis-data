import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isTennisRecordRatingBatchDue } from '../tennisrecord/service'

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

  it('defers scheduled TiQ engine work to the controlled batch', () => {
    expect(source).toContain('rating_processed_at: shouldRecalculateRatings ? new Date().toISOString() : null')
    expect(source).toContain('export async function runScheduledTennisRecordRatingBatch')
    expect(source).toContain('await recalculateDynamicRatings(undefined, service)')
  })

  it('runs rating catch-up daily during bootstrap and only on Wednesday once in weekly mode', () => {
    expect(isTennisRecordRatingBatchDue('bootstrap', new Date('2026-08-24T15:00:00Z'))).toBe(true)
    expect(isTennisRecordRatingBatchDue('weekly', new Date('2026-08-24T15:00:00Z'))).toBe(false)
    expect(isTennisRecordRatingBatchDue('weekly', new Date('2026-08-26T15:00:00Z'))).toBe(true)
  })
})
