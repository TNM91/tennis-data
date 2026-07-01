import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Vercel observability wiring', () => {
  it('keeps Web Analytics and Speed Insights mounted in the app shell', () => {
    const packageJson = readFileSync(join(process.cwd(), 'package.json'), 'utf8')
    const layoutSource = readFileSync(join(process.cwd(), 'app/layout.tsx'), 'utf8')
    const deployChecklist = readFileSync(join(process.cwd(), 'docs/deploy-checklist.md'), 'utf8')
    const closeoutLog = readFileSync(join(process.cwd(), 'docs/platform-closeout-verification-log.md'), 'utf8')
    const postLaunchScript = readFileSync(join(process.cwd(), 'scripts/post-launch-monitor-card.mjs'), 'utf8')

    expect(packageJson).toContain('"@vercel/analytics"')
    expect(packageJson).toContain('"@vercel/speed-insights"')

    expect(layoutSource).toContain("import { Analytics } from '@vercel/analytics/next'")
    expect(layoutSource).toContain("import { SpeedInsights } from '@vercel/speed-insights/next'")
    expect(layoutSource).toContain('<Analytics />')
    expect(layoutSource).toContain('<SpeedInsights />')

    expect(deployChecklist).toContain('Vercel Web Analytics and Speed Insights are mounted in the root app shell')
    expect(closeoutLog).toContain('Check Vercel Web Analytics and Speed Insights')
    expect(postLaunchScript).toContain('https://vercel.com/tennis-data/tennis-data/analytics')
    expect(postLaunchScript).toContain('https://vercel.com/tennis-data/tennis-data/speed-insights')
  })
})
