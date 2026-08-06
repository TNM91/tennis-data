export const TEAM_ROOM_ARRIVAL_STATUSES = ['on_my_way', 'here', 'running_late'] as const

export type TeamRoomArrivalStatus = (typeof TEAM_ROOM_ARRIVAL_STATUSES)[number]

export type TeamRoomArrivalCheckIn = {
  profileId: string
  playerName: string
  courtLabel: string
  status: TeamRoomArrivalStatus
  updatedAt: string
}

export type TeamRoomArrivalCourt = {
  label: string
  players: Array<{
    name: string
    status: TeamRoomArrivalStatus | null
    updatedAt: string
  }>
}

type LineupRow = { label: string; players: string[] }

export function isTeamRoomArrivalStatus(value: unknown): value is TeamRoomArrivalStatus {
  return typeof value === 'string' && TEAM_ROOM_ARRIVAL_STATUSES.includes(value as TeamRoomArrivalStatus)
}

export function findTeamRoomAssignedCourt(lineup: LineupRow[], names: Array<string | null | undefined>) {
  const candidateKeys = new Set(names.flatMap(personKeys).filter(Boolean))
  if (!candidateKeys.size) return null

  for (const [index, court] of lineup.entries()) {
    const playerName = court.players.find((player) => personKeys(player).some((key) => candidateKeys.has(key)))
    if (playerName) {
      return {
        courtLabel: court.label.trim() || `Court ${index + 1}`,
        playerName: playerName.trim(),
      }
    }
  }
  return null
}

export function readTeamRoomArrivalCheckIns(value: unknown): TeamRoomArrivalCheckIn[] {
  if (!Array.isArray(value)) return []
  const byProfileId = new Map<string, TeamRoomArrivalCheckIn>()
  for (const item of value.slice(-100)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const row = item as Record<string, unknown>
    const profileId = clean(row.profileId, 120)
    const playerName = clean(row.playerName, 120)
    const courtLabel = clean(row.courtLabel, 80)
    const updatedAt = clean(row.updatedAt, 80)
    if (!profileId || !playerName || !courtLabel || !isTeamRoomArrivalStatus(row.status)) continue
    byProfileId.set(profileId, { profileId, playerName, courtLabel, status: row.status, updatedAt })
  }
  return [...byProfileId.values()]
}

export function upsertTeamRoomArrivalCheckIn(
  value: unknown,
  checkIn: TeamRoomArrivalCheckIn,
): TeamRoomArrivalCheckIn[] {
  return [
    ...readTeamRoomArrivalCheckIns(value).filter((item) => item.profileId !== checkIn.profileId),
    checkIn,
  ].slice(-100)
}

export function buildTeamRoomArrivalCourts(
  lineup: LineupRow[],
  checkIns: TeamRoomArrivalCheckIn[],
): TeamRoomArrivalCourt[] {
  const byPlayer = new Map(checkIns.map((item) => [normalizePerson(item.playerName), item] as const))
  return lineup.map((court, index) => ({
    label: court.label.trim() || `Court ${index + 1}`,
    players: court.players.map((name) => {
      const checkIn = byPlayer.get(normalizePerson(name))
      return { name, status: checkIn?.status || null, updatedAt: checkIn?.updatedAt || '' }
    }),
  })).sort((left, right) => arrivalRisk(right) - arrivalRisk(left))
}

export function teamRoomArrivalStatusLabel(status: TeamRoomArrivalStatus | null) {
  if (status === 'here') return 'Here'
  if (status === 'on_my_way') return 'On my way'
  if (status === 'running_late') return 'Running late'
  return 'Waiting'
}

export function findTeamRoomLateArrival(courts: TeamRoomArrivalCourt[], focusedCourtLabel = '') {
  const focusedKey = normalizePerson(focusedCourtLabel)
  const focusedCourt = focusedKey
    ? courts.find((court) => normalizePerson(court.label) === focusedKey)
    : null
  const court = focusedCourt?.players.some((player) => player.status === 'running_late')
    ? focusedCourt
    : courts.find((item) => item.players.some((player) => player.status === 'running_late'))
  if (!court) return null
  const player = court.players.find((item) => item.status === 'running_late')
  return player ? { courtLabel: court.label, playerName: player.name } : null
}

export function buildTeamRoomLateArrivalBuilderHref(
  baseHref: string,
  lateArrival: { courtLabel: string; playerName: string },
) {
  const url = new URL(baseHref, 'https://tenaceiq.local')
  url.searchParams.set('source', 'team_room')
  url.searchParams.set('availability', 'replies')
  url.searchParams.set('mode', 'backup')
  url.searchParams.set('replace', lateArrival.playerName)
  url.searchParams.set('court', lateArrival.courtLabel)
  url.hash = 'captain-lineup-courts'
  return `${url.pathname}${url.search}${url.hash}`
}

export function buildTeamRoomLineupCourtHref(baseHref: string, courtLabel: string) {
  const url = new URL(baseHref, 'https://tenaceiq.local')
  url.searchParams.set('source', 'team_room')
  url.searchParams.set('court', courtLabel)
  url.hash = 'captain-lineup-courts'
  return `${url.pathname}${url.search}${url.hash}`
}

function arrivalRisk(court: TeamRoomArrivalCourt) {
  if (court.players.some((player) => player.status === 'running_late')) return 3
  if (court.players.some((player) => player.status === null)) return 2
  if (court.players.some((player) => player.status === 'on_my_way')) return 1
  return 0
}

function personKeys(value: string | null | undefined) {
  if (!value?.trim()) return []
  const keys = [normalizePerson(value)]
  if (value.includes(',')) {
    const [last, ...first] = value.split(',')
    keys.push(normalizePerson(`${first.join(' ')} ${last}`))
  }
  return [...new Set(keys.filter(Boolean))]
}

function normalizePerson(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function clean(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}
