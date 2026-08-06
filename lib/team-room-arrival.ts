export const TEAM_ROOM_ARRIVAL_STATUSES = ['on_my_way', 'here', 'running_late'] as const
export const TEAM_ROOM_ARRIVAL_TEXT_RETURN_KEY = 'tiq:team-room:arrival-text-return:v1'

export type TeamRoomArrivalStatus = (typeof TEAM_ROOM_ARRIVAL_STATUSES)[number]

export type TeamRoomArrivalCheckIn = {
  profileId: string
  playerName: string
  courtLabel: string
  status: TeamRoomArrivalStatus
  updatedAt: string
  setByCaptain?: boolean
}

export type TeamRoomArrivalCourt = {
  label: string
  players: Array<{
    name: string
    status: TeamRoomArrivalStatus | null
    updatedAt: string
    setByCaptain: boolean
  }>
}

export type TeamRoomArrivalPriority = {
  kind: 'late' | 'waiting' | 'on_way' | 'ready' | 'empty'
  title: string
  detail: string
  names: string[]
  courtLabel: string
  playerName: string
}

export type TeamRoomArrivalContact = {
  name: string
  phone: string
  joined: boolean
}

export type TeamRoomArrivalOutreach = {
  playerName: string
  courtLabel: string
  contactedAt: string
  contactedByUserId: string
}

export type TeamRoomArrivalTextReturn = {
  roomId: string
  messageId: string
  playerName: string
  courtLabel: string
  createdAt: string
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
    const checkIn: TeamRoomArrivalCheckIn = {
      profileId,
      playerName,
      courtLabel,
      status: row.status,
      updatedAt,
    }
    if (row.setByCaptain === true) checkIn.setByCaptain = true
    byProfileId.set(profileId, checkIn)
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

export function clearTeamRoomArrivalCheckInsForPlayer(value: unknown, playerName: string) {
  const targetKeys = new Set(personKeys(playerName))
  if (!targetKeys.size) return readTeamRoomArrivalCheckIns(value)
  return readTeamRoomArrivalCheckIns(value).filter((checkIn) =>
    !personKeys(checkIn.playerName).some((key) => targetKeys.has(key)),
  )
}

export function findTeamRoomArrivalContact(
  playerName: string,
  contacts: TeamRoomArrivalContact[],
) {
  const playerKeys = new Set(personKeys(playerName))
  if (!playerKeys.size) return null
  return contacts.find((contact) =>
    personKeys(contact.name).some((key) => playerKeys.has(key)),
  ) || null
}

export function readTeamRoomArrivalOutreach(value: unknown): TeamRoomArrivalOutreach[] {
  if (!Array.isArray(value)) return []
  const outreach: TeamRoomArrivalOutreach[] = []
  for (const item of value.slice(-100)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const row = item as Record<string, unknown>
    const playerName = clean(row.playerName, 120)
    const courtLabel = clean(row.courtLabel, 80)
    const contactedAt = clean(row.contactedAt, 80)
    const contactedByUserId = clean(row.contactedByUserId, 120)
    if (!playerName || !courtLabel || !contactedAt || !contactedByUserId) continue
    const contact = { playerName, courtLabel, contactedAt, contactedByUserId }
    const existingIndex = outreach.findIndex((saved) => samePerson(saved.playerName, playerName))
    if (existingIndex >= 0) outreach.splice(existingIndex, 1)
    outreach.push(contact)
  }
  return outreach
}

export function findTeamRoomArrivalOutreach(playerName: string, value: unknown) {
  return readTeamRoomArrivalOutreach(value).find((outreach) => samePerson(outreach.playerName, playerName)) || null
}

export function upsertTeamRoomArrivalOutreach(
  value: unknown,
  outreach: TeamRoomArrivalOutreach,
): TeamRoomArrivalOutreach[] {
  return [
    ...readTeamRoomArrivalOutreach(value).filter((item) => !samePerson(item.playerName, outreach.playerName)),
    outreach,
  ].slice(-100)
}

export function buildTeamRoomArrivalSmsHref(phone: string, body: string, isIOS = false) {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 7 || !body.trim()) return ''
  const recipient = phone.trim().startsWith('+') ? `+${digits}` : digits
  return `sms:${recipient}${isIOS ? '&' : '?'}body=${encodeURIComponent(body.trim())}`
}

