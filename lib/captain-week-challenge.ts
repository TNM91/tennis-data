import {
  buildCaptainLevelUpChallenge,
  type CaptainLevelUpChallenge,
} from './captain-level-up-challenge'
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

export type CaptainWeekChallengeFollowUp = {
  challenge: CaptainLevelUpChallenge
  reason: string
  repeatsCurrent: boolean
}

const CAPTAIN_CHALLENGE_FOLLOW_UPS: Record<string, string> = {
  'rhythm-builder': 'consistency-builder',
  'consistency-builder': 'point-start-routine',
  'point-start-routine': 'match-day-routine',
  'match-day-routine': 'rhythm-builder',
  'doubles-readiness': 'point-start-routine',
}

const CAPTAIN_CHALLENGE_FOLLOW_UP_REASONS: Record<string, string> = {
  'rhythm-builder': 'The team built its starting rhythm. Next, make those habits hold through longer points.',
  'consistency-builder': 'The rally base is set. Next, sharpen the first two shots and pressure-point decisions.',
  'point-start-routine': 'Point starts are clearer. Next, carry that plan into a complete match-day routine.',
  'match-day-routine': 'The match routine is in place. Reset with a short rhythm week before building again.',
  'doubles-readiness': 'Partner jobs are clearer. Next, sharpen serve targets, return jobs, and 30-30 decisions.',
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

export function selectCaptainCompletedWeekChallenge(
  history: CaptainWeekChallengeHistoryItem[],
  matchDate = '',
) {
  const matchDateKey = matchDate.trim().slice(0, 10)
  if (!matchDateKey) return null

  const scheduledMatch = history.find((item) => (
    item.status === 'closed'
    && item.scheduledForDate.trim().slice(0, 10) === matchDateKey
  ))
  if (scheduledMatch) return scheduledMatch

  return history.find((item) => {
    if (item.status !== 'closed' || item.scheduledForDate) return false
    const launchedDate = item.launchedAt.trim().slice(0, 10)
    const closedDate = item.closedAt.trim().slice(0, 10)
    if (!launchedDate || !closedDate) return false
    return launchedDate <= matchDateKey && matchDateKey <= closedDate
  }) ?? null
}

export function recommendCaptainWeekChallengeFollowUp(
  completed: CaptainWeekChallengeHistoryItem,
): CaptainWeekChallengeFollowUp | null {
  const currentChallenge = buildCaptainLevelUpChallenge(completed.challengeId)
  if (!currentChallenge) return null

  const completionRate = completed.connectedCount > 0
    ? completed.completedCount / completed.connectedCount
    : 0
  if (completionRate < 0.6) {
    return {
      challenge: currentChallenge,
      reason: completed.connectedCount > 0
        ? `${completed.completedCount} of ${completed.connectedCount} connected teammates finished. Repeat it once so the habit reaches more of the team.`
        : 'Repeat it after more teammates connect so the team can build the habit together.',
      repeatsCurrent: true,
    }
  }

  const nextChallengeId = CAPTAIN_CHALLENGE_FOLLOW_UPS[completed.challengeId]
  const nextChallenge = buildCaptainLevelUpChallenge(nextChallengeId)
  if (!nextChallenge) return null
  return {
    challenge: nextChallenge,
    reason: CAPTAIN_CHALLENGE_FOLLOW_UP_REASONS[completed.challengeId]
      ?? 'Build on the completed team habit with the next focused challenge.',
    repeatsCurrent: false,
  }
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

export function appendCaptainWeekChallengeRecapToMessage(
  message: string,
  completed: CaptainWeekChallenge | null,
  followUp: CaptainWeekChallengeFollowUp | null,
) {
  const cleanMessage = message.trim()
  if (!completed) return cleanMessage

  const { challenge, history } = completed
  const completion = history.connectedCount > 0
    ? `${history.completedCount} of ${history.connectedCount} connected teammates completed it`
    : 'the team challenge is wrapped'
  const nextStep = followUp
    ? ` Next up: ${followUp.challenge.title}.`
    : ''
  const recapLine = `Team challenge: ${challenge.title} - ${completion}.${nextStep}`
  if (cleanMessage.includes(recapLine)) return cleanMessage
  return cleanMessage ? `${cleanMessage}\n\n${recapLine}` : recapLine
}
