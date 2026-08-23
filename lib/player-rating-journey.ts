export type RatingJourneySnapshot = {
  id: string
  snapshotDate: string | null
  dynamicRating: number | null
  delta: number | null
}

export type PlayerRatingJourneyRead = {
  evidenceLabel: 'Early evidence' | 'Growing evidence' | 'Strong evidence'
  evidenceNote: string
  movementLabel: 'Starting read' | 'Recent lift' | 'Stable range' | 'Recent adjustment'
  movementNote: string
  latestDeltaLabel: string
  snapshotPoints: Array<{ id: string; rating: number; date: string | null }>
  hasSnapshotTrend: boolean
  explainer: string
}

function compareSnapshots(left: RatingJourneySnapshot, right: RatingJourneySnapshot) {
  const leftDate = left.snapshotDate ? new Date(left.snapshotDate).getTime() : 0
  const rightDate = right.snapshotDate ? new Date(right.snapshotDate).getTime() : 0
  return leftDate - rightDate || left.id.localeCompare(right.id)
}

function formatSignedRating(value: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'No per-match adjustment yet'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)} latest adjustment`
}

export function buildPlayerRatingJourneyRead(input: {
  snapshots: RatingJourneySnapshot[]
  decidedMatches: number
}): PlayerRatingJourneyRead {
  const snapshots = input.snapshots
    .filter((snapshot) => typeof snapshot.dynamicRating === 'number' && Number.isFinite(snapshot.dynamicRating))
    .toSorted(compareSnapshots)
  const latest = snapshots.at(-1) || null
  const first = snapshots[0] || null
  const movement = latest && first && snapshots.length > 1 ? latest.dynamicRating! - first.dynamicRating! : null
  const evidenceLabel =
    input.decidedMatches >= 8 || snapshots.length >= 8
      ? 'Strong evidence'
      : input.decidedMatches >= 4 || snapshots.length >= 4
        ? 'Growing evidence'
        : 'Early evidence'
  const evidenceNote =
    evidenceLabel === 'Strong evidence'
      ? `${input.decidedMatches} recent decided score${input.decidedMatches === 1 ? '' : 's'} and ${snapshots.length} rating checkpoint${snapshots.length === 1 ? '' : 's'} support this read.`
      : evidenceLabel === 'Growing evidence'
        ? `${input.decidedMatches} recent decided score${input.decidedMatches === 1 ? '' : 's'} are connected. Each verified result sharpens the read.`
        : 'Keep connecting verified scores. TIQ will show a clearer trend as the evidence grows.'
  const movementLabel =
    movement == null
      ? 'Starting read'
      : movement >= 0.025
        ? 'Recent lift'
        : movement <= -0.025
          ? 'Recent adjustment'
          : 'Stable range'
  const movementNote =
    movement == null
      ? 'A rating trend appears after at least two TIQ checkpoints connect.'
      : movementLabel === 'Stable range'
        ? `Your latest TIQ checkpoints are within ${Math.abs(movement).toFixed(2)} of each other.`
        : `Across these connected checkpoints, TIQ moved ${movement >= 0 ? '+' : ''}${movement.toFixed(2)}.`

  return {
    evidenceLabel,
    evidenceNote,
    movementLabel,
    movementNote,
    latestDeltaLabel: formatSignedRating(latest?.delta ?? null),
    snapshotPoints: snapshots.slice(-4).map((snapshot) => ({
      id: snapshot.id,
      rating: snapshot.dynamicRating!,
      date: snapshot.snapshotDate,
    })),
    hasSnapshotTrend: snapshots.length >= 2,
    explainer: 'TIQ evolves from connected match results. USTA is reference context here, not an official rating or bump prediction.',
  }
}
