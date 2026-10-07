import { buildPlayerSetScoreGrid, type PlayerSetScoreMatch, type SetScoreMode } from './player-set-score-grid'

export function courtScoreRecord(playerIds: string[], histories: Record<string, { setScoreMatches?: PlayerSetScoreMatch[] }>, mode: SetScoreMode) {
  const ids = [...new Set(playerIds.filter(Boolean))]
  const complete = ids.length === (mode === 'singles' ? 1 : 2)
  const matches = complete ? (histories[ids[0]]?.setScoreMatches || []).filter((match) => match.matchType === mode && ids.every((id) => {
    const observations = (histories[id]?.setScoreMatches || []).filter((other) => other.id === match.id)
    return observations.length > 0 && observations.every((other) => other.matchType === mode && other.result === match.result && other.score === match.score)
  })) : []
  const grid = buildPlayerSetScoreGrid(matches, mode)
  const sum = (labels: string[]) => grid.buckets.filter((bucket) => labels.includes(bucket.label)).reduce((record, bucket) => ({ wins: record.wins + bucket.wins, losses: record.losses + bucket.losses }), { wins: 0, losses: 0 })
  return { ...grid, complete, close: sum(['7–5', '7–6']), decisive: sum(['6–0', '6–1', '6–2']) }
}
