import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('team connection flow', () => {
  it('discovers imported roles by signed-in email or linked player and requires consent', () => {
    const route = readFileSync(join(process.cwd(), 'app/api/team-connections/route.ts'), 'utf8')

    expect(route).toContain(".from('captain_roster_contacts')")
    expect(route).toContain(".eq('email', email)")
    expect(route).toContain(".from('team_roster_members')")
    expect(route).toContain(".eq('player_id', linkedPlayerId)")
    expect(route).toContain("action === 'accept' ? 'accepted' : 'declined'")
    expect(route).toContain('clearProfileTeamIfMatching')
  })

  it('shows the invitation globally and keeps unlink available', () => {
    const shell = readFileSync(join(process.cwd(), 'app/components/site-shell.tsx'), 'utf8')
    const banner = readFileSync(join(process.cwd(), 'app/components/team-connection-invite.tsx'), 'utf8')
    const page = readFileSync(join(process.cwd(), 'app/team-connections/page.tsx'), 'utf8')

    expect(shell).toContain('<TeamConnectionInvite />')
    expect(banner).toContain('You were added to')
    expect(banner).toContain('Link this team to your profile? You can unlink it later.')
    expect(page).toContain("act(connection, 'unlink')")
    expect(page).toContain("act(connection, 'relink')")
  })

  it('protects stored team links with profile-scoped policies', () => {
    const migration = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260801000600_create_team_profile_links.sql'),
      'utf8',
    )

    expect(migration).toContain('profile_user_id = auth.uid()')
    expect(migration).toContain("team_role in ('player', 'captain', 'co_captain')")
    expect(migration).toContain("status in ('accepted', 'declined', 'unlinked')")
  })

  it('limits the optional first-month coupon to accepted invited captains without access', () => {
    const checkout = readFileSync(join(process.cwd(), 'app/api/checkout/session/route.ts'), 'utf8')

    expect(checkout).toContain('STRIPE_CAPTAIN_TEAM_INVITE_COUPON_ID')
    expect(checkout).toContain(".eq('status', 'accepted')")
    expect(checkout).toContain(".in('team_role', ['captain', 'co_captain'])")
    expect(checkout).toContain('if (entitlement.captain_subscription_active) return')
  })
})
