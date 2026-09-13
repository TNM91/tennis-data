import { parseTennisScoreSets } from '@/lib/tiq-scoring'

export type CaptainHistoricalLineMatch = {
  id: string
  line_number: string | null
  match_type?: string | null
  winner_side?: 'A' | 'B' | null
  score?: string | null
}

export type CaptainHistoricalLinePlayer = {
  match_id: string
  player_id: string
  side: 'A' | 'B' | null
}

export type CaptainLineupTendency = {
  label: string
  starts: number
  percentage: number
}

export type CaptainScoreOutcome = {
  label: '6–0 / 6–1' | '6–2 / 6–3' | '6–4 / 7–5' | '7–6'
  sets: number
  percentage: number
}

export type CaptainPlayerLineupIntelligence = {
  playerId: string
  startCount: number
  scoredWinCount: number
  scoredSetCount: number
  positions: CaptainLineupTendency[]
  scoreOutcomes: CaptainScoreOutcome[]
}

export type CaptainPairLineupIntelligence = {
  playerIds: string[]
  startCount: number
  winCount: number
  lossCount: number
  winPercentage: number | null
  scoredWinCount: number
  scoredSetCount: number
  scoreOutcomes: CaptainScoreOutcome[]
}

const SCORE_OUTCOME_LABELS: CaptainScoreOutcome['label'][] = [
  '6–0 / 6–1',
  '6–2 / 6–3',
  '6–4 / 7–5',
  '7–6',
]

function clean(value: string | null | undefined) {
  return (value || '').trim()
}

function positionLabel(match: CaptainHistoricalLineMatch) {
  const lineNumber = Math.max(1, Number(match.line_number) || 1)
  const matchType = clean(match.match_type).toLowerCase()
  if (matchType.includes('single')) return `Singles ${lineNumber}`
  if (matchType.includes('double')) return `Doubles ${lineNumber}`
  return `Court ${lineNumber}`
}

function scoreOutcomeLabel(sideAGames: number, sideBGames: number): CaptainScoreOutcome['label'] | null {
  const winnerGames = Math.max(sideAGames, sideBGames)
  const loserGames = Math.min(sideAGames, sideBGames)
  if (winnerGames === 6 && loserGames <= 1) return '6–0 / 6–1'
  if (winnerGames === 6 && loserGames <= 3) return '6–2 / 6–3'
  if ((winnerGames === 6 && loserGames === 4) || (winnerGames === 7 && loserGames === 5)) return '6–4 / 7–5'
  if (winnerGames === 7 && loserGames === 6) return '7–6'
  return null
}

export function buildCaptainPlayerLineupIntelligence(
  playerId: string,
  matches: CaptainHistoricalLineMatch[],
  playerLinks: CaptainHistoricalLinePlayer[],
): CaptainPlayerLineupIntelligence {
  const matchesById = new Map(matches.map((match) => [match.id, match]))
  const appearances = playerLinks.filter((link) => link.player_id === playerId && matchesById.has(link.match_id))
  const positionCounts = new Map<string, number>()
  const outcomeCounts = new Map<CaptainScoreOutcome['label'], number>(SCORE_OUTCOME_LABELS.map((label) => [label, 0]))
  let scoredWinCount = 0
  let scoredSetCount = 0

  for (const appearance of appearances) {
    const match = matchesById.get(appearance.match_id)
    if (!match) continue
    const label = positionLabel(match)
    positionCounts.set(label, (positionCounts.get(label) || 0) + 1)

    if (!appearance.side || match.winner_side !== appearance.side) continue
    const parsedSets = parseTennisScoreSets(match.score)
    if (!parsedSets.length) continue
    scoredWinCount += 1
    for (const set of parsedSets) {
      const outcome = scoreOutcomeLabel(set.sideAGames, set.sideBGames)
      if (!outcome) continue
      outcomeCounts.set(outcome, (outcomeCounts.get(outcome) || 0) + 1)
      scoredSetCount += 1
    }
  }

  const startCount = appearances.length
  const positions = [...positionCounts.entries()]
    .map(([label, starts]) => ({
      label,
      starts,
      percentage: startCount ? Math.round((starts / startCount) * 100) : 0,
    }))
    .sort((left, right) => right.starts - left.starts || left.label.localeCompare(right.label))

  const scoreOutcomes = SCORE_OUTCOME_LABELS.map((label) => {
    const sets = outcomeCounts.get(label) || 0
    return {
      label,
      sets,
      percentage: scoredSetCount ? Math.round((sets / scoredSetCount) * 100) : 0,
    }
  })

  return { playerId, startCount, scoredWinCount, scoredSetCount, positions, scoreOutcomes }
}

