import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { tennisRecordPipelineHealth } from '../tennisrecord/service'

const service = readFileSync(join(process.cwd(), 'lib/tennisrecord/service.ts'), 'utf8')
const admin = readFileSync(join(process.cwd(), 'app/admin/tennisrecord/page.tsx'), 'utf8')

describe('TennisRecord rating observability', () => {
  it('reports promoted matches waiting for the controlled TiQ rating batch', () => {
    expect(service).toContain(".is('rating_processed_at', null)")
    expect(service).toContain('ratingProgress: {')
  })

  it('makes the pending count and cadence visible to Admins', () => {
    expect(admin).toContain('TiQ ratings waiting')
    expect(admin).toContain('Baseline refresh')
    expect(admin).toContain('TiQ rating catch-up')
    expect(admin).toContain('TennisRecord’s proprietary rating is never used.')
  })

  it('distinguishes a deliberate safety pause from a missed bootstrap checkpoint', () => {
    expect(tennisRecordPipelineHealth({ enabled: true, automationState: 'bootstrap', lastSuccessfulCollectorAt: '2026-08-25T12:00:00.000Z', safetyThrottle: { active: true, reason: 'source retry pressure', resumesAt: '2026-08-25T12:15:00.000Z' } }, Date.parse('2026-08-25T12:30:00.000Z')).state).toBe('cooling_down')
    expect(tennisRecordPipelineHealth({ enabled: true, automationState: 'bootstrap', lastSuccessfulCollectorAt: '2026-08-25T12:00:00.000Z', safetyThrottle: { active: false, reason: null, resumesAt: null } }, Date.parse('2026-08-25T12:30:00.000Z')).state).toBe('attention')
  })
})
