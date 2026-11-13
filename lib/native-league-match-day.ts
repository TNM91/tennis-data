import { accountClient } from './mobile-account-auth'
import type { CompetitionSnapshot, LeagueMatchDayRow } from './native-competitions-contract'
import { courtAccountId } from './native-court-result-contract'
import { reviewedRevisionDigest } from './first-party-revisions'
import { readReviewedTeamRooms, reviewedTeamRoom, type ReviewedTeamRoom } from './first-party-team-scopes'
import { lineupRecord } from './native-captain-lineup-contract'
import { readOfficeResult } from './native-league-office-contract'
import { readLeagueScoreFixture } from './native-league-score-contract'
import { buildTeamRoomScopeId } from './team-room'

export async function loadNativeLeagueMatchDay(snapshot: CompetitionSnapshot, actor: string | null,
  captainAccess: boolean, coordinatorAccess: boolean): Promise<CompetitionSnapshot['matchDay']> {
  const detail = snapshot.detail
  if (!detail || detail.league.format !== 'team') return
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!key) return
  const service = accountClient(key)
  const league = detail.league
  const fixtures = new Map((snapshot.publishedSchedule ?? detail.fixtures)
    .filter(f => courtAccountId(f.id) && ['confirmed','coordinator_set','completed'].includes(f.status)).map(f => [f.id,f]))
  const results = new Map((snapshot.approvedScores?.results ?? detail.results).map(result => [result.id,result]))
  if (!fixtures.size && !coordinatorAccess) return {matches:[]}
  let rooms: Record<string,string> = {}
  if (actor && captainAccess && !snapshot.scoreReviewDemo && fixtures.size) {
    const reviewed = readReviewedTeamRooms(process.env.TIQ_FIRST_PARTY_TEAM_ROOMS)
    const teams = [...new Set([...fixtures.values()].flatMap(f=>[f.a,f.b]))]
    const scoped = teams.map(teamName=>reviewedTeamRoom(reviewed,{teamName,leagueName:league.name,flight:league.flight}))
      .filter((room): room is ReviewedTeamRoom => room!==undefined && room.scheduleLeagueId===league.id)
    if (scoped.length) {
      const {data,error} = await service.from('internal_conversations').select('id,related_entity_id')
        .eq('related_entity_type','team_room').eq('status','open').in('id',scoped.map(room=>room.roomId)).limit(50)
      if (error || !Array.isArray(data)) throw Error('Match Day team access unavailable')
      const open = new Map(data.map(room=>[room.id,room.related_entity_id]))
      rooms = Object.fromEntries(scoped.flatMap(room=>open.get(room.roomId)===buildTeamRoomScopeId(room)
        ? [[room.teamName,room.roomId]] : []))
    }
  }
  const { data, error } = await service.rpc('native_league_match_day',{
    p_league:league.id,p_version:league.updatedAt,p_matches:[...fixtures.keys()],p_actor:actor,
    p_captain_access:!!actor&&captainAccess,p_rooms:rooms,
  }).retry(false)
  if (error) throw Error('Match Day unavailable')
  const response = lineupRecord(data)
  if (!Array.isArray(response.matches) || response.matches.length > fixtures.size) throw Error('Invalid Match Day response')
  const matches: LeagueMatchDayRow[] = []
  const seen = new Set<string>()
  const canReview = !!actor && coordinatorAccess && response.canReview === true
  for (const raw of response.matches) {
    const row = lineupRecord(raw), visible = fixtures.get(String(row.id)), ctx = lineupRecord(row.fixture)
    if (!visible || seen.has(visible.id)) throw Error('Invalid Match Day match')
    seen.add(visible.id)
    const f = readLeagueScoreFixture(ctx)
    if (f.id!==visible.id || f.a!==visible.a || f.b!==visible.b || f.date!==visible.date ||
        f.time!==visible.time.slice(0,5) || ctx.status!==visible.status || ctx.facility!==visible.facility) continue
    if (row.official) {
      const result = readOfficeResult(row.official), published = results.get(result.id)
      if (published && reviewedRevisionDigest(published)===reviewedRevisionDigest(result)) {
        matches.push({id:visible.id,action:'result',resultId:result.id})
      }
    } else if (row.action==='review' ? canReview :
      actor && captainAccess && (row.action==='enter'||row.action==='fix'||row.action==='pending')) {
      matches.push({id:visible.id,action:row.action as Exclude<LeagueMatchDayRow['action'],'result'>})
    }
  }
  return { matches, ...(canReview?{pendingReviews:matches.filter(row=>row.action==='review').length}:{}) }
}