export function buildCaptainPairLineupIntelligence(
  playerIds: string[],
  matches: CaptainHistoricalLineMatch[],
  playerLinks: CaptainHistoricalLinePlayer[],
): CaptainPairLineupIntelligence {
  const uniquePlayerIds = [...new Set(playerIds.filter(Boolean))]
  const matchesById = new Map(matches.map((match) => [match.id, match]))
  const linksByMatchId = new Map<string, CaptainHistoricalLinePlayer[]>()
  const outcomeCounts = new Map<CaptainScoreOutcome['label'], number>(SCORE_OUTCOME_LABELS.map((label) => [label, 0]))
  let startCount = 0
  let winCount = 0
  let lossCount = 0
  let scoredWinCount = 0
  let scoredSetCount = 0

  if (uniquePlayerIds.length !== 2) {
    return {
      playerIds: uniquePlayerIds,
      startCount,
      winCount,
      lossCount,
      winPercentage: null,
      scoredWinCount,
      scoredSetCount,
      scoreOutcomes: SCORE_OUTCOME_LABELS.map((label) => ({ label, sets: 0, percentage: 0 })),
    }
  }

  for (const link of playerLinks) {
    if (!matchesById.has(link.match_id) || !uniquePlayerIds.includes(link.player_id)) continue
    const current = linksByMatchId.get(link.match_id) ?? []
    current.push(link)
    linksByMatchId.set(link.match_id, current)
  }

  for (const [matchId, links] of linksByMatchId) {
    const match = matchesById.get(matchId)
    if (!match || clean(match.match_type).toLowerCase().includes('single')) continue
    const first = links.find((link) => link.player_id === uniquePlayerIds[0])
    const second = links.find((link) => link.player_id === uniquePlayerIds[1])
    if (!first?.side || !second?.side || first.side !== second.side) continue
    startCount += 1
    if (!match.winner_side) continue
    if (match.winner_side !== first.side) {
      lossCount += 1
      continue
    }
    winCount += 1
    const parsedSets = parseTennisScoreSets(match.score)
    if (!parsedSets.length) continue
    scoredWinCount += 1
    for (const set of parsedSets) {
      const outcome = scoreOutcomeLabel(set.sideAGames, set.sideBGames)
      if (!outcome) continue
      outcomeCounts.set(outcome, (outcomeCounts.get(outcome) || 0) + 1)
      scoredSetCount += 1
    }
  }

  const decidedStarts = winCount + lossCount
  return {
    playerIds: uniquePlayerIds,
    startCount,
    winCount,
    lossCount,
    winPercentage: decidedStarts ? Math.round((winCount / decidedStarts) * 100) : null,
    scoredWinCount,
    scoredSetCount,
    scoreOutcomes: SCORE_OUTCOME_LABELS.map((label) => {
      const sets = outcomeCounts.get(label) || 0
      return { label, sets, percentage: scoredSetCount ? Math.round((sets / scoredSetCount) * 100) : 0 }
    }),
  }
}

export function summarizeCaptainPositionTendency(intelligence: CaptainPlayerLineupIntelligence | undefined) {
  const top = intelligence?.positions[0]
  if (!top || !intelligence?.startCount) return 'No court history yet'
  return `${top.label} · ${top.percentage}% of ${intelligence.startCount} starts`
}

export function summarizeCaptainScoreTendency(intelligence: CaptainPlayerLineupIntelligence | undefined) {
  if (!intelligence?.scoredSetCount) return 'No scored wins yet'
  const top = [...intelligence.scoreOutcomes].sort((left, right) => right.sets - left.sets)[0]
  return top?.sets ? `${top.label} most common win set` : 'No scored wins yet'
}

export function summarizeCaptainPairRecord(intelligence: CaptainPairLineupIntelligence | undefined) {
  if (!intelligence?.startCount) return 'New pairing · no shared starts'
  const decidedStarts = intelligence.winCount + intelligence.lossCount
  if (!decidedStarts) return `${intelligence.startCount} shared start${intelligence.startCount === 1 ? '' : 's'} · results pending`
  return `${intelligence.winCount}–${intelligence.lossCount} together · ${intelligence.winPercentage}% wins`
}

export function summarizeCaptainPairScoreTendency(intelligence: CaptainPairLineupIntelligence | undefined) {
  if (!intelligence?.scoredSetCount) return 'No scored wins together yet'
  const top = [...intelligence.scoreOutcomes].sort((left, right) => right.sets - left.sets)[0]
  return top?.sets ? `${top.label} most common winning set` : 'No scored wins together yet'
}
