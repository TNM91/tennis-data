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

  it('makes an approved TIQ team entry a durable My Teams connection', () => {
    const route = readFileSync(join(process.cwd(), 'app/api/team-connections/route.ts'), 'utf8')
    const leaguePage = readFileSync(join(process.cwd(), 'app/explore/leagues/tiq/[league]/page.tsx'), 'utf8')
    const client = readFileSync(join(process.cwd(), 'lib/team-profile-links-client.ts'), 'utf8')

    expect(route).toContain('syncOwnedActiveTiqTeamEntries')
    expect(route).toContain(".from('tiq_team_league_entries')")
    expect(route).toContain(".eq('entry_status', 'active')")
    expect(route).toContain("source_type: 'tiq_entry'")
    expect(route).toContain("team_role: 'captain'")
    expect(route).toContain('await reconcileDefaultTeam(service, userId)')
    expect(leaguePage).toContain('How this becomes your team in TiQ')
    expect(leaguePage).toContain('League Office approves it')
    expect(leaguePage).toContain('It appears in My Teams')
    expect(leaguePage).toContain('If League Office listed it first, request it here to connect it to your account after approval.')
    expect(leaguePage).toContain("if (league.leagueFormat !== 'team' && currentList.some")
    expect(leaguePage).toContain("existingRequest?.entryStatus === 'active'")
    expect(leaguePage).toContain('After League Office approves it, the team appears in My Teams.')
    expect(leaguePage).toContain('createdByUserId === userId')
    expect(leaguePage).toContain('is waiting for League Office approval.')
    expect(leaguePage).toContain('is ready in My Teams.')
    expect(leaguePage).toContain('Open My Teams')
    expect(leaguePage).toContain('Add another team')
    expect(leaguePage).toContain('only when you manage a second team in this league.')
    expect(route).toContain("searchParams.get('refresh') === '1'")
    expect(route).toContain('if (!forceRefresh)')
    expect(client).toContain("query.set('refresh', '1')")
  })

  it('rejects an imported opponent team as a Captain connection', () => {
    const route = readFileSync(join(process.cwd(), 'app/api/team-connections/route.ts'), 'utf8')
    const client = readFileSync(join(process.cwd(), 'lib/team-profile-links-client.ts'), 'utf8')

    expect(route).toContain("action === 'accept_import'")
    expect(route).toContain(".eq('submitted_by_user_id', input.userId)")
    expect(route).toContain("batchRow.status !== 'imported' || draftRow.status !== 'imported'")
    expect(route).toContain("payload.draftKind !== 'schedule' && payload.draftKind !== 'team_summary'")
    expect(route).toContain('if (!playsOnTeam)')
    expect(route).toContain('Only a roster that includes your linked player')
    expect(route).toContain("mergeTeamConnectionRoles(")
    expect(route).toContain("playsOnTeam ? ['player'] : []")
    expect(route).toContain("source_type: 'data_assist_import'")
    expect(route).toContain('reconcileDefaultTeam(input.service, input.userId, savedId)')
    expect(client).toContain('acceptCaptainImportConnection')
    expect(client).toContain("action: 'accept_import'")

    const sourceMigration = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260801000900_add_data_assist_team_link_source.sql'),
      'utf8',
    )
    expect(sourceMigration).toContain("'data_assist_import'")
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

  it('takes a freshly imported team directly to its matching review card', () => {
    const page = readFileSync(join(process.cwd(), 'app/team-connections/page.tsx'), 'utf8')
    const dataAssist = readFileSync(join(process.cwd(), 'app/data-assist/page.tsx'), 'utf8')

    expect(dataAssist).toContain('function buildTeamConnectionReviewHref(parsedDraft:')
    expect(dataAssist).toContain("'Review & link this team'")
    expect(dataAssist).toContain('#pending-team-links')
    expect(page).toContain("id=\"pending-team-links\"")
    expect(page).toContain('matchesRequestedTeamScope(connection, requestedScope)')
    expect(page).toContain('Review the highlighted')
    expect(page).toContain('highlightedCardStyle')
  })

  it('confirms a newly linked team and immediately offers the next useful destination', () => {
    const page = readFileSync(join(process.cwd(), 'app/team-connections/page.tsx'), 'utf8')

    expect(page).toContain('const [completedConnection, setCompletedConnection]')
    expect(page).toContain('await reload()')
    expect(page).toContain('aria-label="Team link complete"')
    expect(page).toContain('is now in My Teams.')
    expect(page).toContain('Open My Teams')
    expect(page).toContain('Open My Teams for the roster, schedule, and Team Chat.')
    expect(page).toContain("'Open Captain' : 'Open My Lab'")
  })

  it('keeps the exact team scope when a captain opens their workspace', () => {
    const page = readFileSync(join(process.cwd(), 'app/team-connections/page.tsx'), 'utf8')

    expect(page).toContain("import { buildCaptainScopedHref } from '@/lib/captain-memory'")
    expect(page).toContain('function buildTeamConnectionWorkspaceHref(connection: TeamConnection)')
    expect(page).toContain("return buildCaptainScopedHref('/captain', {")
    expect(page).toContain('team: connection.teamName')
    expect(page).toContain('href={buildTeamConnectionWorkspaceHref(completedConnection)}')
    expect(page).toContain('href={buildTeamConnectionWorkspaceHref(connection)}')
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
    const route = readFileSync(join(process.cwd(), 'app/api/team-connections/route.ts'), 'utf8')

    expect(banner).toContain('offers.player')
    expect(banner).toContain('href={teamRoomHref}')
    expect(banner).toContain('Open Team Chat')
    expect(banner).toContain('!hasRecommendedAccess ? <Link href={tierHref}')
    expect(banner).toContain("onClick={() => setAccepted(null)}")
    expect(page).toContain('acceptedPlayerLinks')
    expect(page).toContain('offers.player.label')
    expect(page).toContain('aria-label="Improve recommendation"')
    expect(page).toContain('fetchTeamConnections(accessToken, { includeOffers: true, userId })')
    expect(banner).toContain('fetchTeamConnections(accessToken, { includeOffers: true })')
    expect(route).toContain("searchParams.get('includeOffers') === '1'")
    expect(route).toContain("console.info('[api/team-connections] loaded'")
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
