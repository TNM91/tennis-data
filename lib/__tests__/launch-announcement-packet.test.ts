import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('launch announcement packet', () => {
  it('keeps the public launch copy packet wired to centralized product language', () => {
    const packageJson = readFileSync(join(process.cwd(), 'package.json'), 'utf8')
    const qaIndex = readFileSync(join(process.cwd(), 'docs/customer-journey-qa-index.md'), 'utf8')
    const deployChecklist = readFileSync(join(process.cwd(), 'docs/deploy-checklist.md'), 'utf8')
    const launchSummary = readFileSync(join(process.cwd(), 'docs/launch-readiness-summary-2026-06-29.md'), 'utf8')
    const statusScript = readFileSync(join(process.cwd(), 'scripts/customer-journey-qa-status.mjs'), 'utf8')
    const packetScript = readFileSync(join(process.cwd(), 'scripts/launch-announcement-packet.mjs'), 'utf8')

    expect(packageJson).toContain('"qa:announcement": "node scripts/launch-announcement-packet.mjs"')
    expect(statusScript).toContain('qa:announcement')
    expect(qaIndex).toContain('npm run qa:announcement')
    expect(deployChecklist).toContain('npm run qa:announcement')
    expect(launchSummary).toContain('npm run qa:announcement')

    for (const expected of [
      'lib/product-story.ts',
      'PRODUCT_MOTTO',
      'PRODUCT_NORTH_STAR',
      'PLATFORM_POSITIONING',
      'PRODUCT_LANGUAGE_SYSTEM',
      'free',
      'player_plus',
      'coach',
      'captain',
      'league',
      'full_court',
    ]) {
      expect(packetScript).toContain(expected)
    }

    expect(packetScript).toContain('Do not imply direct USTA API dependence')
    expect(packetScript).toContain('Stripe paid-upgrade language')
    expect(packetScript).not.toContain('STRIPE_SECRET_KEY')
    expect(packetScript).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(packetScript).not.toContain('process.env.VERCEL_TOKEN')
  })
})
