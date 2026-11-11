import { isValidCalendarDate } from './calendar-date'
import type { TiqLeagueCalendarRow } from './tiq-league-calendar'
import type { TiqLeagueScheduleItem } from './tiq-league-schedule-service'
import { buildRoundRobinPreview } from './tournament-draw'

export type LeagueDraftParticipant = { value: string; playerId: string; playerName: string }
type LeagueDraftSide = Pick<LeagueDraftParticipant, 'playerId' | 'playerName'>
export type LeagueDraftPair = { a: LeagueDraftSide; b: LeagueDraftSide }
type LeagueDraftDay = { busy: Set<string>; bookings: { facility: string; time: string }[] }
export type LeagueDraftMatch = {
  key: string
  a: LeagueDraftParticipant
  b: LeagueDraftParticipant
  week: number
  date: string
  time: string
  facility: string
}

const normalizeName = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase()
const pairKey = (a: string, b: string) => JSON.stringify([a, b].sort())

export function buildLeagueDraftContext(participants: LeagueDraftParticipant[], schedule: TiqLeagueScheduleItem[], played: LeagueDraftPair[]) {
  const byValue = new Map(participants.map((player) => [player.value, player]))
  const byId = new Map(participants.filter((player) => player.playerId).map((player) => [player.playerId, player.value]))
  const byName = new Map(participants.map((player) => [normalizeName(player.playerName), player.value]))
  const resolve = (side: LeagueDraftSide) => byId.get(side.playerId) || byName.get(normalizeName(side.playerName))
  const pairs = new Set<string>()
  const days = new Map<string, LeagueDraftDay>()

  for (const pair of played) {
    const a = resolve(pair.a)
    const b = resolve(pair.b)
    if (a && b) pairs.add(pairKey(a, b))
  }
  for (const item of schedule) {
    if (item.status === 'cancelled') continue
    const a = resolve({ playerId: item.participantAId, playerName: item.participantAName })
    const b = resolve({ playerId: item.participantBId, playerName: item.participantBName })
    if (a && b) pairs.add(pairKey(a, b))
    const day = days.get(item.scheduledDate) ?? { busy: new Set<string>(), bookings: [] }
    if (a) day.busy.add(a)
    if (b) day.busy.add(b)
    day.bookings.push({ facility: normalizeName(item.facility), time: item.scheduledTime.slice(0, 5) })
    days.set(item.scheduledDate, day)
  }
  return {
    byValue, pairs, days,
    unique: byName.size === participants.length && byValue.size === participants.length
      && byId.size === participants.filter((player) => player.playerId).length,
  }
}

export function leagueDraftOpenSlots(
  day: LeagueDraftDay | undefined,
  facility: string,
  time: string,
  capacity: number,
) {
  const site = normalizeName(facility)
  const booked = day?.bookings.filter((booking) => (!booking.facility || booking.facility === site)
    && (!booking.time || booking.time === time)).length ?? 0
  return Math.max(0, capacity - booked)
}

export function buildLeagueMatchDraft(input: {
  context: ReturnType<typeof buildLeagueDraftContext>
  weeks: Pick<TiqLeagueCalendarRow, 'week' | 'date'>[]
  time: string
  facility: string
  simultaneousMatches: number
  remainingMatchEvents: number
}) {
  const { byValue, pairs, days, unique } = input.context
  const facility = input.facility.trim()
  const rows: LeagueDraftMatch[] = []
  if (!unique || !facility || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(input.time)) return { rows, unplaced: 0 }

  const participants = [...byValue.values()]
  const pending = new Map<string, { a: LeagueDraftParticipant; b: LeagueDraftParticipant }>()
  for (const { sideA, sideB } of buildRoundRobinPreview(participants.map((_, index) => String(index)))) {
    const a = participants[Number(sideA)]
    const b = participants[Number(sideB)]
    const key = pairKey(a.value, b.value)
    if (!pairs.has(key)) pending.set(key, { a, b })
  }

  const selectedDates = new Set<string>()
  for (const { week, date } of [...input.weeks].sort((a, b) => a.date.localeCompare(b.date))) {
    if (!isValidCalendarDate(date) || selectedDates.has(date)) continue
    selectedDates.add(date)
    const reserved = days.get(date)
    const busy = new Set(reserved?.busy)
    let open = leagueDraftOpenSlots(reserved, facility, input.time, input.simultaneousMatches)
    for (const [key, { a, b }] of pending) {
      if (!open || rows.length >= input.remainingMatchEvents) break
      if (busy.has(a.value) || busy.has(b.value)) continue
      rows.push({ key, a, b, week, date, time: input.time, facility })
      busy.add(a.value)
      busy.add(b.value)
      pending.delete(key)
      open -= 1
    }
  }
  return { rows, unplaced: pending.size }
}

export function findLeagueDraftBatchConflicts(
  rows: LeagueDraftMatch[],
  context: ReturnType<typeof buildLeagueDraftContext>,
  capacity: number,
) {
  const byParticipant = new Map<string, LeagueDraftMatch[]>()
  const byStart = new Map<string, LeagueDraftMatch[]>()
  const conflicts = new Map<string, string>()

  for (const row of rows) {
    for (const participant of [row.a, row.b]) {
      const key = JSON.stringify([row.date, participant.value])
      const group = byParticipant.get(key) ?? []
      group.push(row)
      byParticipant.set(key, group)
    }
    const key = JSON.stringify([row.date, row.time, normalizeName(row.facility)])
    const group = byStart.get(key) ?? []
    group.push(row)
    byStart.set(key, group)
  }

  for (const group of byStart.values()) {
    const { date, time, facility } = group[0]
    if (group.length <= leagueDraftOpenSlots(context.days.get(date), facility, time, capacity)) continue
    for (const row of group) conflicts.set(row.key, 'This start time exceeds the selected venue capacity.')
  }
  for (const group of byParticipant.values()) {
    if (group.length < 2) continue
    for (const row of group) conflicts.set(row.key, 'A participant has another draft match that day.')
  }
  return conflicts
}
