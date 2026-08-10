export type PlayerRatingSource = 'verified' | 'self' | 'unknown'
export type MixedPairRole = 'man' | 'woman' | 'unknown'
export type PlayerEligibilityStatus = 'verified' | 'needs_confirmation' | 'ineligible'

export type PlayerEligibilityRequirement = {
  ratingLevel: number | null
  ageDivision: string | null
  mixedPairRole: MixedPairRole
}

export type PlayerEligibilityEvidence = {
  playerId?: string | null
  rating?: number | null
  ratingSource?: PlayerRatingSource | string | null
  mixedPairRole?: MixedPairRole | string | null
  mixedPairRoleSource?: PlayerRatingSource | string | null
  ageDivisions?: Array<string | null | undefined>
  ageDivisionSource?: PlayerRatingSource | string | null
}

export type PlayerEligibilityAssessment = {
  status: PlayerEligibilityStatus
  label: string
  detail: string
  issues: string[]
  requirement: PlayerEligibilityRequirement
}

const AGE_DIVISION_PATTERN = /\b(10|12|14|16|18|21|25|30|35|40|45|50|55|60|65|70|75|80|85)\s*(?:&|and)?\s*(over|under)\b/i
const RATING_LEVEL_PATTERN = /\b([2-5]\.[05])\b/g

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

export function buildPlayerEligibilityRequirement(...values: Array<string | null | undefined>): PlayerEligibilityRequirement {
  const context = values.filter(Boolean).join(' ')
  const ratingLevels = Array.from(new Set(Array.from(context.matchAll(RATING_LEVEL_PATTERN), (match) => Number(match[1]))))
  const parsedRating = ratingLevels.length === 1 ? ratingLevels[0] : null
  return {
    ratingLevel: typeof parsedRating === 'number' && Number.isFinite(parsedRating) ? parsedRating : null,
    ageDivision: inferLeagueAgeDivision(context),
    mixedPairRole: inferMixedPairRole(context),
  }
}

export function assessPlayerEligibility(
  requirement: PlayerEligibilityRequirement,
  evidence: PlayerEligibilityEvidence,
): PlayerEligibilityAssessment {
  const issues: string[] = []
  let ineligible = false
  const rating = typeof evidence.rating === 'number' && Number.isFinite(evidence.rating) ? evidence.rating : null
  const ratingSource = normalizePlayerRatingSource(evidence.ratingSource)
  const mixedPairRole = normalizeMixedPairRole(evidence.mixedPairRole)
  const mixedPairRoleSource = normalizePlayerRatingSource(evidence.mixedPairRoleSource)
  const ageDivisions = Array.from(new Set((evidence.ageDivisions || []).map(normalizeLeagueAgeDivision).filter(Boolean))) as string[]
  const ageDivisionSource = normalizePlayerRatingSource(evidence.ageDivisionSource)

  if (typeof requirement.ratingLevel === 'number') {
    if (rating === null) {
      issues.push(`Confirm the ${requirement.ratingLevel.toFixed(1)} rating requirement.`)
    } else if (rating > requirement.ratingLevel + 0.001 || rating < requirement.ratingLevel - 0.5 - 0.001) {
      issues.push(`${rating.toFixed(1)} is outside the ${requirement.ratingLevel.toFixed(1)} division.`)
      if (ratingSource === 'verified') ineligible = true
      else issues.push('Verify this self-rating before deciding.')
    } else if (ratingSource !== 'verified') {
      issues.push(`Verify the ${rating.toFixed(1)} self-rating.`)
    }
  }

  if (requirement.ageDivision) {
    if (!ageDivisions.includes(requirement.ageDivision)) {
      issues.push(`Confirm ${requirement.ageDivision} eligibility.`)
    } else if (ageDivisionSource !== 'verified') {
      issues.push(`Director confirms the ${requirement.ageDivision} self-attestation.`)
    }
  }

  if (requirement.mixedPairRole !== 'unknown') {
    if (mixedPairRole === 'unknown') {
      issues.push(`Confirm ${requirement.mixedPairRole === 'man' ? "men's" : "women's"} division eligibility.`)
    } else if (mixedPairRole !== requirement.mixedPairRole) {
      issues.push(`Player eligibility is saved for the ${mixedPairRole === 'man' ? "men's" : "women's"} division.`)
      if (mixedPairRoleSource === 'verified') ineligible = true
      else issues.push('Confirm the correct division before deciding.')
    } else if (mixedPairRoleSource !== 'verified') {
      issues.push(`Director confirms the ${requirement.mixedPairRole === 'man' ? "men's" : "women's"} division self-attestation.`)
    }
  }

  const hasRequirement = requirement.ratingLevel !== null || Boolean(requirement.ageDivision) || requirement.mixedPairRole !== 'unknown'
  if (!hasRequirement) {
    return {
      status: 'verified',
      label: 'Open entry',
      detail: 'No rating, age, or division restriction was detected.',
      issues: [],
      requirement,
    }
  }
  if (ineligible) {
    return { status: 'ineligible', label: 'Does not match', detail: issues.join(' '), issues, requirement }
  }
  if (issues.length) {
    return { status: 'needs_confirmation', label: 'Confirm eligibility', detail: issues.join(' '), issues, requirement }
  }
  return {
    status: 'verified',
    label: 'Eligibility verified',
    detail: 'Saved rating and roster evidence match this division.',
    issues: [],
    requirement,
  }
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
