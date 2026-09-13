export type CaptainKnownCourtDefault = {
  label: string
  awardedTo: 'team' | 'opponent'
}

type ProjectedCourt = {
  label: string
  projection: number | null
}

function cleanKey(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function normalizeKnownCourtDefaults(value: unknown): CaptainKnownCourtDefault[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const item = entry as Record<string, unknown>
    const label = typeof item.label === 'string' ? item.label.trim().replace(/\s+/g, ' ') : ''
    const awardedTo = item.awardedTo
    const labelKey = cleanKey(label)
    if (!labelKey || seen.has(labelKey) || (awardedTo !== 'team' && awardedTo !== 'opponent')) return []
    seen.add(labelKey)
    return [{ label, awardedTo }]
  })
}

/** Computes the chance of winning a majority of independent courts. */
export function calculateTeamMatchWinProbability(probabilities: Array<number | null>): number {
  if (!probabilities.length) return 0.5
  const normalized = probabilities.map((probability) => (
    typeof probability === 'number' && Number.isFinite(probability)
      ? Math.max(0, Math.min(1, probability))
      : 0.5
  ))
  const distribution = Array.from({ length: normalized.length + 1 }, () => 0)
  distribution[0] = 1
  normalized.forEach((probability, courtIndex) => {
    for (let wins = courtIndex + 1; wins >= 0; wins -= 1) {
      distribution[wins] = (distribution[wins] || 0) * (1 - probability)
        + (wins > 0 ? (distribution[wins - 1] || 0) * probability : 0)
    }
  })
  const neededWins = Math.floor(normalized.length / 2) + 1
  return distribution.slice(neededWins).reduce((sum, probability) => sum + probability, 0)
}

export function applyKnownCourtDefaults<T extends ProjectedCourt>(
  courts: T[],
  defaults: CaptainKnownCourtDefault[],
) {
  const byLabel = new Map(defaults.map((item) => [cleanKey(item.label), item.awardedTo]))
  const adjustedCourts = courts.map((court) => {
    const awardedTo = byLabel.get(cleanKey(court.label))
    return awardedTo ? { ...court, projection: awardedTo === 'team' ? 1 : 0 } : court
  })
  return {
    courts: adjustedCourts,
    matchWinProbability: calculateTeamMatchWinProbability(adjustedCourts.map((court) => court.projection)),
  }
}
