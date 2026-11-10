import type { SupabaseClient } from '@supabase/supabase-js'
import { competitionTrophyLimit, isCompetitionPlacement, readCompetitionTrophies, type CompetitionTrophy } from './competition-trophies'
import { readReviewedRevisions, reviewedRevisionDigest } from './first-party-revisions'
import { publicLeague } from './native-competitions'
import { nativeLeagueColumns } from './native-league-season'
import { nativeTournamentSummaryColumns, readTournamentApprovals, tournamentRevisionDigest } from './native-tournament-approvals'

function rows<T>(result: { data: T[] | null; error: unknown }, max: number) {
  if (result.error || !Array.isArray(result.data) || result.data.length > max) throw Error('Competition trophies unavailable')
  return result.data
}

const empty = { data: [], error: null }

export async function loadFirstPartyCompetitionTrophies(db: SupabaseClient, service: SupabaseClient, owner: string) {
  const profile = await db.from('profiles').select('linked_player_id').eq('id', owner).maybeSingle()
  if (profile.error) throw Error('Player connection unavailable')
  const playerId = profile.data?.linked_player_id
  if (typeof playerId !== 'string' || !playerId.trim()) {
    return { competitionProfileLinked: false, competitionTrophies: [] }
  }

  const leagueApprovals = readReviewedRevisions(process.env.TIQ_FIRST_PARTY_LEAGUE_APPROVALS, 'detail')
  const tournamentApprovals = readTournamentApprovals(process.env.TIQ_FIRST_PARTY_TOURNAMENT_APPROVALS)
  const sourceIds = [...new Set([...leagueApprovals.keys(), ...tournamentApprovals.keys()])]
  if (!sourceIds.length) return { competitionProfileLinked: true, competitionTrophies: [] }

  const awards = rows(await db.from('tiq_awards').select('id,source_type,source_id,placement,issued_at,created_by_user_id')
    .eq('recipient_player_id', playerId).in('source_id', sourceIds)
    .order('issued_at', { ascending: false }).order('id').limit(competitionTrophyLimit), competitionTrophyLimit)
  const leagueIds = [...new Set(awards.filter(award => award.source_type === 'league' && leagueApprovals.has(award.source_id)).map(award => award.source_id))]
  const tournamentIds = [...new Set(awards.filter(award => award.source_type === 'tournament' && tournamentApprovals.has(award.source_id)).map(award => award.source_id))]
  const leagueSelect = `${nativeLeagueColumns},is_public` as const
  const tournamentSelect = `${nativeTournamentSummaryColumns},created_by_user_id` as const
  const publishers = [...new Set(awards.filter(award => award.source_type === 'league' && award.created_by_user_id).map(award => award.created_by_user_id))]
  const [leagueResult, tournamentResult, delegateResult] = await Promise.all([
    leagueIds.length ? db.from('tiq_leagues').select(leagueSelect)
      .in('id', leagueIds).eq('is_public', true).neq('season_status', 'draft').limit(leagueIds.length) : empty,
    tournamentIds.length ? db.from('tiq_tournaments').select(tournamentSelect).in('id', tournamentIds)
      .eq('is_public', true).eq('is_event', false).neq('status', 'draft').limit(tournamentIds.length) : empty,
    leagueIds.length && publishers.length ? service.from('tiq_league_delegates').select('league_id,user_id')
      .in('league_id', leagueIds).in('user_id', publishers).limit(competitionTrophyLimit ** 2) : empty,
  ])
  const leagues = new Map(rows(leagueResult, leagueIds.length).flatMap(row => {
    const league = publicLeague(row)
    return leagueApprovals.get(league.id)?.summary === reviewedRevisionDigest(league)
      ? [[league.id, { name: league.name, division: [league.season, league.flight].filter(Boolean).join(' · '), owner: row.created_by_user_id }] as const]
      : []
  }))
  const delegates = new Set(rows(delegateResult, competitionTrophyLimit ** 2).map(row => JSON.stringify([row.league_id, row.user_id])))
  const tournaments = rows(tournamentResult, tournamentIds.length).filter(row =>
    tournamentApprovals.get(row.id)?.summary === tournamentRevisionDigest(row))
  const parentIds = [...new Set(tournaments.flatMap(row => row.event_id && tournamentApprovals.has(row.event_id) ? [row.event_id] : []))]
  const parents = new Map(rows(parentIds.length ? await db.from('tiq_tournaments').select(nativeTournamentSummaryColumns)
    .in('id', parentIds).eq('is_public', true).eq('is_event', true).is('event_id', null).neq('status', 'draft').limit(parentIds.length) : empty,
    parentIds.length).filter(row => tournamentApprovals.get(row.id)?.summary === tournamentRevisionDigest(row)).map(row => [row.id, row.name]))
  const approvedTournaments = new Map(tournaments.flatMap(row => {
    const parent = row.event_id ? parents.get(row.event_id) : undefined
    if (row.event_id && !parent) return []
    return [[row.id, { name: parent || row.name, division: parent ? row.name : '', owner: row.created_by_user_id }] as const]
  }))
  const competitionTrophies = readCompetitionTrophies(awards.flatMap((award): CompetitionTrophy[] => {
    const { source_id: sourceId, source_type: kind, created_by_user_id: publisher } = award
    if (kind !== 'league' && kind !== 'tournament' || !publisher || !isCompetitionPlacement(award.placement)) return []
    const source = kind === 'league' ? leagues.get(sourceId) : approvedTournaments.get(sourceId)
    if (!source || source.owner !== publisher && !(kind === 'league' && delegates.has(JSON.stringify([sourceId, publisher])))) return []
    const awardedOn = typeof award.issued_at === 'string' ? award.issued_at.slice(0, 10) : ''
    return [{ id: award.id, kind, placement: award.placement, name: source.name, division: source.division, awardedOn }]
  }))
  return { competitionProfileLinked: true, competitionTrophies }
}
