import { cache } from 'react'
import { createPublicEvidenceClient, getPublicPlayerEvidenceForIds } from './public-player-evidence-server'
import { hasDiscoverablePlayerEvidence, type PublicPlayerEvidence } from './public-player-evidence'
import { buildPublicTeamEvidence, isDiscoverablePublicTeam, isPublicEvidenceTeamName, publicTiqRead, quotePublicTeamFilter, type PublicTeamMatchRow } from './public-competition-evidence'

const TEAM_FIELDS = 'id, match_date, home_team, away_team, league_name, flight, match_type, score, winner_side, public_history_eligible'

export type PublicRankedEvidence = { player: PublicPlayerEvidence['player']; publicRead: string; results: PublicPlayerEvidence['results'] }
export const getPublicRankingsEvidence = cache(async (): Promise<PublicRankedEvidence[]> => {
  const { data, error } = await createPublicEvidenceClient().from('players')
    .select('id, name, location, overall_dynamic_rating')
    .gte('overall_dynamic_rating', 1.5).lte('overall_dynamic_rating', 7)
    .order('overall_dynamic_rating', { ascending: false }).order('id', { ascending: true }).limit(24)
  if (error) throw new Error('Public rankings evidence is unavailable', { cause: error })
  const candidates = (data || []) as Array<{ id: string; name: string; location: string | null; overall_dynamic_rating: number }>
  const evidence = await getPublicPlayerEvidenceForIds(candidates.map(({ id }) => id))
  const byId = new Map(evidence.map((row) => [row.player.id, row]))
  // Raw rating values stay on the server. Only the existing public mask is returned.
  return candidates.flatMap((candidate) => {
    const profile = byId.get(candidate.id)
    const read = publicTiqRead(candidate.overall_dynamic_rating)
    return profile && hasDiscoverablePlayerEvidence(profile) && read ? [{ player: profile.player, publicRead: read, results: profile.results }] : []
  }).slice(0, 12)
})

async function loadPublicTeamEvidence(name?: string) {
  let query = createPublicEvidenceClient().from('matches').select(TEAM_FIELDS)
    .eq('public_history_eligible', true).in('match_type', ['singles', 'doubles'])
    .not('score', 'is', null).in('winner_side', ['A', 'B'])
    .lte('match_date', new Date().toISOString().slice(0, 10))
    .order('match_date', { ascending: false }).order('id', { ascending: false }).limit(96)
  if (name) {
    const quoted = quotePublicTeamFilter(name)
    query = query.or(`home_team.eq.${quoted},away_team.eq.${quoted}`)
  }
  const { data, error } = await query
  if (error) throw new Error('Public team evidence is unavailable', { cause: error })
  return buildPublicTeamEvidence((data || []) as PublicTeamMatchRow[])
}

export const getPublicTeamDiscovery = cache(async () => (await loadPublicTeamEvidence())
  .filter(isDiscoverablePublicTeam)
  .sort((a, b) => b.results[0].date.localeCompare(a.results[0].date) || a.name.localeCompare(b.name)).slice(0, 12))

export const getPublicTeamProfile = cache(async (name: string) => {
  if (!isPublicEvidenceTeamName(name)) return null
  return (await loadPublicTeamEvidence(name)).find((team) => team.name.toLowerCase() === name.trim().toLowerCase()) || { name: name.trim(), results: [] }
})
