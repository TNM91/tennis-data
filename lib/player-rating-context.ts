import { getTiqBandStatus, type TiqBandStatus } from './tiq-band-status'
import type { RatingView } from './player-rating-display'

export type PlayerRatingStatus = TiqBandStatus | 'USTA comparison pending'

export function getPlayerRatingStatus(base: number, strength: number, verified: boolean): PlayerRatingStatus {
  if (!verified || !Number.isFinite(base) || !Number.isFinite(strength)) return 'USTA comparison pending'
  return getTiqBandStatus(base, strength)
}

type RatingHistoryRow = {
  match_id: string | null
  snapshot_date: string
  rating_type?: string | null
}

/** Stored rating results, including fallback estimates; not calibrated confidence or network-only evidence. */
export function getCurrentRatingHistory<T extends RatingHistoryRow>(rows: T[], view: RatingView, year: number): T[] {
  const unique = new Map<string, T>()
  for (const row of rows) {
    if (!row.match_id || !row.snapshot_date.startsWith(`${year}-`)) continue
    if ((row.rating_type ?? 'overall') !== view) continue
    const previous = unique.get(row.match_id)
    if (!previous || row.snapshot_date > previous.snapshot_date) unique.set(row.match_id, row)
  }
  return [...unique.values()].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
}
