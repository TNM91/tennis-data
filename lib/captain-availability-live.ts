export const CAPTAIN_AVAILABILITY_REFRESH_MS = 15_000
export const CAPTAIN_AVAILABILITY_UPDATE_NOTICE_MS = 6_000
const PLAYER_NAME_SEPARATOR_PATTERN = /[^a-z0-9]+/g

export type CaptainAvailabilityLiveResponse = {
  player_id?: string | null
  player_name?: string | null
  match_date?: string | null
  status?: string | null
  responded_at?: string | null
}

export type CaptainAvailabilityLineupRow = {
  courtLabel: string
  players: string[]
}

export function buildCaptainAvailabilityResponseSignature(
  responses: CaptainAvailabilityLiveResponse[],
) {
  return responses
    .map((response) => [
      response.player_id?.trim() || '',
      response.player_name?.trim().toLowerCase() || '',
      response.status?.trim().toLowerCase() || '',
      response.responded_at?.trim() || '',
    ].join(':'))
    .sort()
    .join('|')
}

function getResponseKey(response: CaptainAvailabilityLiveResponse) {
  const playerKey = response.player_id?.trim().toLowerCase()
    || response.player_name?.trim().toLowerCase().replace(PLAYER_NAME_SEPARATOR_PATTERN, ' ').trim()
    || ''
  return `${playerKey}:${response.match_date?.trim().slice(0, 10) || ''}`
}

function isLineupRisk(status: string | null | undefined) {
  const normalized = status?.trim().toLowerCase() || ''
  return normalized === 'maybe'
    || normalized === 'limited'
    || normalized === 'unavailable'
    || normalized === 'no'
    || normalized === 'out'
}

export function findLatestCaptainAvailabilityRiskChange(
  previousResponses: CaptainAvailabilityLiveResponse[],
  nextResponses: CaptainAvailabilityLiveResponse[],
) {
  const previousByKey = new Map(previousResponses.map((response) => [getResponseKey(response), response]))
  return nextResponses
    .filter((response) => {
      if (!isLineupRisk(response.status)) return false
      const previous = previousByKey.get(getResponseKey(response))
      return !previous
        || previous.status?.trim().toLowerCase() !== response.status?.trim().toLowerCase()
        || previous.responded_at?.trim() !== response.responded_at?.trim()
    })
    .sort((left, right) => (
      new Date(right.responded_at || 0).getTime() - new Date(left.responded_at || 0).getTime()
    ))[0] ?? null
}

export function findLatestCaptainAvailabilityLineupRisk(
  responses: CaptainAvailabilityLiveResponse[],
  lineup: CaptainAvailabilityLineupRow[],
) {
  const courtByPlayer = new Map<string, string>()
  for (const court of lineup) {
    for (const player of court.players) {
      const playerKey = player.trim().toLowerCase().replace(PLAYER_NAME_SEPARATOR_PATTERN, ' ').trim()
      if (playerKey && !courtByPlayer.has(playerKey)) courtByPlayer.set(playerKey, court.courtLabel)
    }
  }

  const response = responses
    .filter((candidate) => {
      if (!isLineupRisk(candidate.status)) return false
      const playerKey = candidate.player_name?.trim().toLowerCase().replace(PLAYER_NAME_SEPARATOR_PATTERN, ' ').trim() || ''
      return Boolean(playerKey && courtByPlayer.has(playerKey))
    })
    .sort((left, right) => (
      new Date(right.responded_at || 0).getTime() - new Date(left.responded_at || 0).getTime()
    ))[0] ?? null

  if (!response) return null
  const playerKey = response.player_name?.trim().toLowerCase().replace(PLAYER_NAME_SEPARATOR_PATTERN, ' ').trim() || ''
  return {
    response,
    courtLabel: courtByPlayer.get(playerKey) || '',
  }
}
