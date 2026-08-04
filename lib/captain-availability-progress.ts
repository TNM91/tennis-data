export type CaptainAvailabilityInvite = {
  playerId: string
  playerName: string
  requestUrl?: string
}

export type CaptainAvailabilityResponse = {
  player_id: string | null
  player_name: string
  match_date: string
  status: string
  responded_at?: string
}

export type CaptainAvailabilityProgressPerson = {
  id: string
  name: string
  status: string
}

export function buildCaptainAvailabilityProgress(input: {
  matchDate: string
  invites: CaptainAvailabilityInvite[]
  responses: CaptainAvailabilityResponse[]
}) {
  const matchDate = input.matchDate.slice(0, 10)
  const responseByPlayer = new Map<string, CaptainAvailabilityResponse>()

  for (const response of input.responses) {
    if (response.match_date.slice(0, 10) !== matchDate) continue
    const keys = [response.player_id?.trim() || '', response.player_name.trim().toLowerCase()].filter(Boolean)
    for (const key of keys) responseByPlayer.set(key, response)
  }

  const people: CaptainAvailabilityProgressPerson[] = input.invites.map((invite, index) => {
    const playerId = invite.playerId.trim()
    const playerName = invite.playerName.trim()
    const response = responseByPlayer.get(playerId) ?? responseByPlayer.get(playerName.toLowerCase())
    return {
      id: playerId || playerName.toLowerCase() || `player-${index + 1}`,
      name: playerName || `Player ${index + 1}`,
      status: response?.status.trim().toLowerCase() || '',
    }
  })
  const unansweredNames = people.filter((person) => !person.status).map((person) => person.name)

  return {
    people,
    invitedCount: people.length,
    answeredCount: people.length - unansweredNames.length,
    pendingCount: unansweredNames.length,
    unansweredNames,
  }
}
