import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const route = readFileSync(join(process.cwd(), 'app/api/cron/tennisrecord-ratings/route.ts'), 'utf8')
const config = readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')

describe('TennisRecord scheduled rating batch', () => {
  it('uses the protected cron route and keeps the circuit breaker in front of database work', () => {
    expect(route).toContain("request.headers.get('authorization') !== `Bearer ${secret}`")
    expect(route).toContain('TENNISRECORD_COLLECTOR_ENABLED')
    expect(route).toContain('runScheduledTennisRecordRatingBatch(service)')
  })

  it('schedules the controlled rating batch separately from source checkpoints', () => {
    expect(config).toContain('"path": "/api/cron/tennisrecord-ratings"')
    expect(config).toContain('"schedule": "2,17,32,47 * * * *"')
  })
})
