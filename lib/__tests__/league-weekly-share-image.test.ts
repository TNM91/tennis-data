import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'

vi.mock('server-only', () => ({}))
vi.mock('../league-weekly-share', () => ({
  getLeagueWeeklySharePreview: vi.fn(async () => ({ leagueName: 'STL Men’s Finest', logoUrl: 'https://pwxppfazbyourjrsutgx.supabase.co/storage/v1/object/public/tiq-league-photos/test.webp', playOn: '2026-10-01', facility: 'Forest Lake' })),
  formatLeagueWeeklyShareDate: () => 'Thursday, October 1',
}))

describe('league-specific weekly share image', () => {
  it('renders a valid 1200 × 630 PNG with an uploaded WebP logo', async () => {
    const upload = await sharp(await readFile(join(process.cwd(), 'public/brand/web/header-iq-compact.png'))).webp().toBuffer()
    const originalFetch = globalThis.fetch
    vi.stubGlobal('fetch', vi.fn(async (input, init) => String(input).includes('test.webp')
      ? new Response(upload, { headers: { 'content-type': 'image/webp' } })
      : originalFetch(input, init)))
    try {
      const { default: Image } = await import('../../app/league-week/[token]/opengraph-image')
      const result = await Image({ params: Promise.resolve({ token: 'test' }) })
      const png = Buffer.from(await result.arrayBuffer())
      const metadata = await sharp(png).metadata()
      expect(metadata.format).toBe('png')
      expect(metadata.width).toBe(1200)
      expect(metadata.height).toBe(630)
      expect(png.length).toBeGreaterThan(10_000)
    } finally { vi.unstubAllGlobals() }
  })
})
