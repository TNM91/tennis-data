import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CLUB_PLAN_STORY } from '../product-story'

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('Club tier and Clinic Hub integration', () => {
  it('defines Club as a separate offering without claiming club operations', () => {
    expect(CLUB_PLAN_STORY.starter.priceLabel).toBe('$99/month')
    expect(CLUB_PLAN_STORY.unlimited.priceLabel).toBe('$199/month')
    expect(CLUB_PLAN_STORY.boundary).toContain('does not replace court booking')
    expect(CLUB_PLAN_STORY.starter.description).toContain('registration or payment system')
  })

  it('houses Clinic Hub inside the Club lane', () => {
    const portal = source('app/components/portal-tool-bar.tsx')
    const club = source('app/components/club-workspace.tsx')
    const clinic = source('app/components/clinic-hub.tsx')
    expect(portal).toContain("id: 'club'")
    expect(portal).toContain("route: '/clubs'")
    expect(portal).toContain("title: 'Run clinics'")
    expect(club).toContain('Open Clinic Hub')
    expect(clinic).toContain('Roster + waitlist')
    expect(clinic).toContain('Recurring schedule')
    expect(clinic).toContain('Coach plan')
    expect(clinic).toContain('Attendance')
    expect(clinic).toContain('Clinic updates')
  })

  it('lets club managers share and revoke pending invitations', () => {
    const club = source('app/components/club-workspace.tsx')
    const memberRoute = source('app/api/clubs/[clubId]/members/route.ts')
    expect(club).toContain('Share invite')
    expect(club).toContain('Revoke this invitation?')
    expect(memberRoute).toContain('export async function DELETE')
    expect(memberRoute).toContain("update({ status: 'revoked' })")
    expect(memberRoute).toContain(".eq('status', 'pending')")
  })
})
