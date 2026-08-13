import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const homepageSource = readFileSync(join(process.cwd(), 'app/page.tsx'), 'utf8')
const clubPricingSource = readFileSync(join(process.cwd(), 'app/components/home-club-pricing.tsx'), 'utf8')

describe('homepage Club pricing', () => {
  it('places the premium Club offer on the homepage', () => {
    expect(homepageSource).toContain("import HomeClubPricing from '@/app/components/home-club-pricing'")
    expect(homepageSource).toContain('<HomeClubPricing />')
  })

  it('shows every individual tier alongside the separate Club offer', () => {
    expect(homepageSource).toContain('GuestTierPreview,')
    expect(homepageSource).toContain('<GuestTierPreview />')
    expect(homepageSource).not.toContain('GuestTierPreviewGate')
  })

  it('uses the centralized Club story and shows the capacity difference', () => {
    expect(clubPricingSource).toContain("import { CLUB_PLAN_STORY } from '@/lib/product-story'")
    expect(clubPricingSource).toContain('Same complete Club experience')
    expect(clubPricingSource).toContain('Capacity is the difference')
    expect(clubPricingSource).toContain('CLUB_PLAN_STORY.starter')
    expect(clubPricingSource).toContain('CLUB_PLAN_STORY.unlimited')
  })

  it('links to both purchase paths and the live Club example', () => {
    expect(clubPricingSource).toContain('plan=${plan.id}&next=%2Fclubs&utm_source=homepage')
    expect(clubPricingSource).toContain('/pricing#club')
    expect(clubPricingSource).toContain('/clubs/northstar-tennis-club-demo')
  })
})
