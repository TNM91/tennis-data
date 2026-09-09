export type CaptainScorecardCourt = {
  label?: string | null
  players?: string[] | null
}

export type CaptainScorecardCourtKind = 'singles' | 'doubles'

export type CaptainScorecardFormat = {
  label: 'Regular team' | 'Tri-Level' | 'Mixed doubles' | 'Doubles team'
  courtCount: number
  singlesCount: number
  doublesCount: number
}

const NTRP_COURT_PATTERN = /\b(?:[2-5]\.[05])\b/i

export function captainScorecardCourtKind(label: string | null | undefined): CaptainScorecardCourtKind {
  return /\bsingles?\b/i.test(label || '') ? 'singles' : 'doubles'
}

export function captainScorecardOpponentSlots(label: string | null | undefined) {
  return captainScorecardCourtKind(label) === 'singles' ? 1 : 2
}

export function inferCaptainScorecardFormat(input: {
  leagueName?: string | null
  flight?: string | null
  lineup: CaptainScorecardCourt[]
}): CaptainScorecardFormat {
  let singlesCount = 0
  let doublesCount = 0
  let ratingCourtCount = 0

  for (const court of input.lineup) {
    if (captainScorecardCourtKind(court.label) === 'singles') singlesCount += 1
    else doublesCount += 1
    if (NTRP_COURT_PATTERN.test(court.label || '')) ratingCourtCount += 1
  }

  const scope = `${input.leagueName || ''} ${input.flight || ''}`
  const label = /\btri[-\s]?level\b/i.test(scope) || ratingCourtCount >= 2
    ? 'Tri-Level'
    : /\bmixed\b/i.test(scope)
      ? 'Mixed doubles'
      : singlesCount > 0
        ? 'Regular team'
        : 'Doubles team'

  return {
    label,
    courtCount: input.lineup.length,
    singlesCount,
    doublesCount,
  }
}
