import { createHash } from 'node:crypto'
import type { TennisRecordMatch, TennisRecordSource } from './types'

export const TENNISRECORD_SOURCE_PRIORITY: Record<TennisRecordSource, number> = {
  admin_verified: 500,
  captain_upload: 400,
  player_upload: 300,
  tenaceiq: 250,
  tennisrecord: 100,
}

export function normalizeTennisIdentity(value: string | null | undefined) {
  return (value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Score is purposefully excluded: a corrected local score remains the same match. */
export function canonicalTennisRecordFingerprint(match: Pick<TennisRecordMatch, 'playedOn' | 'leagueName' | 'flight' | 'homeTeam' | 'awayTeam' | 'discipline' | 'courtNumber' | 'participants'>) {
  const participants = [...match.participants]
    .map((participant) => `${participant.side}:${participant.seat}:${normalizeTennisIdentity(participant.name)}`)
    .sort()
    .join('|')
  const stable = [
    match.playedOn,
    normalizeTennisIdentity(match.leagueName),
    normalizeTennisIdentity(match.flight),
    normalizeTennisIdentity(match.homeTeam),
    normalizeTennisIdentity(match.awayTeam),
    match.discipline,
    String(match.courtNumber),
    participants,
  ].join('::')
  return `trm_${createHash('sha256').update(stable).digest('hex')}`
}

export function sourcePriority(source: string) {
  return TENNISRECORD_SOURCE_PRIORITY[source as TennisRecordSource] ?? 0
}

export type MatchObservation<T = unknown> = {
  id: string
  source: TennisRecordSource
  observedAt: string
  scoreText?: string | null
  winnerSide?: 'A' | 'B' | null
  participants?: T
  verifiedAt?: string | null
}

export function reconcileMatchObservations<T>(observations: MatchObservation<T>[]) {
  const sorted = [...observations].sort((left, right) => {
    const verified = Number(Boolean(right.verifiedAt)) - Number(Boolean(left.verifiedAt))
    if (verified) return verified
    const priority = sourcePriority(right.source) - sourcePriority(left.source)
    if (priority) return priority
    return Date.parse(right.observedAt) - Date.parse(left.observedAt)
  })
  const winner = sorted[0]
  if (!winner) return { winner: undefined, conflicts: [] as MatchObservation<T>[] }
  return {
    winner,
    conflicts: sorted.slice(1).filter((candidate) => (
      candidate.scoreText !== winner.scoreText || candidate.winnerSide !== winner.winnerSide || JSON.stringify(candidate.participants) !== JSON.stringify(winner.participants)
    )),
  }
}

export function isTennisRecordBlock(status: number, body: string) {
  if ([401, 403, 407, 429].includes(status)) return `http_${status}`
  const sample = body.slice(0, 10_000).toLowerCase()
  const marker = ['access denied', 'captcha', 'verify you are human', 'cloudflare', 'request blocked', 'too many requests']
    .find((value) => sample.includes(value))
  return marker ? `body:${marker}` : ''
}

export function isAmbiguousIdentity(candidates: Array<{ id: string }>, hasIndependentSignal: boolean) {
  return !hasIndependentSignal || candidates.length !== 1
}

export function classifyExistingMatchSource(source: string | null | undefined): TennisRecordSource {
  const normalized = (source || '').toLowerCase()
  if (normalized === 'tennisrecord') return 'tennisrecord'
  if (normalized.includes('admin')) return 'admin_verified'
  if (normalized.includes('captain') || normalized.includes('data_assist')) return 'captain_upload'
  if (normalized.includes('player_upload')) return 'player_upload'
  return 'tenaceiq'
}
