import { normalizeTeamName } from './captain-formatters'

const TEAM_NAME_STOP_WORDS = new Set([
  'adult', 'and', 'club', 'fall', 'league', 'men', 'mixed', 'over',
  'spring', 'summer', 'team', 'tennis', 'the', 'under', 'usta', 'winter', 'women',
])

export type TeamRosterAliasCandidate = {
  teamName: string
  normalizedTeamName?: string | null
}

export type TeamRosterAliasResolution = {
  teamName: string
  normalizedTeamName: string
  match: 'exact' | 'unique-name-token'
  sharedTokens: string[]
}

function compactTeamName(value: string) {
  return normalizeTeamName(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

export function getTeamNameIdentityTokens(value: string) {
  return Array.from(new Set(normalizeTeamName(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 4 && !TEAM_NAME_STOP_WORDS.has(token))))
}

export function resolveTeamRosterAlias(
  requestedTeamName: string,
  candidates: TeamRosterAliasCandidate[],
): TeamRosterAliasResolution | null {
  const requestedNormalized = normalizeTeamName(requestedTeamName)
  if (!requestedNormalized) return null

  const uniqueCandidates = Array.from(new Map(candidates
    .map((candidate) => {
      const teamName = candidate.teamName.trim()
      const normalizedTeamName = normalizeTeamName(candidate.normalizedTeamName || teamName)
      return [normalizedTeamName, { teamName, normalizedTeamName }] as const
    })
    .filter(([normalizedTeamName, candidate]) => Boolean(normalizedTeamName && candidate.teamName))).values())

  const requestedCompact = compactTeamName(requestedTeamName)
  const exact = uniqueCandidates.find((candidate) => (
    candidate.normalizedTeamName === requestedNormalized
    || compactTeamName(candidate.teamName) === requestedCompact
  ))
  if (exact) return { ...exact, match: 'exact', sharedTokens: getTeamNameIdentityTokens(requestedTeamName) }

  const requestedTokens = new Set(getTeamNameIdentityTokens(requestedTeamName))
  if (!requestedTokens.size) return null

  const candidateTokens = uniqueCandidates.map((candidate) => ({
    ...candidate,
    tokens: getTeamNameIdentityTokens(candidate.teamName),
  }))
  const tokenFrequency = new Map<string, number>()
  for (const candidate of candidateTokens) {
    for (const token of candidate.tokens) tokenFrequency.set(token, (tokenFrequency.get(token) || 0) + 1)
  }

  const ranked = candidateTokens
    .map((candidate) => ({
      ...candidate,
      sharedTokens: candidate.tokens.filter((token) => requestedTokens.has(token)),
      distinctiveTokens: candidate.tokens.filter((token) => requestedTokens.has(token) && tokenFrequency.get(token) === 1),
    }))
    .filter((candidate) => candidate.distinctiveTokens.length > 0)
    .sort((left, right) => (
      right.distinctiveTokens.length - left.distinctiveTokens.length
      || right.sharedTokens.length - left.sharedTokens.length
      || left.teamName.localeCompare(right.teamName)
    ))

  const best = ranked[0]
  if (!best) return null
  const runnerUp = ranked[1]
  if (
    runnerUp
    && runnerUp.distinctiveTokens.length === best.distinctiveTokens.length
    && runnerUp.sharedTokens.length === best.sharedTokens.length
  ) return null

  return {
    teamName: best.teamName,
    normalizedTeamName: best.normalizedTeamName,
    match: 'unique-name-token',
    sharedTokens: best.sharedTokens,
  }
}
