import { validateTiqTennisMatchScore } from './tiq-scoring'

export type SetScoreMode = 'singles' | 'doubles'
export type PlayerSetScoreMatch = {
  id: string
  matchType: SetScoreMode
  score: string | null
  result: 'W' | 'L' | null
  date?: string | null
  opponent?: string | null
  partner?: string | null
}
export const SET_SCORE_LABELS = ['6–0', '6–1', '6–2', '6–3', '6–4', '7–5', '7–6'] as const
export type SetScoreLabel = typeof SET_SCORE_LABELS[number]
export type SetScoreBucket = {
  label: SetScoreLabel
  wins: number
  losses: number
  winPercentage: number | null
  matches: Array<{ match: PlayerSetScoreMatch; wins: number; losses: number }>
}

export function readPlayerSetScores(score: string | null | undefined, result: 'W' | 'L' | null) {
  const cleaned = (score || '').trim().replace(/–/g, '-').replace(/\s*-\s*/g, '-').replace(/\s+\(/g, '(')
  const parsed = validateTiqTennisMatchScore(cleaned)
  if (!parsed.valid || !result) return null
  const firstColumnWon = parsed.parsedSets.filter((set) => set.sideAGames > set.sideBGames).length === 2
  const flip = firstColumnWon !== (result === 'W')
  return parsed.parsedSets.filter((set) => set.kind !== 'match_tiebreak').map((set) => ({
    gamesFor: flip ? set.sideBGames : set.sideAGames,
    gamesAgainst: flip ? set.sideAGames : set.sideBGames,
  }))
}

export function buildPlayerSetScoreGrid(matches: PlayerSetScoreMatch[], mode: SetScoreMode) {
  const buckets: SetScoreBucket[] = SET_SCORE_LABELS.map((label) => ({ label, wins: 0, losses: 0, winPercentage: null, matches: [] }))
  const byLabel = new Map<string, SetScoreBucket>(buckets.map((bucket) => [bucket.label, bucket]))
  const grouped = new Map<string, PlayerSetScoreMatch[]>()
  for (const match of matches) if (match.matchType === mode) grouped.set(match.id, [...(grouped.get(match.id) || []), match])
  let scoredMatches = 0
  let excludedMatches = 0
  for (const observations of grouped.values()) {
    const match = observations[0]
    const conflicting = observations.some((other) => other.score !== match.score || other.result !== match.result)
    const sets = conflicting ? null : readPlayerSetScores(match.score, match.result)
    if (!sets) { excludedMatches++; continue }
    scoredMatches++
    const matchCounts = new Map<SetScoreLabel, { wins: number; losses: number }>()
    for (const set of sets) {
      const bucket = byLabel.get(`${Math.max(set.gamesFor, set.gamesAgainst)}–${Math.min(set.gamesFor, set.gamesAgainst)}`)
      if (!bucket) continue
      const won = set.gamesFor > set.gamesAgainst
      if (won) bucket.wins++; else bucket.losses++
      const counts = matchCounts.get(bucket.label) || { wins: 0, losses: 0 }
      if (won) counts.wins++; else counts.losses++
      matchCounts.set(bucket.label, counts)
    }
    for (const [label, counts] of matchCounts) byLabel.get(label)!.matches.push({ match, ...counts })
  }
  for (const bucket of buckets) {
    const total = bucket.wins + bucket.losses
    bucket.winPercentage = total ? Math.round(bucket.wins / total * 100) : null
    bucket.matches.sort((a, b) => (b.match.date || '').localeCompare(a.match.date || '') || a.match.id.localeCompare(b.match.id))
  }
  return {
    buckets, scoredMatches, excludedMatches,
    totalSets: buckets.reduce((sum, bucket) => sum + bucket.wins + bucket.losses, 0),
    setWins: buckets.reduce((sum, bucket) => sum + bucket.wins, 0),
    setLosses: buckets.reduce((sum, bucket) => sum + bucket.losses, 0),
  }
}

export function buildPlayerSetScoreMatches(playerId: string, matches: Array<{
  id: string; match_type?: string | null; score?: string | null; winner_side?: 'A' | 'B' | null; match_date?: string | null
}>, links: Array<{ player_id: string; match_id: string; side: 'A' | 'B' | null }>): PlayerSetScoreMatch[] {
  const sides = new Map<string, Set<'A' | 'B' | null>>()
  for (const link of links) if (link.player_id === playerId) {
    const values = sides.get(link.match_id) || new Set()
    values.add(link.side); sides.set(link.match_id, values)
  }
  return matches.flatMap((match) => {
    const knownSides = sides.get(match.id)
    const type = (match.match_type || '').trim().toLowerCase()
    const matchType = type.includes('single') ? 'singles' as const : type.includes('double') ? 'doubles' as const : null
    if (!knownSides || !matchType) return []
    const side = knownSides.size === 1 ? [...knownSides][0] : null
    return [{ id: match.id, matchType, score: match.score || null, result: side && match.winner_side ? match.winner_side === side ? 'W' as const : 'L' as const : null, date: match.match_date }]
  })
}
