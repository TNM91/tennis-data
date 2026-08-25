import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const service = readFileSync(join(process.cwd(), 'lib/tennisrecord/service.ts'), 'utf8')
const admin = readFileSync(join(process.cwd(), 'app/admin/tennisrecord/page.tsx'), 'utf8')

describe('TennisRecord rating observability', () => {
  it('reports promoted matches waiting for the controlled TiQ rating batch', () => {
    expect(service).toContain(".is('rating_processed_at', null)")
    expect(service).toContain('ratingProgress: {')
  })

  it('makes the pending count and cadence visible to Admins', () => {
    expect(admin).toContain('TiQ ratings waiting')
    expect(admin).toContain('TiQ rating catch-up')
    expect(admin).toContain('TennisRecord’s proprietary rating is never used.')
  })
})
