import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  PRICING_PLAN_VIDEO_IDS,
  PRODUCT_TOUR_VIDEOS,
  TIER_TOUR_VIDEO_IDS,
} from '../product-tour-videos'

const componentSource = readFileSync(join(process.cwd(), 'app/components/product-tour-video.tsx'), 'utf8')
const homeSource = readFileSync(join(process.cwd(), 'app/page.tsx'), 'utf8')
const pricingSource = readFileSync(join(process.cwd(), 'app/pricing/page.tsx'), 'utf8')
const tourPageSource = readFileSync(join(process.cwd(), 'app/resources/platform-tour/page.tsx'), 'utf8')
const sitemapSource = readFileSync(join(process.cwd(), 'app/sitemap.ts'), 'utf8')

describe('product tour videos', () => {
  it('ships every video with an optimized poster and English caption track', () => {
    for (const video of Object.values(PRODUCT_TOUR_VIDEOS)) {
      for (const publicPath of [video.src, video.captions, video.poster]) {
        const filePath = join(process.cwd(), 'public', publicPath.replace(/^\//, ''))
        expect(existsSync(filePath), publicPath).toBe(true)
        expect(statSync(filePath).size, publicPath).toBeGreaterThan(100)
      }

      expect(video.transcript.length, video.id).toBeGreaterThan(0)
      expect(video.durationSeconds, video.id).toBeGreaterThan(0)
    }
  })

  it('keeps click-to-load playback accessible and avoids ambient autoplay', () => {
    expect(componentSource).toContain('<dialog')
    expect(componentSource).toContain('showModal()')
    expect(componentSource).toContain('preload="none"')
    expect(componentSource).toContain('kind="captions"')
    expect(componentSource).toContain('<details className={styles.transcript}>')
    expect(componentSource).toContain('aria-label="Close video"')
    expect(componentSource).toContain('mediaReady ? <source')
    expect(componentSource).not.toContain('autoPlay')
  })

  it('connects the teaser, every pricing plan, Club, and the permanent tour library', () => {
    expect(homeSource).toContain('<ProductTourHomeSpotlight />')
    expect(homeSource.indexOf('<ProductTourHomeSpotlight />')).toBeLessThan(homeSource.indexOf('<GuestTierPreviewGate />'))
    expect(Object.keys(PRICING_PLAN_VIDEO_IDS)).toEqual([
      'free',
      'player_plus',
      'coach',
      'captain',
      'league',
      'full_court',
    ])
    expect(pricingSource).toContain('PRICING_PLAN_VIDEO_IDS[plan.id]')
    expect(pricingSource).toContain('videoId="club"')
    expect(TIER_TOUR_VIDEO_IDS).toEqual(['free', 'player', 'coach', 'captain', 'league', 'full-court', 'club'])
    expect(tourPageSource).toContain('TIER_TOUR_VIDEO_IDS.map')
    expect(tourPageSource).toContain('videoId="platform-tour"')
    expect(sitemapSource).toContain("path: '/resources/platform-tour'")
  })

  it('records starts, completions, and video next-step clicks without blocking playback', () => {
    const eventsSource = readFileSync(join(process.cwd(), 'lib/product-usage-events.ts'), 'utf8')
    const trackingSource = readFileSync(join(process.cwd(), 'lib/product-usage-client.ts'), 'utf8')

    for (const eventName of ['product_tour_started', 'product_tour_completed', 'product_tour_cta_clicked']) {
      expect(eventsSource).toContain(`'${eventName}'`)
      expect(componentSource).toContain(`eventName: '${eventName}'`)
    }
    expect(trackingSource).toContain('Product usage tracking must never interrupt')
  })
})
