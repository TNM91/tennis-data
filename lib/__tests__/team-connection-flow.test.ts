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
    expect(route).toContain(".in('normalized_name', rosterNames)")
    expect(route).toContain('mergeTeamConnectionRoles')
    expect(route).toContain('contactMatchesLinkedPlayer')
    expect(route).toContain("action === 'accept' ? 'accepted' : 'declined'")
    expect(route).toContain('reconcileDefaultTeam')
    expect(route).toContain("'set_default'")
    expect(route).toContain('is_default')
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
    expect(page).toContain("act(connection, 'restore_roles')")
  })

  it('protects stored team links with profile-scoped policies', () => {
    const migration = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260801000600_create_team_profile_links.sql'),
      'utf8',
    )

    expect(migration).toContain('profile_user_id = auth.uid()')
    expect(migration).toContain("team_role in ('player', 'captain', 'co_captain')")
    expect(migration).toContain("status in ('accepted', 'declined', 'unlinked')")

    const multiRoleMigration = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260801000700_add_team_profile_link_roles.sql'),
      'utf8',
    )
    expect(multiRoleMigration).toContain('team_roles text[]')
    expect(multiRoleMigration).toContain('declined_roles text[]')
    expect(multiRoleMigration).toContain('role_accepted_at jsonb')

    const defaultTeamMigration = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260801000800_add_default_team_profile_link.sql'),
      'utf8',
    )
    expect(defaultTeamMigration).toContain('is_default boolean')
    expect(defaultTeamMigration).toContain('team_profile_links_one_default_per_profile_idx')
    expect(defaultTeamMigration).toContain("where is_default = true and status = 'accepted'")
  })

  it('limits team invitation coupons to recent accepted roles without prior access', () => {
    const checkout = readFileSync(join(process.cwd(), 'app/api/checkout/session/route.ts'), 'utf8')
    const offers = readFileSync(join(process.cwd(), 'lib/team-invite-offers.ts'), 'utf8')

    expect(checkout).toContain("checkoutTarget.planId === 'captain' || checkoutTarget.planId === 'player_plus'")
    expect(offers).toContain('STRIPE_CAPTAIN_TEAM_INVITE_COUPON_ID')
    expect(offers).toContain('STRIPE_PLAYER_TEAM_INVITE_COUPON_ID')
    expect(offers).toContain(".eq('status', 'accepted')")
    expect(offers).toContain('link.role_accepted_at?.[role]')
    expect(offers).toContain(".eq('outcome', 'handled')")
    expect(offers).toContain('getTeamInviteOfferAcceptedSince()')
  })

  it('shows the Improve offer after an accepted player team link', () => {
    const banner = readFileSync(join(process.cwd(), 'app/components/team-connection-invite.tsx'), 'utf8')
    const page = readFileSync(join(process.cwd(), 'app/team-connections/page.tsx'), 'utf8')

    expect(banner).toContain('offers.player')
    expect(page).toContain('acceptedPlayerLinks')
    expect(page).toContain('offers.player.label')
    expect(page).toContain('aria-label="Improve recommendation"')
  })

  it('shows a clear multi-role update instead of replacing the player link', () => {
    const banner = readFileSync(join(process.cwd(), 'app/components/team-connection-invite.tsx'), 'utf8')
    const route = readFileSync(join(process.cwd(), 'app/api/team-connections/route.ts'), 'utf8')

    expect(banner).toContain('Team role update')
    expect(banner).toContain('Link both roles')
    expect(banner).toContain('Your existing team link stays in place.')
    expect(route).toContain("existing?.status === 'accepted'")
    expect(route).toContain('declined_roles: declinedRoles')
  })

  it('shows accepted roster links directly in My Lab without requiring match history', () => {
    const myLab = readFileSync(join(process.cwd(), 'app/mylab/page.tsx'), 'utf8')

    expect(myLab).toContain('fetchTeamConnections(accessToken)')
    expect(myLab).toContain("connection.status === 'accepted' && connection.roles.includes('player')")
    expect(myLab).toContain('aria-label="Teams linked to My Lab"')
    expect(myLab).toContain('Your roster link and player tools now use the same team context.')
    expect(myLab).toContain('buildTeamConnectionHref(connection)')
    expect(myLab).toContain('buildTeamConnectionCaptainHref(connection)')
    expect(myLab).toContain("action: 'set_default'")
    expect(myLab).toContain('findNextTeamMatch(connection, matches)')
  })

  it('uses one disappearing setup checklist and does not label an empty rating as verified', () => {
    const checklist = readFileSync(join(process.cwd(), 'app/components/tennis-setup-checklist.tsx'), 'utf8')
    const profile = readFileSync(join(process.cwd(), 'app/profile/page.tsx'), 'utf8')

    expect(checklist).toContain("if (nextIndex === -1) return null")
    expect(checklist).toContain('Step {nextIndex + 1} of {steps.length}')
    expect(profile).toContain('hasRatingIdentity ? <div')
    expect(profile).toContain("? ''")
  })
})
