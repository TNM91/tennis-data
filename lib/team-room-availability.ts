export type TeamRoomAvailabilityInvite = {
  playerId?: string | null
  playerName?: string | null
}

export type TeamRoomAvailabilityResponse = {
  playerId?: string | null
  playerName?: string | null
  matchDate?: string | null
  status?: string | null
  respondedAt?: string | null
}

export type TeamRoomAvailabilitySummary = {
  yes: number
  maybe: number
  no: number
  waiting: number
  total: number
  yesNames: string[]
  waitingNames: string[]
  maybeNames: string[]
  noNames: string[]
  scenarioId: string
}

export function summarizeTeamRoomAvailability(input: {
  invites: TeamRoomAvailabilityInvite[]
  responses: TeamRoomAvailabilityResponse[]
  matchDate: string
  scenarioId?: string | null
}): TeamRoomAvailabilitySummary {
  const invites = dedupeInvites(input.invites)
  const latestResponseByInvite = new Map<string, TeamRoomAvailabilityResponse>()
  const inviteKeyByPlayerId = new Map(
    invites.flatMap((invite) => invite.playerId ? [[normalizeId(invite.playerId), invite.key] as const] : [])
  )

  for (const response of input.responses) {
    if (response.matchDate && response.matchDate.slice(0, 10) !== input.matchDate.slice(0, 10)) continue
    const key = (response.playerId && inviteKeyByPlayerId.get(normalizeId(response.playerId)))
      || normalizeName(response.playerName)
    if (!key || !invites.some((invite) => invite.key === key)) continue
    const current = latestResponseByInvite.get(key)
    if (!current || responseTime(response.respondedAt) >= responseTime(current.respondedAt)) {
      latestResponseByInvite.set(key, response)
    }
  }

  let yes = 0
  let maybe = 0
  let no = 0
  const yesNames: string[] = []
  const waitingNames: string[] = []
  const maybeNames: string[] = []
  const noNames: string[] = []

  for (const invite of invites) {
    const status = normalizeStatus(latestResponseByInvite.get(invite.key)?.status)
    if (status === 'yes') {
      yes += 1
      yesNames.push(invite.playerName)
    }
    else if (status === 'maybe') {
      maybe += 1
      maybeNames.push(invite.playerName)
    } else if (status === 'no') {
      no += 1
      noNames.push(invite.playerName)
    } else {
      waitingNames.push(invite.playerName)
    }
  }

  return {
    yes,
    maybe,
    no,
    waiting: waitingNames.length,
    total: invites.length,
    yesNames,
    waitingNames,
    maybeNames,
    noNames,
    scenarioId: cleanText(input.scenarioId),
  }
}

function dedupeInvites(invites: TeamRoomAvailabilityInvite[]) {
  const byKey = new Map<string, { key: string; playerId: string; playerName: string }>()
  for (const invite of invites) {
    const playerName = cleanText(invite.playerName)
    const key = normalizeName(playerName)
    if (!key || byKey.has(key)) continue
    byKey.set(key, {
      key,
      playerId: cleanText(invite.playerId),
      playerName,
    })
  }
  return Array.from(byKey.values())
}

function normalizeStatus(value: unknown): 'yes' | 'maybe' | 'no' | 'waiting' {
  const status = cleanText(value).toLowerCase()
  if (['available', 'yes', 'in'].includes(status)) return 'yes'
  if (['maybe', 'limited', 'tentative'].includes(status)) return 'maybe'
  if (['unavailable', 'no', 'out'].includes(status)) return 'no'
  return 'waiting'
}

function normalizeName(value: unknown) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function normalizeId(value: unknown) {
  return cleanText(value).toLowerCase()
}

function responseTime(value: unknown) {
  const time = new Date(cleanText(value) || 0).getTime()
  return Number.isFinite(time) ? time : 0
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}
