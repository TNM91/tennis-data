/** A copied source observation must never acquire independent local authority. */
export function isSyntheticTennisRecordObservation(
  observation: { source: string; source_record_id: string; raw?: unknown },
  match: { id: string; source: string | null },
) {
  const raw = observation.raw as { source?: unknown } | null | undefined
  return match.source === 'tennisrecord' && observation.source === 'tenaceiq' &&
    observation.source_record_id === match.id && raw?.source === 'tennisrecord'
}

/** Only the authoritative source can correct a source-owned production result. */
export function tennisRecordResultCorrection(
  match: { source: string | null; score: string | null; winner_side: string | null },
  observation: { source: string; score_text: string | null; winner_side: string | null },
) {
  if (match.source !== 'tennisrecord' || observation.source !== 'tennisrecord' ||
    !['A', 'B'].includes(observation.winner_side || '') || !observation.score_text) return null
  // Earlier reviewed repairs can orient a winner-first source score to court
  // side A/B. Replaying the same sets must not undo that factual orientation.
  const score = equivalentScoreOrientation(match.score, observation.score_text) ? match.score! : observation.score_text
  if (match.score === score && match.winner_side === observation.winner_side) return null
  return { score, winner_side: observation.winner_side as 'A' | 'B' }
}

export function equivalentScoreOrientation(left: string | null, right: string | null) {
  if (!left || !right) return false
  const normalize = (value: string) => value.replace(/\s+/g, ' ').trim()
  const reverse = right.replace(/\b(\d+)\s*-\s*(\d+)\b/g, '$2-$1')
  return normalize(left) === normalize(right) || normalize(left) === normalize(reverse)
}
