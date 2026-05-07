export const STANDARD_SEASON_NAMES = ['Winter', 'Spring', 'Summer', 'Fall'] as const

export type StandardSeasonName = (typeof STANDARD_SEASON_NAMES)[number]

function cleanText(value: string | null | undefined) {
  return (value || '').trim().replace(/\s+/g, ' ')
}

function toSeasonName(value: string | null | undefined): StandardSeasonName | null {
  const normalized = cleanText(value).toLowerCase()
  return STANDARD_SEASON_NAMES.find((season) => season.toLowerCase() === normalized) || null
}

export function normalizeSeasonLabel(value: string | null | undefined) {
  const normalized = cleanText(value)
  if (!normalized) return ''

  const seasonYear = normalized.match(/^(winter|spring|summer|fall)[\s-]+(20\d{2})$/i)
  if (seasonYear) {
    const season = toSeasonName(seasonYear[1])
    return season ? `${season} ${seasonYear[2]}` : normalized
  }

  const yearSeason = normalized.match(/^(20\d{2})[\s-]+(winter|spring|summer|fall)$/i)
  if (yearSeason) {
    const season = toSeasonName(yearSeason[2])
    return season ? `${season} ${yearSeason[1]}` : normalized
  }

  const yearOnly = normalized.match(/^20\d{2}$/)
  if (yearOnly) return normalized

  return normalized
}

export function buildSeasonLabelOptions(referenceDate = new Date()) {
  const year = Number.isFinite(referenceDate.getFullYear()) ? referenceDate.getFullYear() : new Date().getFullYear()
  return [year, year + 1].flatMap((optionYear) =>
    STANDARD_SEASON_NAMES.map((season) => `${season} ${optionYear}`),
  )
}

export function mergeSeasonLabelOptions(values: Array<string | null | undefined>, referenceDate = new Date()) {
  return Array.from(
    new Set(
      [...buildSeasonLabelOptions(referenceDate), ...values.map(normalizeSeasonLabel)]
        .map(normalizeSeasonLabel)
        .filter(Boolean),
    ),
  ).sort((left, right) => {
    const leftYear = left.match(/\b(20\d{2})\b/)?.[1] || ''
    const rightYear = right.match(/\b(20\d{2})\b/)?.[1] || ''
    if (leftYear !== rightYear) return leftYear.localeCompare(rightYear)

    const leftSeasonIndex = STANDARD_SEASON_NAMES.findIndex((season) => left.startsWith(season))
    const rightSeasonIndex = STANDARD_SEASON_NAMES.findIndex((season) => right.startsWith(season))
    if (leftSeasonIndex !== rightSeasonIndex) {
      if (leftSeasonIndex < 0) return 1
      if (rightSeasonIndex < 0) return -1
      return leftSeasonIndex - rightSeasonIndex
    }

    return left.localeCompare(right)
  })
}
