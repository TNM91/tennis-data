import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const homepageSource = readFileSync(join(process.cwd(), 'app/page.tsx'), 'utf8')
const tierPreviewSource = readFileSync(join(process.cwd(), 'app/components/public-command-center.tsx'), 'utf8')

describe('homepage Club pricing', () => {
  it('shows every plan in one shared homepage pricing list', () => {
    expect(homepageSource).toContain('GuestTierPreview,')
    expect(homepageSource).toContain('<GuestTierPreview />')
    expect(homepageSource).not.toContain('GuestTierPreviewGate')
    expect(homepageSource).not.toContain('HomeClubPricing')
  })

  it('places both Club options at the end of the shared tier list', () => {
    const fullCourtIndex = tierPreviewSource.indexOf("planId: 'full_court'")
    const leagueIndex = tierPreviewSource.indexOf("planId: 'league'")
    const starterIndex = tierPreviewSource.indexOf("planId: 'club_starter'")
    const unlimitedIndex = tierPreviewSource.indexOf("planId: 'club_unlimited'")

    expect(fullCourtIndex).toBeGreaterThan(-1)
    expect(leagueIndex).toBeGreaterThan(fullCourtIndex)
    expect(starterIndex).toBeGreaterThan(leagueIndex)
    expect(unlimitedIndex).toBeGreaterThan(starterIndex)
  })

  it('shows the canonical Club capacity language in the shared cards', () => {
    expect(tierPreviewSource).toContain('CLUB_PLAN_STORY.starter.capacityLabel')
    expect(tierPreviewSource).toContain('CLUB_PLAN_STORY.unlimited.capacityLabel')
    expect(tierPreviewSource).toContain('audienceOverride ?? plan.audience')
  })
})
