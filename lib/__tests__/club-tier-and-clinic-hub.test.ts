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

  it('supports one bulk invitation flow for club programs and competition', () => {
    const club = source('app/components/club-workspace.tsx')
    const memberRoute = source('app/api/clubs/[clubId]/members/route.ts')
    expect(club).toContain('One email or up to 50')
    expect(club).toContain('invite links')
    expect(memberRoute).toContain('Invite up to 50 people at a time.')
    expect(memberRoute).toContain('.insert(newEmails.map')
    expect(memberRoute).toContain('already has a pending invitation here')
  })

  it('brings imported Player Roster contacts into Club People', () => {
    const club = source('app/components/club-workspace.tsx')
    const rosterRoute = source('app/api/clubs/[clubId]/roster-contacts/route.ts')
    const dataAssist = source('app/data-assist/page.tsx')
    expect(club).toContain('Use Player Roster')
    expect(club).toContain('Only new, email-ready people are selected.')
    expect(club).toContain('Upload or refresh roster')
    expect(rosterRoute).toContain("from('captain_roster_contacts')")
    expect(rosterRoute).toContain('isClubManager')
    expect(dataAssist).toContain("path === '/clubs' || path.startsWith('/clubs?')")
    expect(dataAssist).toContain('Return to Club People')
  })

  it('lets the uploader safely share one roster with other club managers', () => {
    const club = source('app/components/club-workspace.tsx')
    const rosterRoute = source('app/api/clubs/[clubId]/roster-contacts/route.ts')
    const migration = source('supabase/migrations/20260807000600_share_club_roster_contacts.sql')
    expect(club).toContain('Share with club')
    expect(club).toContain('Stop sharing')
    expect(club).toContain('Remove from club')
    expect(club).toContain('Shared by')
    expect(rosterRoute).toContain('export async function PATCH')
    expect(rosterRoute).toContain('Only the manager who imported this roster')
    expect(rosterRoute).toContain("from('club_roster_contact_shares')")
    expect(rosterRoute).toContain(".delete()")
    expect(migration).toContain('Club managers read shared roster contacts')
    expect(migration).toContain('public.can_manage_club(club_id)')
    expect(migration).toContain('Explicit, revocable permission')
  })

  it('reconciles imported contacts before creating Club invitations', () => {
    const club = source('app/components/club-workspace.tsx')
    const rosterRoute = source('app/api/clubs/[clubId]/roster-contacts/route.ts')
    const memberRoute = source('app/api/clubs/[clubId]/members/route.ts')
    const reconciliation = source('lib/club-roster-reconciliation.ts')
    expect(reconciliation).toContain('Already connected')
    expect(reconciliation).toContain('Invite pending')
    expect(club).toContain("contact.connectionStatus !== 'ready'")
    expect(rosterRoute).toContain('getClubRosterConnectionStatus')
    expect(rosterRoute).toContain(".select('email,phone,status')")
    expect(memberRoute).toContain('connectedEmails')
    expect(memberRoute).toContain(".gt('expires_at', new Date().toISOString())")
    expect(memberRoute).toContain('already connected or invited')
  })
})
