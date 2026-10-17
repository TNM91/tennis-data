import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getPricingPlan } from '../pricing-plans'
import { CLUB_PLAN_STORY } from '../product-story'

const homepageSource = readFileSync(join(process.cwd(), 'app/page.tsx'), 'utf8')
const tierPreviewSource = readFileSync(join(process.cwd(), 'app/components/public-command-center.tsx'), 'utf8')
const planLanesSource = readFileSync(join(process.cwd(), 'app/components/home-plan-lanes.tsx'), 'utf8')

describe('homepage Club pricing', () => {
  it('routes the homepage plan preview through the shared role lanes', () => {
    expect(homepageSource).toContain('GuestTierPreview,')
    expect(homepageSource).toContain('<GuestTierPreview />')
    expect(homepageSource).not.toContain('GuestTierPreviewGate')
    expect(homepageSource).not.toContain('HomeClubPricing')
    expect(tierPreviewSource).toContain('return <HomePlanLanes />')
  })

  it('offers Club after League in Organize and links to every plan', () => {
    const organizeIndex = planLanesSource.indexOf("id: 'organize'")
    const leagueIndex = planLanesSource.indexOf("planId: 'league'", organizeIndex)
    const starterIndex = planLanesSource.indexOf("planId: 'club_starter'", organizeIndex)
    expect(organizeIndex).toBeGreaterThan(-1)
    expect(leagueIndex).toBeGreaterThan(organizeIndex)
    expect(starterIndex).toBeGreaterThan(leagueIndex)
    expect(planLanesSource).toContain("href: '/pricing#club_starter'")
    expect(planLanesSource).toContain('href="/pricing"')
    expect(planLanesSource).toContain('Compare every plan')
  })

  it('uses centralized Club pricing and capacity language', () => {
    expect(planLanesSource).toContain('getPricingPlan(selectedPlanId)')
    expect(planLanesSource).toContain('selectedPlan.audience')
    expect(getPricingPlan('club_starter').outcome).toContain(CLUB_PLAN_STORY.starter.capacityLabel.toLowerCase())
    expect(getPricingPlan('club_unlimited').outcome).toContain(CLUB_PLAN_STORY.unlimited.capacityLabel.toLowerCase())
  })
})