export function readTeamRoomArrivalTextReturn(value: unknown, now = Date.now()): TeamRoomArrivalTextReturn | null {
  let parsed: unknown = value
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    } catch {
      return null
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const row = parsed as Record<string, unknown>
  const roomId = clean(row.roomId, 120)
  const messageId = clean(row.messageId, 120)
  const playerName = clean(row.playerName, 120)
  const courtLabel = clean(row.courtLabel, 80)
  const createdAt = clean(row.createdAt, 80)
  const createdAtMs = new Date(createdAt).getTime()
  const maxAgeMs = 2 * 60 * 60 * 1000
  if (
    !roomId
    || !messageId
    || !playerName
    || !courtLabel
    || !Number.isFinite(createdAtMs)
    || createdAtMs > now + 5 * 60 * 1000
    || now - createdAtMs > maxAgeMs
  ) return null
  return { roomId, messageId, playerName, courtLabel, createdAt }
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
      return {
        name,
        status: checkIn?.status || null,
        updatedAt: checkIn?.updatedAt || '',
        setByCaptain: checkIn?.setByCaptain === true,
      }
    }),
  })).sort((left, right) => arrivalRisk(right) - arrivalRisk(left))
}

export function keepTeamRoomArrivalCheckInsForLineup(
  lineup: LineupRow[],
  value: unknown,
): TeamRoomArrivalCheckIn[] {
  const activePlayerKeys = new Set(
    lineup.flatMap((court) => court.players.flatMap(personKeys)).filter(Boolean),
  )
  if (!activePlayerKeys.size) return []
  return readTeamRoomArrivalCheckIns(value).filter((checkIn) =>
    personKeys(checkIn.playerName).some((key) => activePlayerKeys.has(key)),
  )
}

export function keepTeamRoomArrivalOutreachForLineup(
  lineup: LineupRow[],
  value: unknown,
): TeamRoomArrivalOutreach[] {
  const activePlayerKeys = new Set(
    lineup.flatMap((court) => court.players.flatMap(personKeys)).filter(Boolean),
  )
  if (!activePlayerKeys.size) return []
  return readTeamRoomArrivalOutreach(value).filter((outreach) =>
    personKeys(outreach.playerName).some((key) => activePlayerKeys.has(key)),
  )
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

export function buildTeamRoomArrivalPriority(
  courts: TeamRoomArrivalCourt[],
  focusedCourtLabel = '',
): TeamRoomArrivalPriority {
  const players = courts.flatMap((court) => court.players)
  const late = findTeamRoomLateArrival(courts, focusedCourtLabel)
  if (late) {
    return {
      kind: 'late',
      title: `${late.playerName} is running late`,
      detail: `${late.courtLabel} needs the next call.`,
      names: [late.playerName],
      courtLabel: late.courtLabel,
      playerName: late.playerName,
    }
  }

  const waitingNames = players.filter((player) => player.status === null).map((player) => player.name)
  if (waitingNames.length) {
    return {
      kind: 'waiting',
      title: `${waitingNames.length} need${waitingNames.length === 1 ? 's' : ''} to check in`,
      detail: formatArrivalNames(waitingNames),
      names: waitingNames,
      courtLabel: '',
      playerName: '',
    }
  }

  const onWayNames = players.filter((player) => player.status === 'on_my_way').map((player) => player.name)
  if (onWayNames.length) {
    return {
      kind: 'on_way',
      title: `${onWayNames.length} still on the way`,
      detail: `No late players. ${formatArrivalNames(onWayNames)}`,
      names: onWayNames,
      courtLabel: '',
      playerName: '',
    }
  }

  if (players.length) {
    return {
      kind: 'ready',
      title: 'Team is here',
      detail: 'Every assigned player checked in.',
      names: players.map((player) => player.name),
      courtLabel: '',
      playerName: '',
    }
  }

  return {
    kind: 'empty',
    title: 'Lineup needed',
    detail: 'Add the lineup to start arrival check-ins.',
    names: [],
    courtLabel: '',
    playerName: '',
  }
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

function samePerson(left: string, right: string) {
  const rightKeys = new Set(personKeys(right))
  return personKeys(left).some((key) => rightKeys.has(key))
}

function normalizePerson(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function formatArrivalNames(names: string[]) {
  const visible = names.slice(0, 3)
  const remaining = names.length - visible.length
  return `${visible.join(', ')}${remaining > 0 ? ` +${remaining} more` : ''}`
}

function clean(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}
