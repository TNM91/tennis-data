import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('launch owner board', () => {
  it('keeps a launch handoff command that separates code gates from owner actions', () => {
    const packageJson = readFileSync(join(process.cwd(), 'package.json'), 'utf8')
    const deployChecklist = readFileSync(join(process.cwd(), 'docs/deploy-checklist.md'), 'utf8')
    const launchSummary = readFileSync(join(process.cwd(), 'docs/launch-readiness-summary-2026-06-29.md'), 'utf8')
    const boardScript = readFileSync(join(process.cwd(), 'scripts/launch-owner-board.mjs'), 'utf8')

    expect(packageJson).toContain('"qa:launch-owner-board": "node scripts/launch-owner-board.mjs"')
    expect(deployChecklist).toContain('npm run qa:launch-owner-board -- --live --stripe-mode')
    expect(launchSummary).toContain('Owner Gate Recheck')
    expect(boardScript).toContain("type: 'blocking'")
    expect(boardScript).toContain("type: 'owner-action'")
    expect(boardScript).toContain('npm run qa:vercel-branch')
    expect(boardScript).toContain('node scripts/stripe-checkout-mode-smoke.mjs --expect=test --plan=coach')
    expect(boardScript).toContain('npm run qa:stripe-live-cutover')
    expect(boardScript).not.toContain('STRIPE_SECRET_KEY')
    expect(boardScript).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
  })
})
