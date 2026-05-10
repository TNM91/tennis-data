export type CaptainTeamScopeSource = 'profile' | 'roster' | 'tiq'

export type CaptainTeamScope = {
  team: string
  league: string
  flight: string
  source?: CaptainTeamScopeSource
}

export type CaptainTeamOption = {
  team: string
  league: string
  flight: string
  matches: number
}

function cleanText(value: string | null | undefined, fallback = 'Unknown') {
  const text = (value || '').trim()
  return text || fallback
}

export function buildCaptainTeamScopeKey(option: Pick<CaptainTeamOption, 'team' | 'league' | 'flight'>) {
  return `${cleanText(option.team)}__${cleanText(option.league)}__${cleanText(option.flight)}`
}

export function addCaptainTeamScope(
  scopes: Map<string, CaptainTeamScope>,
  input: {
    team?: string | null
    league?: string | null
    flight?: string | null
    source?: CaptainTeamScopeSource
  },
) {
  const team = cleanText(input.team, '')
  if (!team) return

  const scope = {
    team,
    league: cleanText(input.league, ''),
    flight: cleanText(input.flight, ''),
    source: input.source,
  }

  scopes.set(buildCaptainTeamScopeKey(scope), scope)
}

export function captainTeamOptionMatchesScopes(option: CaptainTeamOption, scopes: CaptainTeamScope[]) {
  if (!scopes.length) return false

  const optionTeam = cleanText(option.team).toLowerCase()
  const optionLeague = cleanText(option.league, '').toLowerCase()
  const optionFlight = cleanText(option.flight, '').toLowerCase()

  return scopes.some((scope) => {
    if (scope.team.toLowerCase() !== optionTeam) return false
    if (scope.league && scope.league.toLowerCase() !== optionLeague) return false
    if (scope.flight && scope.flight.toLowerCase() !== optionFlight) return false
    return true
  })
}

export function getCaptainTeamScopeSource(
  option: CaptainTeamOption | null,
  scopes: CaptainTeamScope[],
): CaptainTeamScopeSource | null {
  if (!option) return null

  const optionTeam = cleanText(option.team).toLowerCase()
  const optionLeague = cleanText(option.league, '').toLowerCase()
  const optionFlight = cleanText(option.flight, '').toLowerCase()

  const exact = scopes.find(
    (scope) =>
      scope.team.toLowerCase() === optionTeam &&
      cleanText(scope.league, '').toLowerCase() === optionLeague &&
      cleanText(scope.flight, '').toLowerCase() === optionFlight,
  )

  return exact?.source || null
}

export function getCaptainTeamScopeSourceLabel(source: CaptainTeamScopeSource | null) {
  if (source === 'profile') return 'your linked profile'
  if (source === 'roster') return 'your roster history'
  if (source === 'tiq') return 'your TIQ team entries'
  return 'your team history'
}

function getScopePriority(option: CaptainTeamOption, scopes: CaptainTeamScope[]) {
  const source = getCaptainTeamScopeSource(option, scopes)
  if (source === 'profile') return 3
  if (source === 'roster') return 2
  if (source === 'tiq') return 1
  return 0
}

export function chooseCaptainTeamOption({
  options,
  current,
  scopes,
}: {
  options: CaptainTeamOption[]
  current?: Pick<CaptainTeamOption, 'team' | 'league' | 'flight'> | null
  scopes: CaptainTeamScope[]
}) {
  if (!options.length) return null

  const currentOption = current
    ? options.find(
        (option) =>
          option.team === current.team &&
          option.league === current.league &&
          option.flight === current.flight,
      ) || null
    : null

  if (currentOption) return currentOption

  return [...options].sort((left, right) => {
    const priorityDiff = getScopePriority(right, scopes) - getScopePriority(left, scopes)
    if (priorityDiff !== 0) return priorityDiff
    if (right.matches !== left.matches) return right.matches - left.matches
    return left.team.localeCompare(right.team)
  })[0]
}
