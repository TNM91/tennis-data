import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  PRODUCT_TOUR_CONTENT_REVIEW,
  PRICING_PLAN_VIDEO_IDS,
  PRODUCT_TOUR_VIDEOS,
  TIER_TOUR_VIDEO_IDS,
  getProductTourPriceSummary,
} from '../product-tour-videos'
import { PRODUCT_TOUR_PLAN_FINDER_OPTIONS } from '../product-tour-plan-finder'
import { VERIFIED_PRODUCT_TOUR_PROOF } from '../product-tour-proof'
import { getPricingPlan } from '../pricing-plans'

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
    expect(homeSource.indexOf('<ProductTourHomeSpotlight />')).toBeLessThan(homeSource.indexOf('<GuestTierPreview />'))
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

    for (const eventName of ['product_tour_started', 'product_tour_progressed', 'product_tour_completed', 'product_tour_cta_clicked']) {
      expect(eventsSource).toContain(`'${eventName}'`)
      expect(componentSource).toContain(`eventName: '${eventName}'`)
    }
    expect(eventsSource).toContain("'product_tour_role_selected'")
    expect(componentSource).toContain("track('Product Tour'")
    expect(componentSource).toContain('onTimeUpdate=')
    expect(componentSource).toContain('for (const milestone of [25, 50, 75])')
    expect(trackingSource).toContain('Product usage tracking must never interrupt')
  })

  it('keeps current pricing dynamic and out of the exported narration', () => {
    expect(getProductTourPriceSummary('player')?.label).toBe(getPricingPlan('player_plus').priceLabel)
    expect(getProductTourPriceSummary('league')?.label).toBe(getPricingPlan('league').priceLabel)
    expect(getProductTourPriceSummary('club')?.label).toBe(`From ${getPricingPlan('club_starter').priceLabel}`)
    expect(getProductTourPriceSummary('platform-tour')).toBeNull()

    for (const video of Object.values(PRODUCT_TOUR_VIDEOS)) {
      expect(video.transcript.join(' '), video.id).not.toMatch(/\$\d/)
      const captions = readFileSync(join(process.cwd(), 'public', video.captions.replace(/^\//, '')), 'utf8')
      expect(captions, video.id).not.toMatch(/\$\d/)
    }
  })

  it('offers a current role recommendation for every tier without invented proof', () => {
    expect(PRODUCT_TOUR_PLAN_FINDER_OPTIONS.map((option) => option.videoId)).toEqual(TIER_TOUR_VIDEO_IDS)
    expect(PRODUCT_TOUR_PLAN_FINDER_OPTIONS.every((option) => option.priceLabel.length > 0)).toBe(true)
    expect(tourPageSource).toContain('<ProductTourPlanFinder options={PRODUCT_TOUR_PLAN_FINDER_OPTIONS} />')
    expect(tourPageSource).toContain('PRODUCT_TOUR_PLAN_FINDER_OPTIONS.map')
    expect(VERIFIED_PRODUCT_TOUR_PROOF).toEqual([])
  })

  it('carries an explicit quarterly review and verified-proof policy', () => {
    const governanceSource = readFileSync(join(process.cwd(), 'docs/product-tour-governance.md'), 'utf8')
    expect(PRODUCT_TOUR_CONTENT_REVIEW.pricingPolicy).toBe('dynamic')
    expect(PRODUCT_TOUR_CONTENT_REVIEW.reviewDueOn).toBe('2026-12-01')
    expect(governanceSource).toContain('Review the tour in March, June, September, and December.')
    expect(governanceSource).toContain('Never ship placeholder names')
  })
})
