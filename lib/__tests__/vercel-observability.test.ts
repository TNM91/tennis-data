import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Vercel observability wiring', () => {
  it('keeps public-web observability behind the native privacy boundary', () => {
    const packageJson = readFileSync(join(process.cwd(), 'package.json'), 'utf8')
    const layoutSource = readFileSync(join(process.cwd(), 'app/layout.tsx'), 'utf8')
    const serviceSource = readFileSync(join(process.cwd(), 'app/components/web-service-scripts.tsx'), 'utf8')
    const deployChecklist = readFileSync(join(process.cwd(), 'docs/deploy-checklist.md'), 'utf8')
    const closeoutLog = readFileSync(join(process.cwd(), 'docs/platform-closeout-verification-log.md'), 'utf8')
    const qaIndex = readFileSync(join(process.cwd(), 'docs/customer-journey-qa-index.md'), 'utf8')
    const statusScript = readFileSync(join(process.cwd(), 'scripts/customer-journey-qa-status.mjs'), 'utf8')
    const ownerBoardScript = readFileSync(join(process.cwd(), 'scripts/launch-owner-board.mjs'), 'utf8')
    const postLaunchScript = readFileSync(join(process.cwd(), 'scripts/post-launch-monitor-card.mjs'), 'utf8')
    const smokeScript = readFileSync(join(process.cwd(), 'scripts/vercel-observability-smoke.mjs'), 'utf8')

    expect(packageJson).toContain('"@vercel/analytics"')
    expect(packageJson).toContain('"@vercel/speed-insights"')
    expect(packageJson).toContain('"qa:observability": "node scripts/vercel-observability-smoke.mjs"')

    expect(layoutSource).toContain('<WebServiceScripts observabilityEnabled={VERCEL_OBSERVABILITY_ENABLED} />')
    expect(layoutSource).not.toContain('<Analytics />')
    expect(layoutSource).not.toContain('<SpeedInsights />')
    expect(serviceSource).toContain("from '@vercel/analytics/next'")
    expect(serviceSource).toContain("from '@vercel/speed-insights/next'")
    expect(serviceSource).toContain('if (privateVisit) return null')
    expect(serviceSource).toContain('<Analytics />')
    expect(serviceSource).toContain('<SpeedInsights />')

    expect(smokeScript).toContain('@vercel/analytics')
    expect(smokeScript).toContain('@vercel/speed-insights')
    expect(smokeScript).toContain('Latest production deployment')
    expect(deployChecklist).toContain('Vercel Web Analytics and Speed Insights are mounted in the root app shell')
    expect(deployChecklist).toContain('npm run qa:observability -- --live')
    expect(closeoutLog).toContain('Check Vercel Web Analytics and Speed Insights')
    expect(closeoutLog).toContain('npm run qa:observability -- --live')
    expect(qaIndex).toContain('npm run qa:observability -- --live')
    expect(statusScript).toContain('qa:observability')
    expect(ownerBoardScript).toContain('npm run qa:observability')
    expect(postLaunchScript).toContain('npm run qa:observability -- --live')
    expect(postLaunchScript).toContain('https://vercel.com/tennis-data/tennis-data/analytics')
    expect(postLaunchScript).toContain('https://vercel.com/tennis-data/tennis-data/speed-insights')
  })
})
