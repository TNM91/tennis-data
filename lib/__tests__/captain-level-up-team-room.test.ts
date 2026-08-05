import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const captainSource = readFileSync(join(process.cwd(), 'app/captain/page.tsx'), 'utf8')
const teamRoomSource = readFileSync(join(process.cwd(), 'app/team-room/page.tsx'), 'utf8')
const teamRoomApiSource = readFileSync(join(process.cwd(), 'app/api/team-rooms/route.ts'), 'utf8')
const homeSource = readFileSync(join(process.cwd(), 'app/page.tsx'), 'utf8')
const myLabSource = readFileSync(join(process.cwd(), 'app/mylab/page.tsx'), 'utf8')
const activeChallengeSource = readFileSync(join(process.cwd(), 'app/components/active-team-challenge-card.tsx'), 'utf8')
const activeChallengeStyles = readFileSync(join(process.cwd(), 'app/components/active-team-challenge-card.module.css'), 'utf8')

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
    expect(teamRoomSource).toContain('Your progress')
    expect(teamRoomSource).toContain('Continue challenge')
    expect(teamRoomSource).toContain('Mark challenge complete')
    expect(teamRoomSource).toContain("action: 'complete_level_up_challenge'")
    expect(teamRoomApiSource).toContain("action === 'complete_level_up_challenge'")
    expect(teamRoomApiSource).toContain('completedCardIdsByPlayer.get(userId)')
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
    expect(teamRoomApiSource).toContain("isCancelledSchedule ? 'cancelled' : row.id === activeMessageId ? 'active' : 'closed'")
    expect(teamRoomApiSource).not.toContain('proof,score,notes')
    expect(captainSource).toContain('Team challenge history')
    expect(captainSource).toContain('handleRunLevelUpChallenge')
    expect(captainSource).toContain('Run again')
    expect(captainSource).toContain('levelUpChallengeHistoryRequestRef')
    expect(captainSource).toContain('Team totals only. Player proof, scores, and notes stay private.')
  })

  it('schedules a challenge for the selected match week without making it active early', () => {
    expect(teamRoomApiSource).toContain("action === 'schedule_level_up_challenge'")
    expect(teamRoomApiSource).toContain("action === 'activate_level_up_challenge'")
    expect(teamRoomApiSource).toContain("action === 'cancel_level_up_challenge'")
    expect(teamRoomApiSource).toContain("challengeStatus: 'scheduled'")
    expect(teamRoomApiSource).toContain('scheduledForDate')
    expect(teamRoomApiSource).toContain("!['closed', 'scheduled'].includes")
    expect(captainSource).toContain("This week&apos;s challenge")
    expect(captainSource).toContain('Schedule for week')
    expect(captainSource).toContain('Start challenge')
    expect(captainSource).toContain('Start now')
    expect(captainSource).toContain('Cancel')
    expect(teamRoomSource).toContain('Scheduled team challenge')
    expect(teamRoomSource).toContain('The captain will start this challenge when match-week preparation begins.')
    expect(teamRoomSource).toContain('This challenge was removed before it started.')
  })

  it('offers one readiness-based challenge without competing with an existing week challenge', () => {
    expect(captainSource).toContain('recommendCaptainLevelUpChallenge')
    expect(captainSource).toContain('Recommended for this week')
    expect(captainSource).toContain('showRecommendedLevelUpChallenge')
    expect(captainSource).toContain('!hasActiveLevelUpChallengeHistory')
    expect(captainSource).toContain('!scheduledLevelUpChallengeForWeek')
    expect(captainSource).toContain('Review cards')
  })

  it('puts the active team challenge on home and My Lab with a one-tap private resume', () => {
    expect(homeSource).toContain('<ActiveTeamChallengeCard />')
    expect(myLabSource).toContain('<ActiveTeamChallengeCard />')
    expect(activeChallengeSource).toContain("fetch('/api/team-rooms?summary=1'")
    expect(activeChallengeSource).toContain("challenge.completed ? 'Open Team Hub' : 'Resume challenge'")
    expect(activeChallengeSource).toContain('challenge.resumeHref')
    expect(activeChallengeSource).toContain('role="progressbar"')
    expect(activeChallengeStyles).toContain('@media (max-width: 560px)')
  })

  it('returns only current-player challenge progress in the lightweight Team Room summary', () => {
    expect(teamRoomApiSource).toContain('activeChallenge: TeamRoomActiveChallengeSummary | null')
    expect(teamRoomApiSource).toContain('completionResult.completedCardIdsByPlayer.get(userId)')
    expect(teamRoomApiSource).toContain('buildCaptainLevelUpCardHref(nextCardId)')
    expect(teamRoomApiSource).toContain('activeChallenge,')
    expect(activeChallengeSource).not.toContain('proof')
    expect(activeChallengeSource).not.toContain('score')
    expect(activeChallengeSource).not.toContain('notes')
  })
})
