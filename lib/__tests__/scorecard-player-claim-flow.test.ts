import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const matchPage = readFileSync(join(process.cwd(), 'app/matches/[id]/page.tsx'), 'utf8')
const profilePage = readFileSync(join(process.cwd(), 'app/profile/page.tsx'), 'utf8')
const signupRoute = readFileSync(join(process.cwd(), 'app/api/auth/signup/route.ts'), 'utf8')

describe('shared scorecard player claim flow', () => {
  it('offers a player-specific signup path and preselects the validated player after confirmation', () => {
    expect(matchPage).toContain('buildScorecardPlayerClaimHref(player.id, line.id)')
    expect(matchPage).toContain('buildScorecardPlayerClaimHref(player.id, match.id)')
    expect(matchPage).toContain('Connect as {player.name}')
    expect(signupRoute).toContain('scorecard_claim_player_id: scorecardClaimPlayerId')
    expect(signupRoute).toContain('scorecardClaimPlayerId }')
    expect(profilePage).toContain('getScorecardClaimPlayerId(`/profile${window.location.search}`)')
    expect(profilePage).toContain('playerIds.map((playerId) => loadProfilePlayers({ playerId }))')
    expect(profilePage).toContain("players.eq('id', input.playerId).limit(1)")
    expect(profilePage).toContain('Confirm this is you, then save your player.')
    expect(profilePage).toContain('scorecardClaimPlayerId === nextPlayer.id')
    expect(profilePage).toContain('acquisitionSource: SCORECARD_SIGNUP_SOURCE')
  })

  it('sends signed-in members without a connected player directly to the same profile claim', () => {
    expect(matchPage).toContain('loadUserProfileLink(userId)')
    expect(matchPage).toContain('!data?.linked_player_id && !data?.linked_player_name')
    expect(matchPage).toContain('buildScorecardProfileClaimHref(player.id, line.id)')
    expect(matchPage).toContain('buildScorecardProfileClaimHref(player.id, match.id)')
  })
})
