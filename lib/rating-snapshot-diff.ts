import type { SupabaseClient } from '@supabase/supabase-js'
import type { RatingSnapshotInsert } from './recalculateRatings'
import { saveRatingSnapshotBatches } from './rating-snapshot-batches'

export type StoredRatingSnapshot = RatingSnapshotInsert & { id: string }
const columns = ['snapshot_date', 'dynamic_rating', 'delta', 'opponent_rating', 'win_probability', 'multiplier'] as const
function key(row: RatingSnapshotInsert) {
  return `${row.player_id}__${row.match_id}__${row.rating_type}__${row.track}`
}
function equalValue(column: typeof columns[number], stored: unknown, desired: unknown) {
  if (stored === desired) return true
  // PostgREST renders stored floating values with fewer significant digits.
  // Ignore serialization noise only, far below the published 0.001 precision.
  return column !== 'snapshot_date' && column !== 'win_probability'
    && typeof stored === 'number' && typeof desired === 'number'
    && Number.isFinite(stored) && Number.isFinite(desired)
    && Math.abs(stored - desired) <= 1e-12 * Math.max(1, Math.abs(stored), Math.abs(desired))
}

/** Plan the same network history replacement without removing unchanged rows.
 * Only TIQ history for the published players belongs to the cleanup scope. */
export function planRatingSnapshotDiff(desired: RatingSnapshotInsert[], existing: StoredRatingSnapshot[], season: number, publishedPlayers: ReadonlySet<string>) {
  const start = `${season}-01-01`
  const wanted = new Map(desired.filter(row => row.snapshot_date >= start).map(row => [key(row), row]))
  const stored = new Map<string, StoredRatingSnapshot[]>()
  for (const row of existing) {
    if (row.snapshot_date < start) continue
    const rows = stored.get(key(row)) ?? []
    rows.push(row)
    stored.set(key(row), rows)
  }
  const writes: RatingSnapshotInsert[] = [], remove: string[] = []
  for (const [identity, row] of wanted) {
    const previous = stored.get(identity)
    if (!previous?.length || previous.some(old => columns.some(column => !equalValue(column, old[column], row[column])))) writes.push(row)
  }
  for (const [identity, rows] of stored) {
    const row = rows[0]
    if (row.track !== 'tiq' || !publishedPlayers.has(row.player_id)) continue
    if (!wanted.has(identity)) remove.push(...rows.map(old => old.id))
    else if (rows.length > 1) remove.push(...rows.slice(1).map(old => old.id))
  }
  return { writes, remove, unchanged: wanted.size - writes.length, desired: wanted.size }
}

/** Four bounded readers; indexed ID cursors avoid offset drift. Read everything
 * before mutation, including future-dated TIQ rows covered by the old cleanup. */
export async function loadCurrentRatingSnapshots(client: SupabaseClient, season: number, consume?: (rows: StoredRatingSnapshot[]) => void) {
  const boundaries = ['00000000', '40000000', '80000000', 'c0000000'].map(prefix => `${prefix}-0000-0000-0000-000000000000`)
  const partitions = boundaries.map((start, index) => ({ start, end: boundaries[index + 1] ?? null }))
  const inventory: StoredRatingSnapshot[][] = Array.from({ length: 4 }, () => [])
  await saveRatingSnapshotBatches(partitions.map((range, index) => ({ ...range, index })), async range => {
    let cursor: string | null = null
    for (;;) {
      let query = client.from('rating_snapshots').select('id,player_id,match_id,snapshot_date,rating_type,track,dynamic_rating,delta,opponent_rating,win_probability,multiplier').gte('snapshot_date', `${season}-01-01`).gte('id', range.start).order('id').limit(1000)
      if (range.end) query = query.lt('id', range.end)
      if (cursor) query = query.gt('id', cursor)
      const { data, error } = await query
      if (error) throw new Error('Failed to read current rating history: ' + error.message)
      const rows = (data ?? []) as StoredRatingSnapshot[]
      if (rows.some(row => !row.id || (cursor !== null && row.id <= cursor))) throw new Error('Invalid rating history pagination')
      if (consume) consume(rows)
      else inventory[range.index].push(...rows)
      if (rows.length < 1000) break
      const next = rows.at(-1)!.id
      if (next === cursor) throw new Error('Rating history pagination did not advance')
      cursor = next
    }
  }, 4)
  return inventory.flat()
}

/** Retain IDs for seen keys, not a second full copy of published history. */
export function createRatingSnapshotDiffPlanner(desired: RatingSnapshotInsert[], season: number, published: ReadonlySet<string>) {
  const wanted = new Map(desired.filter(row => row.snapshot_date >= `${season}-01-01`).map(row => [key(row), row]))
  const seen = new Map<string, string>(), changed = new Set<string>(), remove: string[] = []
  const replaced = new Map<string, string[]>()
  let existing = 0
  function consume(rows: StoredRatingSnapshot[]) {
    for (const row of rows) {
      if (row.snapshot_date < `${season}-01-01`) continue
      existing++
      const identity = key(row), target = wanted.get(identity), previousId = seen.get(identity)
      if (target) {
        if (previousId && row.track === 'tiq' && published.has(row.player_id)) remove.push(row.id)
        if (columns.some(column => !equalValue(column, row[column], target[column]))) {
          changed.add(identity)
          if (!replaced.has(identity)) replaced.set(identity, previousId ? [previousId] : [])
        }
        if (changed.has(identity)) replaced.get(identity)!.push(row.id)
        if (!previousId) seen.set(identity, row.id)
      } else if (row.track === 'tiq' && published.has(row.player_id)) remove.push(row.id)
    }
  }
  function finish() {
    const writes: RatingSnapshotInsert[] = [], existingRows: StoredRatingSnapshot[] = []
    for (const [identity, row] of wanted) {
      if (!seen.has(identity) || changed.has(identity)) writes.push(row)
      for (const id of replaced.get(identity) ?? []) existingRows.push({ ...row, id })
    }
    return { writes, remove, unchanged: wanted.size - writes.length, desired: wanted.size, existing, existingRows }
  }
  return { consume, finish }
}

export async function loadRatingSnapshotDiff(client: SupabaseClient, desired: RatingSnapshotInsert[], season: number, published: ReadonlySet<string>) {
  const planner = createRatingSnapshotDiffPlanner(desired, season, published)
  await loadCurrentRatingSnapshots(client, season, planner.consume)
  return planner.finish()
}
