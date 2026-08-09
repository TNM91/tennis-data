export type PlayerRatingSource = 'verified' | 'self' | 'unknown'
export type MixedPairRole = 'man' | 'woman' | 'unknown'

const AGE_DIVISION_PATTERN = /\b(10|12|14|16|18|21|25|30|35|40|45|50|55|60|65|70|75|80|85)\s*(?:&|and)?\s*(over|under)\b/i

export function normalizePlayerRatingSource(value: unknown): PlayerRatingSource {
  if (value === 'verified' || value === 'self') return value
  return 'unknown'
}

export function normalizeMixedPairRole(value: unknown): MixedPairRole {
  if (value === 'man' || value === 'woman') return value
  return 'unknown'
}

export function inferMixedPairRole(...values: Array<string | null | undefined>): MixedPairRole {
  const context = values.filter(Boolean).join(' ')
  if (/\bmixed\b/i.test(context)) return 'unknown'
  if (/\b(?:women|women's|female|girls?)\b/i.test(context)) return 'woman'
  if (/\b(?:men|men's|male|boys?)\b/i.test(context)) return 'man'
  return 'unknown'
}

export function inferLeagueAgeDivision(...values: Array<string | null | undefined>) {
  const context = values.filter(Boolean).join(' ')
  const match = context.match(AGE_DIVISION_PATTERN)
  if (!match) return null
  const boundary = Number(match[1])
  if (!Number.isFinite(boundary)) return null
  return `${boundary} & ${match[2][0].toUpperCase()}${match[2].slice(1).toLowerCase()}`
}

export function normalizeLeagueAgeDivision(value: unknown) {
  if (typeof value !== 'string') return null
  return inferLeagueAgeDivision(value)
}

export function getMixedPairEligibilityIssues(
  requiresMixedPair: boolean,
  roles: Array<MixedPairRole | string | null | undefined>,
) {
  if (!requiresMixedPair || roles.length < 2) return []
  const normalized = roles.slice(0, 2).map(normalizeMixedPairRole)
  if (normalized.includes('unknown')) {
    return ['Confirm each player’s Mixed team eligibility before finalizing this court.']
  }
  if (normalized[0] === normalized[1]) {
    return ['Mixed doubles needs one player eligible in each Mixed team role.']
  }
  return []
}

export function isMixedPairEligible(
  requiresMixedPair: boolean,
  roles: Array<MixedPairRole | string | null | undefined>,
) {
  if (!requiresMixedPair || roles.length < 2) return true
  const normalized = roles.slice(0, 2).map(normalizeMixedPairRole)
  if (normalized.includes('unknown')) return true
  return normalized[0] !== normalized[1]
}

export function getPlayerEligibilitySourceLabel(input: {
  ratingSource?: PlayerRatingSource | string | null
  ageDivision?: string | null
  mixedPairRole?: MixedPairRole | string | null
}) {
  const labels: string[] = []
  const ratingSource = normalizePlayerRatingSource(input.ratingSource)
  const mixedPairRole = normalizeMixedPairRole(input.mixedPairRole)
  if (ratingSource === 'verified') labels.push('Verified NTRP')
  else if (ratingSource === 'self') labels.push('Self-rated')
  if (input.ageDivision) labels.push(input.ageDivision)
  if (mixedPairRole === 'man') labels.push('Mixed: man')
  if (mixedPairRole === 'woman') labels.push('Mixed: woman')
  return labels
}
