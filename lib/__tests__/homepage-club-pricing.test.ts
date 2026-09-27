import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const homepageSource = readFileSync(join(process.cwd(), 'app/page.tsx'), 'utf8')
const tierPreviewSource = readFileSync(join(process.cwd(), 'app/components/public-command-center.tsx'), 'utf8')
const planLanesSource = readFileSync(join(process.cwd(), 'app/components/home-plan-lanes.tsx'), 'utf8')
const pricingPlansSource = readFileSync(join(process.cwd(), 'lib/pricing-plans.ts'), 'utf8')

describe('homepage Club pricing', () => {
  it('keeps one shared homepage plan entry point', () => {
    expect(homepageSource).toContain('GuestTierPreview,')
    expect(homepageSource).toContain('<GuestTierPreview />')
    expect(homepageSource).not.toContain('GuestTierPreviewGate')
    expect(homepageSource).not.toContain('HomeClubPricing')
  })

  it('keeps both Club options at the end of the canonical pricing list', () => {
    const fullCourtIndex = pricingPlansSource.indexOf("id: 'full_court'")
    const leagueIndex = pricingPlansSource.indexOf("id: 'league'")
    const starterIndex = pricingPlansSource.indexOf("id: 'club_starter'")
    const unlimitedIndex = pricingPlansSource.indexOf("id: 'club_unlimited'")

    expect(leagueIndex).toBeGreaterThan(-1)
    expect(fullCourtIndex).toBeGreaterThan(leagueIndex)
    expect(starterIndex).toBeGreaterThan(fullCourtIndex)
    expect(unlimitedIndex).toBeGreaterThan(starterIndex)
  })

  it('uses canonical Club plan data and links to the complete comparison', () => {
    expect(pricingPlansSource).toContain('CLUB_PLAN_STORY.starter.capacityLabel')
    expect(pricingPlansSource).toContain('CLUB_PLAN_STORY.unlimited.capacityLabel')
    expect(planLanesSource).toContain("{ planId: 'club_starter', label: 'Club'")
    expect(planLanesSource).toContain('href="/pricing"')
    expect(tierPreviewSource).toContain('return <HomePlanLanes />')
  })
})
