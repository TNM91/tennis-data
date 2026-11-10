import { isValidCalendarDate } from './calendar-date'

export const competitionPlacements = {
  first: 'Champion', second: 'Finalist', third: 'Third place',
} as const

export type CompetitionPlacement = keyof typeof competitionPlacements
export type CompetitionTrophy = {
  id: string
  kind: 'league' | 'tournament'
  placement: CompetitionPlacement
  name: string
  division: string
  awardedOn: string
}

export const competitionTrophyLimit = 30

export function isCompetitionPlacement(value: unknown): value is CompetitionPlacement {
  return typeof value === 'string' && Object.hasOwn(competitionPlacements, value)
}

export function readCompetitionTrophies(value: unknown): CompetitionTrophy[] {
  if (!Array.isArray(value) || value.length > competitionTrophyLimit) throw Error('Invalid competition trophies')
  const seen = new Set<string>()
  return value.map(row => {
    if (!row || typeof row.id !== 'string' || !row.id || row.id.length > 300 || seen.has(row.id) ||
        row.kind !== 'league' && row.kind !== 'tournament' || !isCompetitionPlacement(row.placement) ||
        typeof row.name !== 'string' || !row.name.trim() || row.name.length > 500 ||
        typeof row.division !== 'string' || row.division.length > 500 || !isValidCalendarDate(row.awardedOn)) {
      throw Error('Invalid competition trophy')
    }
    const { id, kind, placement, name, division, awardedOn } = row
    seen.add(id)
    return { id, kind, placement, name, division, awardedOn }
  })
}
