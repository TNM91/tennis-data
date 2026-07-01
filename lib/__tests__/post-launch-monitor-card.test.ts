import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('post-launch monitor card', () => {
  it('keeps a non-secret post-launch monitoring cadence available', () => {
    const packageJson = readFileSync(join(process.cwd(), 'package.json'), 'utf8')
    const qaIndex = readFileSync(join(process.cwd(), 'docs/customer-journey-qa-index.md'), 'utf8')
    const deployChecklist = readFileSync(join(process.cwd(), 'docs/deploy-checklist.md'), 'utf8')
    const closeoutLog = readFileSync(join(process.cwd(), 'docs/platform-closeout-verification-log.md'), 'utf8')
    const statusScript = readFileSync(join(process.cwd(), 'scripts/customer-journey-qa-status.mjs'), 'utf8')
    const postLaunchScript = readFileSync(join(process.cwd(), 'scripts/post-launch-monitor-card.mjs'), 'utf8')

    expect(packageJson).toContain('"qa:post-launch": "node scripts/post-launch-monitor-card.mjs"')
    expect(qaIndex).toContain('npm run qa:post-launch -- --live')
    expect(deployChecklist).toContain('npm run qa:post-launch -- --live')
    expect(closeoutLog).toContain('npm run qa:post-launch -- --live')
    expect(statusScript).toContain('qa:post-launch')

    for (const expected of [
      'npm run qa:launch-owner-board -- --live --stripe-mode',
      'npm run qa:prod-logs -- --since=30m',
      'npm run qa:seo-share -- --live',
      'npm run qa:adsense-live',
      'npm run verify:closeout:live',
      'npm run qa:vercel-branch',
      'npm run qa:stripe-live-cutover',
    ]) {
      expect(postLaunchScript).toContain(expected)
    }

    expect(postLaunchScript).not.toContain('STRIPE_SECRET_KEY')
    expect(postLaunchScript).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(postLaunchScript).not.toContain('process.env.VERCEL_TOKEN')
  })
})
