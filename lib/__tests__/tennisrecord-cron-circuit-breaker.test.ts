import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/api/cron/tennisrecord-automation/route.ts'), 'utf8')

describe('TennisRecord cron circuit breaker', () => {
  it('can pause new collector checkpoints outside the overloaded database', () => {
    expect(source).toContain('TENNISRECORD_COLLECTOR_ENABLED')
    expect(source).toContain("collectorFlag === 'false'")
    expect(source).toContain("status: 'disabled'")
    expect(source).toContain('runAutomaticTennisRecordSync(service)')
  })
})
