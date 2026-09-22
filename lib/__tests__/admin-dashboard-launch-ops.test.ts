import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const adminPageSource = readFileSync(join(process.cwd(), 'app/admin/page.tsx'), 'utf8')

describe('admin dashboard launch operations', () => {
  it('surfaces timed promotional access from the admin landing page', () => {
    expect(adminPageSource).toContain('Access Control')
    expect(adminPageSource).toContain('temporary promotional access with end dates')
    expect(adminPageSource).toContain('Timed promos')
    expect(adminPageSource).toContain('/admin/access')
    expect(adminPageSource).toContain('Traffic & activity')
    expect(adminPageSource).toContain('Vercel Web Analytics is the source of truth')
    expect(adminPageSource).toContain('Active members · 7d')
  })
})
