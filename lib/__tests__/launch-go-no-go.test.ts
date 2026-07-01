import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('launch go/no-go packet', () => {
  it('keeps the final launch decision command wired into scripts and docs', () => {
    const packageJson = readFileSync(join(process.cwd(), 'package.json'), 'utf8')
    const qaIndex = readFileSync(join(process.cwd(), 'docs/customer-journey-qa-index.md'), 'utf8')
    const deployChecklist = readFileSync(join(process.cwd(), 'docs/deploy-checklist.md'), 'utf8')
    const launchSummary = readFileSync(join(process.cwd(), 'docs/launch-readiness-summary-2026-06-29.md'), 'utf8')
    const statusScript = readFileSync(join(process.cwd(), 'scripts/customer-journey-qa-status.mjs'), 'utf8')
    const goNoGoScript = readFileSync(join(process.cwd(), 'scripts/launch-go-no-go.mjs'), 'utf8')

    expect(packageJson).toContain('"qa:go-no-go": "node scripts/launch-go-no-go.mjs"')
    expect(statusScript).toContain('qa:go-no-go')
    expect(qaIndex).toContain('npm run qa:go-no-go -- --live')
    expect(deployChecklist).toContain('npm run qa:go-no-go -- --live')
    expect(launchSummary).toContain('npm run qa:go-no-go -- --live')

    for (const expected of [
      'scripts/launch-owner-board.mjs',
      'scripts/vercel-observability-smoke.mjs',
      'scripts/post-launch-monitor-card.mjs',
      'GO for public launch announcement',
      'Stripe live cutover',
    ]) {
      expect(goNoGoScript).toContain(expected)
    }

    expect(goNoGoScript).not.toContain('STRIPE_SECRET_KEY')
    expect(goNoGoScript).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(goNoGoScript).not.toContain('process.env.VERCEL_TOKEN')
  })
})
