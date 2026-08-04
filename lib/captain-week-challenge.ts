import type { CaptainLevelUpChallenge } from './captain-level-up-challenge'
import { buildTeamRoomHref, type TeamRoomScope } from './team-room'

export type CaptainWeekChallengeHistoryItem = {
  messageId: string
  challengeId: string
  title: string
  focus: string
  status: 'active' | 'scheduled' | 'cancelled' | 'closed'
  scheduledForDate: string
  launchedAt: string
  closedAt: string
  completedCount: number
  connectedCount: number
}

export type CaptainWeekChallenge = {
  challenge: CaptainLevelUpChallenge
  history: CaptainWeekChallengeHistoryItem
  teamRoomHref: string
}

export function selectCaptainWeekChallenge(
  history: CaptainWeekChallengeHistoryItem[],
  matchDate = '',
) {
  const matchDateKey = matchDate.trim().slice(0, 10)
  const scheduled = matchDateKey
    ? history.find((item) => (
        item.status === 'scheduled'
        && item.scheduledForDate.trim().slice(0, 10) === matchDateKey
      ))
    : null

  return scheduled ?? history.find((item) => item.status === 'active') ?? null
}

export function buildCaptainWeekChallengeHistoryHref(scope: Partial<TeamRoomScope>) {
  const teamRoomHref = buildTeamRoomHref(scope)
  const separator = teamRoomHref.includes('?') ? '&' : '?'
  return `${teamRoomHref.replace('/team-room', '/api/team-rooms')}${separator}levelUpHistory=1`
}

export function buildCaptainWeekChallengeTeamRoomHref(
  scope: Partial<TeamRoomScope>,
  messageId: string,
) {
  return buildTeamRoomHref({ ...scope, messageId })
}

export function appendCaptainWeekChallengeToMessage(
  message: string,
  challenge: CaptainLevelUpChallenge | null,
) {
  const cleanMessage = message.trim()
  if (!challenge) return cleanMessage

  const challengeLine = `Team goal: ${challenge.title} - ${challenge.focus}.`
  if (cleanMessage.includes(challengeLine)) return cleanMessage
  return cleanMessage ? `${cleanMessage}\n\n${challengeLine}` : challengeLine
}
