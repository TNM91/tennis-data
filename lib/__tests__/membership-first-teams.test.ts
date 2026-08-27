import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildTeamConnections } from '../team-profile-links'

const teamsHub = readFileSync(join(process.cwd(), 'app/compete/teams/page.tsx'), 'utf8')
const teamPage = readFileSync(join(process.cwd(), 'app/teams/[team]/page.tsx'), 'utf8')
const teamRoom = readFileSync(join(process.cwd(), 'app/team-room/page.tsx'), 'utf8')
const teamRoomApi = readFileSync(join(process.cwd(), 'app/api/team-rooms/route.ts'), 'utf8')
const portal = readFileSync(join(process.cwd(), 'app/components/portal-tool-bar.tsx'), 'utf8')

describe('membership-first Teams experience', () => {
  it('makes linked Teams and Team Chat a Free destination', () => {
    expect(portal).toContain("label: 'Teams'")
    expect(portal).toContain("route: '/compete/teams'")
    expect(portal).toContain("title: 'Open my teams'")
    expect(teamsHub).toContain('fetchTeamConnections(accessToken, { force: connectionRefresh > 0, userId })')
    expect(teamsHub).toContain('Register to access your teams.')
    expect(teamsHub).toContain('Team access is included.')
    expect(teamsHub).toContain('buildTeamRoomHref({')
  })

  it('gives guests registration and keeps paid tools additive', () => {
    expect(teamRoom).toContain('Register to access your teams.')
    expect(teamRoom).toContain('Register Free')
    expect(teamPage).toContain('isLinkedTeamMember ? (')
    expect(teamPage).toContain('access.canUseAdvancedPlayerInsights')
    expect(teamPage).toContain('canManageThisTeam ?')
    expect(teamPage).toContain('isCaptainTeamConnection(linkedTeamConnection.roles)')
  })

  it('keeps the Teams phone hierarchy short and wrap-safe', () => {
    expect(teamsHub).toContain('showGenericSupport={false}')
    expect(teamsHub).toContain('Find or manage a team')
    expect(teamsHub).toContain('More team options')
    expect(teamsHub).toContain("gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'")
    expect(teamsHub).toContain('rowMetaChipStyle')
    expect(teamsHub).toContain('teamFactValueStyle')
    expect(teamsHub).toContain('teamRowActionMobileStyle')
    expect(teamsHub).toContain('Explore public teams now.')
    expect(teamsHub).not.toContain('Your private team spaces start with a Free account.')
  })

  it('enforces Team Chat membership on the server before service-role access', () => {
    expect(teamRoomApi).toContain('const auth = await getTeamRoomAuth(request)')
    expect(teamRoomApi).toContain('loadAcceptedTeamLinks(auth.service, auth.userId)')
    expect(teamRoomApi).toContain(".eq('profile_user_id', userId)")
    expect(teamRoomApi).toContain("message: 'This team is not linked to your profile.'")
    expect(teamRoomApi).toContain('syncTeamRoomParticipants(auth.service, conversation.id, selected)')
    expect(teamRoomApi).toContain("message: 'You no longer have access to this Team Chat.'")
  })

  it('retains every accepted USTA or TIQ team for one account', () => {
    const result = buildTeamConnections({
      savedLinks: [
        { id: 'usta', team_name: 'Baseline Aces', league_name: 'USTA 18+', flight: '4.0', team_role: 'player', status: 'accepted' },
        { id: 'tiq', team_name: 'Friday Rally', league_name: 'TIQ Summer', flight: 'Open', team_role: 'captain', status: 'accepted' },
      ],
    })

    expect(result.connections).toHaveLength(2)
    expect(result.connections).toContainEqual(expect.objectContaining({ teamName: 'Baseline Aces', roles: ['player'] }))
    expect(result.connections).toContainEqual(expect.objectContaining({ teamName: 'Friday Rally', roles: ['captain'] }))
  })
})
