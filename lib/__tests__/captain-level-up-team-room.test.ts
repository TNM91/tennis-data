import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const captainSource = readFileSync(join(process.cwd(), 'app/captain/page.tsx'), 'utf8')
const teamRoomSource = readFileSync(join(process.cwd(), 'app/team-room/page.tsx'), 'utf8')
const teamRoomApiSource = readFileSync(join(process.cwd(), 'app/api/team-rooms/route.ts'), 'utf8')

describe('Captain Level Up Team Room challenge', () => {
  it('shares the selected challenge and loads real aggregate progress', () => {
    expect(captainSource).toContain("action: 'post_level_up_challenge'")
    expect(captainSource).toContain('loadLevelUpChallengeProgress')
    expect(captainSource).toContain('getCaptainLevelUpAggregateCompletionLabel(levelUpChallengeProgress)')
    expect(captainSource).toContain('Share with team')
    expect(captainSource).not.toContain('8 of 12 players completed match-day routine')
  })

  it('keeps the launch in Team Room and returns aggregate completion only', () => {
    expect(teamRoomApiSource).toContain("action === 'post_level_up_challenge'")
    expect(teamRoomApiSource).toContain('loadTeamLevelUpChallengeProgress')
    expect(teamRoomApiSource).toContain(".from('level_up_sessions')")
    expect(teamRoomApiSource).toContain(".from('team_room_message_reactions')")
    expect(teamRoomApiSource).toContain('getCaptainLevelUpCompletedPlayerIds')
    expect(teamRoomApiSource).not.toContain('shared_with_coach,session_json')
  })

  it('renders every challenge card as a player action with a private completion receipt', () => {
    expect(teamRoomSource).toContain('function LevelUpChallengeCard')
    expect(teamRoomSource).toContain('buildCaptainLevelUpCardHref(card.id)')
    expect(teamRoomSource).toContain('Mark all complete')
    expect(teamRoomSource).toContain('Your proof, scores, and notes stay private.')
  })
})
