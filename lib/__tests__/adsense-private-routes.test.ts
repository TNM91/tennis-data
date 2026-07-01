import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { ADSENSE_IMPLEMENTATION_GUIDELINES } from '../adsense-guidelines'
import { isAdSafePath } from '../adsense'

describe('AdSense private route exclusions', () => {
  it('keeps Coach and Tactical Studio surfaces ad-free', () => {
    expect(isAdSafePath('/coach')).toBe(false)
    expect(isAdSafePath('/coach/invite/test-token')).toBe(false)
    expect(isAdSafePath('/tactics')).toBe(false)

    expect(ADSENSE_IMPLEMENTATION_GUIDELINES.join(' ')).toContain('Coach')
    expect(ADSENSE_IMPLEMENTATION_GUIDELINES.join(' ')).toContain('Tactical Studio')
  })

  it('still allows prepared public tennis routes', () => {
    expect(isAdSafePath('/players')).toBe(true)
    expect(isAdSafePath('/players/test-player')).toBe(true)
    expect(isAdSafePath('/leagues')).toBe(true)
  })

  it('keeps a live AdSense readiness smoke available for launch review', () => {
    const packageJson = readFileSync(join(process.cwd(), 'package.json'), 'utf8')
    const checklist = readFileSync(join(process.cwd(), 'docs/adsense-launch-checklist.md'), 'utf8')
    const smokeScript = readFileSync(join(process.cwd(), 'scripts/adsense-live-readiness-smoke.mjs'), 'utf8')

    expect(packageJson).toContain('"qa:adsense-live": "node scripts/adsense-live-readiness-smoke.mjs"')
    expect(checklist).toContain('npm run qa:adsense-live')
    expect(smokeScript).toContain('/ads.txt')
    expect(smokeScript).toContain('/robots.txt')
    expect(smokeScript).toContain('/sitemap.xml')
    expect(smokeScript).toContain('pub-1351888380884789')
    expect(smokeScript).toContain('/admin/access')
    expect(smokeScript).toContain('/upgrade?plan=coach')
  })
})
