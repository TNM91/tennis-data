import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('production log smoke', () => {
  it('keeps a repeatable Vercel production log smoke in the launch checklist', () => {
    const packageJson = readFileSync(join(process.cwd(), 'package.json'), 'utf8')
    const checklist = readFileSync(join(process.cwd(), 'docs/deploy-checklist.md'), 'utf8')
    const smokeScript = readFileSync(join(process.cwd(), 'scripts/vercel-production-log-smoke.mjs'), 'utf8')

    expect(packageJson).toContain('"qa:prod-logs": "node scripts/vercel-production-log-smoke.mjs"')
    expect(checklist).toContain('npm run qa:prod-logs')
    expect(smokeScript).toContain('vercel')
    expect(smokeScript).toContain('logs')
    expect(smokeScript).toContain('--environment')
    expect(smokeScript).toContain('production')
    expect(smokeScript).toContain('--level')
    expect(smokeScript).toContain('error')
    expect(smokeScript).toContain('fatal')
    expect(smokeScript).toContain('--status-code')
    expect(smokeScript).toContain('500')
    expect(smokeScript).toContain('--json')
    expect(smokeScript).toContain('warning')
    expect(smokeScript).toContain('blocking: false')
  })
})
