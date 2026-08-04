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

  it('pins the active challenge and lets captains remind only incomplete connected teammates', () => {
    expect(teamRoomApiSource).toContain('selectActiveCaptainLevelUpChallenge')
    expect(teamRoomApiSource).toContain("action === 'remind_level_up_challenge'")
    expect(teamRoomApiSource).toContain('!challengeResult.completedIds.has(member.id)')
    expect(teamRoomApiSource).toContain('incompleteMembers.filter((member) => member.muted !== true)')
    expect(teamRoomApiSource).toContain('sendTeamLevelUpChallengeReminders')
    expect(teamRoomApiSource).toContain('closeOpenLevelUpChallenges')
    expect(teamRoomSource).toContain('room.activeLevelUpChallengeId')
    expect(teamRoomSource).toContain('Remind incomplete')
    expect(teamRoomSource).toContain('End challenge')
  })

  it('shows compact aggregate challenge history and can restart an ended challenge', () => {
    expect(teamRoomApiSource).toContain("url.searchParams.get('levelUpHistory') === '1'")
    expect(teamRoomApiSource).toContain('loadTeamLevelUpChallengeHistory')
    expect(teamRoomApiSource).toContain(".select('player_user_id,focus_id,drill_title,completed_at')")
    expect(teamRoomApiSource).toContain('getCaptainLevelUpCompletedPlayerIdsForRun')
    expect(teamRoomApiSource).toContain("status: row.id === activeMessageId ? 'active' : 'closed'")
    expect(teamRoomApiSource).not.toContain('proof,score,notes')
    expect(captainSource).toContain('Team challenge history')
    expect(captainSource).toContain('handleRunLevelUpChallenge')
    expect(captainSource).toContain('Run again')
    expect(captainSource).toContain('levelUpChallengeHistoryRequestRef')
    expect(captainSource).toContain('Team totals only. Player proof, scores, and notes stay private.')
  })
})
