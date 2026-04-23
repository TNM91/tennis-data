export type CompetitionLayer = 'usta' | 'tiq'
export type LeagueFormat = 'team' | 'individual'

type LeagueProfileSource = {
  leagueId?: string | null
  competitionLayer?: CompetitionLayer | null
  leagueFormat?: LeagueFormat | null
  leagueName?: string | null
  ustaSection?: string | null
  districtArea?: string | null
  teamCount?: number | null
  flight?: string | null
}

function cleanText(value: string | null | undefined) {
  return (value || '').trim()
}

function hasTiqMarker(value: string) {
  const normalized = value.trim().toLowerCase()
  return (
    normalized.includes('tiq') ||
    normalized.includes('tenaceiq') ||
    normalized.includes('internal league') ||
    normalized.includes('challenge ladder')
  )
}

function hasUstaMarker(value: string) {
  const normalized = value.trim().toLowerCase()
  return normalized.includes('usta') || normalized.includes('ntrp')
}

export function inferCompetitionLayerFromValues({
  layerHint,
  leagueName,
  ustaSection,
  districtArea,
}: {
  layerHint?: string | null
  leagueName?: string | null
  ustaSection?: string | null
  districtArea?: string | null
}): CompetitionLayer {
  const hint = cleanText(layerHint).toLowerCase()
  if (hint === 'usta' || hint === 'tiq') return hint

  const name = cleanText(leagueName)
  const section = cleanText(ustaSection)
  const district = cleanText(districtArea)

  if (hasTiqMarker(name)) return 'tiq'
  if (section || district || hasUstaMarker(name)) return 'usta'
  return 'tiq'
}

export function inferLeagueFormatFromValues({
  competitionLayer,
  leagueName,
  teamCount,
}: {
  competitionLayer: CompetitionLayer
  leagueName?: string | null
  teamCount?: number | null
}): LeagueFormat {
  const name = cleanText(leagueName).toLowerCase()
  if (name.includes('individual') || name.includes('ladder') || name.includes('round robin')) {
    return 'individual'
  }

  if (competitionLayer === 'usta') return 'team'
  if (typeof teamCount === 'number' && teamCount > 1) return 'team'
  return 'individual'
}

export function inferCompetitionProfile(league: LeagueProfileSource) {
  const competitionLayer =
    league.competitionLayer ||
    inferCompetitionLayerFromValues({
      leagueName: league.leagueName,
      ustaSection: league.ustaSection,
      districtArea: league.districtArea,
    })

  const leagueFormat =
    league.leagueFormat ||
    inferLeagueFormatFromValues({
      competitionLayer,
      leagueName: league.leagueName,
      teamCount: league.teamCount,
    })

  return {
    competitionLayer,
    leagueFormat,
  }
}

export function getCompetitionLayerLabel(layer: CompetitionLayer) {
  return layer === 'usta' ? 'USTA Official' : 'TIQ League'
}

export function getCompetitionLayerDescription(layer: CompetitionLayer) {
  return layer === 'usta'
    ? 'Official external baseline truth for status, section, district, and season context.'
    : 'Internal TenAceIQ competition built for strategy, growth, and monetized workflow.'
}

export function getLeagueFormatLabel(format: LeagueFormat) {
  return format === 'team' ? 'Team League' : 'Individual League'
}

export function buildExploreLeagueHref(league: LeagueProfileSource) {
  const { competitionLayer, leagueFormat } = inferCompetitionProfile(league)
  const leagueId = cleanText(league.leagueId)
  const leagueName = cleanText(league.leagueName)
  const flight = cleanText(league.flight)
  const section = cleanText(league.ustaSection)
  const district = cleanText(league.districtArea)
  const slugBase = leagueName || 'league'
  const params = new URLSearchParams()

  if (leagueName) params.set('league', leagueName)
  if (leagueId) params.set('league_id', leagueId)
  if (flight) params.set('flight', flight)
  if (section) params.set('section', section)
  if (district) params.set('district', district)
  params.set('format', leagueFormat)

  const query = params.toString()
  return `/explore/leagues/${competitionLayer}/${encodeURIComponent(slugBase)}${query ? `?${query}` : ''}`
}
