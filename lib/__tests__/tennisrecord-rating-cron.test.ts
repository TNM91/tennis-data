import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const route = readFileSync(join(process.cwd(), 'app/api/cron/tennisrecord-ratings/route.ts'), 'utf8')
const config = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as { crons: { path: string }[] }

describe('TennisRecord scheduled rating batch', () => {
  it('uses the protected cron route and keeps the circuit breaker in front of database work', () => {
    expect(route).toContain("request.headers.get('authorization') !== `Bearer ${secret}`")
    expect(route).toContain('TENNISRECORD_COLLECTOR_ENABLED')
    expect(route).toContain('runScheduledTennisRecordRatingBatch(service)')
  })

  it('keeps legacy ratings and source collection off the production schedule during the iOS launch', () => {
    const paths = config.crons.map(({ path }) => path)
    expect(paths).not.toContain('/api/cron/tennisrecord-ratings')
    expect(paths).not.toContain('/api/cron/tennisrecord-automation')
  })
})
