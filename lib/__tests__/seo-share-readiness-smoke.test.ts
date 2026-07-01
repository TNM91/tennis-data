import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('SEO and share readiness smoke', () => {
  it('keeps a non-secret production SEO/share readiness check in the launch path', () => {
    const packageJson = readFileSync(join(process.cwd(), 'package.json'), 'utf8')
    const deployChecklist = readFileSync(join(process.cwd(), 'docs/deploy-checklist.md'), 'utf8')
    const launchSummary = readFileSync(join(process.cwd(), 'docs/launch-readiness-summary-2026-06-29.md'), 'utf8')
    const ownerBoard = readFileSync(join(process.cwd(), 'scripts/launch-owner-board.mjs'), 'utf8')
    const smokeScript = readFileSync(join(process.cwd(), 'scripts/seo-share-readiness-smoke.mjs'), 'utf8')

    expect(packageJson).toContain('"qa:seo-share": "node scripts/seo-share-readiness-smoke.mjs"')
    expect(deployChecklist).toContain('npm run qa:seo-share -- --live')
    expect(launchSummary).toContain('npm run qa:seo-share -- --live')
    expect(ownerBoard).toContain('SEO and share readiness')
    expect(ownerBoard).toContain("['scripts/seo-share-readiness-smoke.mjs', '--live']")

    for (const expected of [
      'metadataBase',
      'openGraph',
      'twitter',
      'application\\/ld\\+json',
      '/robots.txt',
      '/sitemap.xml',
      '/tenaceiq/logos/tenaceiq-social-preview.png',
      '/pricing',
      '/explore',
      '/players',
      '/leagues',
      '/teams',
      '/matchup',
      '/admin',
      '/mylab',
      '/upgrade',
    ]) {
      expect(smokeScript).toContain(expected)
    }

    expect(smokeScript).not.toContain('STRIPE_SECRET_KEY')
    expect(smokeScript).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(smokeScript).not.toContain('process.env.VERCEL_TOKEN')
  })
})
