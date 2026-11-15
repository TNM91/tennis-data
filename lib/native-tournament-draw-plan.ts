import { nativeTournamentDraw } from './native-tournament-draw'
import type { TournamentMatch } from './native-tournaments-contract'
import { readTournamentPlan, tournamentSlotMinutes, type TournamentPlanWrite, type TournamentSlot } from './native-tournament-plan-contract'
import { isCompleteEventSlot, normalizeEventCourt } from './tournament-event-desk'

type DrawRow = Record<string, unknown> & { id: string; name: string; status: string; entrants: string[]; pending: number; format: string }
type EventRow = { id: string; name: string; date: string; zone: string; revision: string; divisions: DrawRow[] }
type DivisionDraw = { row: DrawRow; draw: ReturnType<typeof nativeTournamentDraw> }
const minute = ({ date, time }: TournamentSlot) => Date.parse(date + 'T' + time + ':00Z') / 60000
const names = (side: string) => side.split(' / ').map(name => name.trim().toLowerCase())

export function nativeTournamentPlan(data: EventRow, selection?: string, write?: TournamentPlanWrite) {
  const divisions = data.divisions.map(row => ({ row, draw: nativeTournamentDraw(row) }))
  const selected = divisions.find(division => division.row.id === (selection || data.divisions[0]?.id))
  if (!selected) return { code: 'missing' as const }
  const { row, draw } = selected
  const playerOverlaps = scheduledPlayerOverlaps(divisions)
  const summary = {
    id: data.id, name: data.name, date: data.date, zone: data.zone, revision: data.revision,
    divisions: divisions.map(({ row, draw }) => ({ id: row.id, name: row.name, format: row.format, status: row.status,
      entries: row.entrants.length, pending: row.pending, drawNotice: draw.drawNotice })),
    division: row.id, matches: draw.matches.map(match => playerOverlaps.has(row.id + ':' + match.id)
      ? { ...match, playerOverlap: true } : match),
  }
  const plan = readTournamentPlan(summary)
  if (!write) return { plan }
  if (write.action === 'publish') {
    if (row.status === 'scheduled' || row.status === 'completed') return { plan, unchanged: true }
    if (row.pending || draw.drawNotice || !draw.matches.length) return { code: 'review' as const }
  } else if (write.action === 'result') {
    const match = draw.matches.find(item => item.id === write.match)
    if (row.status === 'open' || !match || match.ready === false || match.a === match.b ||
        !row.entrants.includes(match.a) || !row.entrants.includes(match.b)) return { code: 'not_ready' as const }
    if (match.a !== write.sides[0] || match.b !== write.sides[1]) return { code: 'stale' as const }
    const { score, outcome, side } = write.result
    const winner = side === 'A' ? match.a : match.b
    if (match.winner === winner && match.score === score && (match.outcome ?? 'played') === outcome) {
      return { plan, unchanged: true }
    }
    if (write.revision !== plan.revision) return { code: 'stale' as const }
    const previous = row.results as Record<string, unknown>
    if (row.format === 'single_elimination' && winner !== match.winner &&
        draw.matches.some(item => Object.hasOwn(previous, item.id) && feeds(match, item))) {
      return { code: 'downstream' as const }
    }
    const result = { winner, score, outcome, sideA: match.a, sideB: match.b }
    const next = nativeTournamentDraw({ ...row, results: { ...previous, [match.id]: result } })
    if (!next.matches.some(item => item.id === match.id && item.winner === winner)) return { code: 'not_ready' as const }
    return { plan, change: { result, complete: next.matches.every(item => Boolean(item.winner)) } }
  } else {
    const match = draw.matches.find(match => match.id === write.match)
    if (!match || row.status !== 'scheduled' || match.winner || typeof row.results === 'object' &&
        row.results !== null && Object.hasOwn(row.results, match.id)) return { code: 'closed' as const }
    const { slot } = write
    if (slot ? slot.date === match.date && slot.time === match.time && slot.court === match.court :
        !match.date && !match.time && !match.court) return { plan, unchanged: true }
    if (slot && (slot.date < plan.date || !isCompleteEventSlot(slot))) return { code: 'invalid' as const }
    if (slot) {
      const start = minute(slot)
      const court = normalizeEventCourt(slot.court)
      const own = new Set(knownPlayers(match, row.entrants))
      for (const { row: other, draw: otherDraw } of divisions) {
        for (const scheduled of otherDraw.matches) {
          if (other.id === row.id && scheduled.id === match.id || !isCompleteEventSlot(scheduled)) continue
          const otherStart = minute(scheduled)
          if (Math.abs(start - otherStart) < tournamentSlotMinutes) {
            if (normalizeEventCourt(scheduled.court) === court) return { code: 'court' as const }
            if (knownPlayers(scheduled, other.entrants).some(name => own.has(name))) return { code: 'player' as const }
          }
          if (other.id === row.id && row.format === 'single_elimination') {
            if (feeds(scheduled, match) && otherStart + tournamentSlotMinutes > start ||
                feeds(match, scheduled) && start + tournamentSlotMinutes > otherStart) return { code: 'round' as const }
          }
        }
      }
    }
  }
  if (write.revision !== plan.revision) return { code: 'stale' as const }
  return { plan }
}

function knownPlayers(match: TournamentMatch, entrants: string[]) {
  return [match.a, match.b].filter(side => entrants.includes(side)).flatMap(names)
}

function scheduledPlayerOverlaps(divisions: DivisionDraw[]) {
  const slots = divisions.flatMap(({ row, draw }) => draw.matches.filter(match => !match.winner && isCompleteEventSlot(match))
    .map(match => ({ key: row.id + ':' + match.id, minute: minute(match), players: new Set(knownPlayers(match, row.entrants)) })))
  const latestByPlayer = new Map<string, { key: string; minute: number }>()
  const overlaps = new Set<string>()
  for (const slot of slots.sort((a,b) => a.minute - b.minute)) {
    for (const player of slot.players) {
      const latest = latestByPlayer.get(player)
      if (latest && slot.minute - latest.minute < tournamentSlotMinutes) {
        overlaps.add(latest.key)
        overlaps.add(slot.key)
      }
      latestByPlayer.set(player, slot)
    }
  }
  return overlaps
}

function feeds(earlier: TournamentMatch, later: TournamentMatch) {
  if (earlier.round >= later.round) return false
  const matchNumber = (match: TournamentMatch) => Number(match.id.split('-m')[1])
  return Math.ceil(matchNumber(earlier) / (2 ** (later.round - earlier.round))) === matchNumber(later)
}
