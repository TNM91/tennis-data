export type MatchIntelligenceMatch = {
  date: string | null
  matchType: string | null
  result: 'W' | 'L' | '-'
  opponent: string
}

export type MatchIntelligenceRead = {
  decidedMatches: number
  wins: number
  losses: number
  record: string
  pattern: string
  patternLabel: string
  confidenceLabel: string
  confidenceNote: string
  courtMixLabel: string
  courtMixNote: string
  evidenceNote: string
  focusTitle: string
  focusNote: string
}

function compactOpponentName(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized || 'your latest opponent'
}

export function buildMatchIntelligenceRead(input: {
  matches: MatchIntelligenceMatch[]
  activeFocus?: string | null
  activeFocusNote?: string | null
}): MatchIntelligenceRead {
  const decidedMatches = input.matches.filter((match) => match.result === 'W' || match.result === 'L')
  const wins = decidedMatches.filter((match) => match.result === 'W').length
  const losses = decidedMatches.filter((match) => match.result === 'L').length
  const singles = input.matches.filter((match) => /singles/i.test(match.matchType || '')).length
  const doubles = input.matches.filter((match) => /doubles/i.test(match.matchType || '')).length
  const latest = decidedMatches[0] || null
  const lastFive = decidedMatches.slice(0, 5)
  const winRate = decidedMatches.length ? wins / decidedMatches.length : 0

  const patternLabel =
    decidedMatches.length < 3
      ? 'Early pattern'
      : winRate >= 0.65
        ? 'Positive form'
        : winRate <= 0.35
          ? 'Reset the pattern'
          : 'Competitive form'
  const confidenceLabel =
    decidedMatches.length >= 8 ? 'Strong evidence' : decidedMatches.length >= 4 ? 'Growing evidence' : 'Early evidence'
  const confidenceNote =
    decidedMatches.length >= 8
      ? `${decidedMatches.length} decided results are shaping this read.`
      : decidedMatches.length >= 4
        ? `${decidedMatches.length} decided results are connected; each new score sharpens the read.`
        : 'Add a few more connected scores before treating this as a strong trend.'
  const focusTitle = input.activeFocus?.trim() ||
    (latest?.result === 'L'
      ? `Review the loss vs ${compactOpponentName(latest.opponent)}`
      : 'Choose one court focus')
  const focusNote = input.activeFocusNote?.trim() ||
    (latest?.result === 'L'
      ? 'Name one repeat pattern to test before the next match.'
      : latest?.result === 'W'
        ? 'Keep one winning pattern intentional in the next match.'
        : 'A short, measurable focus gives the next result context.')

  return {
    decidedMatches: decidedMatches.length,
    wins,
    losses,
    record: decidedMatches.length ? `${wins}-${losses}` : 'New',
    pattern: lastFive.length ? lastFive.map((match) => match.result).join(' · ') : 'No decided results yet',
    patternLabel,
    confidenceLabel,
    confidenceNote,
    courtMixLabel: input.matches.length ? `${singles} singles · ${doubles} doubles` : 'Court mix pending',
    courtMixNote: input.matches.length
      ? `${input.matches.length} connected match${input.matches.length === 1 ? '' : 'es'} across your profile.`
      : 'Singles and doubles split in as results connect.',
    evidenceNote: decidedMatches.length
      ? `TIQ uses ${decidedMatches.length} connected decision${decidedMatches.length === 1 ? '' : 's'} in this read.`
      : 'TIQ starts the read once a scored match connects.',
    focusTitle,
    focusNote,
  }
}
