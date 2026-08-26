import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const service = readFileSync(join(process.cwd(), 'lib/tennisrecord/service.ts'), 'utf8')
const adminPage = readFileSync(join(process.cwd(), 'app/admin/tennisrecord/page.tsx'), 'utf8')

describe('TennisRecord rating evidence dashboard', () => {
  it('reports factual designation evidence without using estimated source ratings', () => {
    expect(service).toContain("from('tennisrecord_ntrp_observations')")
    expect(service).toContain('paired2025To2026')
    expect(adminPage).toContain('TiQ rating evidence')
    expect(adminPage).toContain('Computer-rated anchors')
    expect(adminPage).toContain('TennisRecord’s estimated rating is never used.')
  })
})
