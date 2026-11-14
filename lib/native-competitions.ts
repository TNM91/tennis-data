import type {SupabaseClient} from '@supabase/supabase-js'
import {competitionInput,publicCompetitionOwner,type CompetitionScope,type CompetitionSnapshot,type CompetitionConnection} from './native-competitions-contract'
import {readReviewedRevisions,reviewedRevisionDigest} from './first-party-revisions'
import type {OfficeLeague} from './native-league-office-contract'
import {nativeLeagueColumns,readNativeLeagueSeason} from './native-league-season'
import {attestedLeagueSchedule,mergeAttestedLeagueMatches} from './native-league-schedule'
import {beforeApprovedLeagueScores,loadApprovedLeagueScores,standingsFromLeagueScores} from './native-league-score-public'
import {readTestflightScoreLeague,testflightLeagueScoreId} from './testflight-league-scores'
type Row=Record<string,unknown>
const columns=nativeLeagueColumns+',is_public'
const text=(v:unknown)=>typeof v==='string'?v.trim():''
const rows=(r:{data:unknown;error:unknown},max:number):Row[]=>{if(r.error||!Array.isArray(r.data)||r.data.length>max)throw Error('Competition records unavailable');return r.data as Row[]}
const timeout=()=>AbortSignal.timeout(12000)
function leagueSummary(r:Row):OfficeLeague{
 if(r.season_status==='draft'||!text(r.id)||!text(r.league_name)||!['team','individual'].includes(text(r.league_format)))throw Error('League visibility changed')
 return {id:text(r.id),name:text(r.league_name),format:r.league_format as 'team'|'individual',season:text(r.season_label),status:text(r.season_status),flight:text(r.flight),location:text(r.location_label),startsOn:text(r.starts_on),endsOn:text(r.ends_on),timeZone:text(r.schedule_time_zone)||'America/Chicago',updatedAt:text(r.updated_at)}
}
export function publicLeague(r:Row):OfficeLeague{
 if(r.is_public!==true)throw Error('League visibility changed')
 return leagueSummary(r)
}

export async function loadTestflightLeagueScores(db:SupabaseClient,owner:string,input:ReturnType<typeof competitionInput>) {
 const id=testflightLeagueScoreId(owner)
 if(!id||input.selected&&input.selected!==id||!input.selected&&input.scope!=='mine')return null
 const get=()=>readTestflightScoreLeague(db,owner,columns)
 const source=await get()
 if(!source)return null
 const league=leagueSummary(source)
 if(!input.selected&&input.query&&!league.name.toLowerCase().includes(input.query.toLowerCase()))return null
 const detail=input.selected?await readNativeLeagueSeason(db,league,source,get,true):null
 return {league,detail}
}
type LeagueApprovals = ReadonlyMap<string, { summary: string; detail: string }>

export async function reviewedSchedulingLeague(db: SupabaseClient, owner: string, id: string) {
 const approval=readReviewedRevisions(process.env.TIQ_FIRST_PARTY_LEAGUE_APPROVALS,'detail').get(id)
 if(!approval)return null
 const {data,error}=await db.from('tiq_leagues').select(columns).eq('id',id).eq('created_by_user_id',owner)
  .eq('is_public',true).eq('season_status','active').abortSignal(timeout()).maybeSingle()
 if(error)throw Error('League scheduling unavailable')
 if(!data)return null
 const league=publicLeague(data as unknown as Row)
 return approval.summary===reviewedRevisionDigest(league)?league:null
}

export function loadFirstPartyNativeCompetitions(db: SupabaseClient, owner: string, input: ReturnType<typeof competitionInput>, allowReviewedOverview = false, allowPublishedSchedule = false) {
  const approvals = readReviewedRevisions(process.env.TIQ_FIRST_PARTY_LEAGUE_APPROVALS, 'detail')
  return loadNativeCompetitions(db, owner, input.scope, input.query, input.selected, approvals, allowReviewedOverview, allowPublishedSchedule)
}

/** Public TiQ seasons through the caller's RLS context. Account connections require a verified account. */
export async function loadNativeCompetitions(db:SupabaseClient,owner:string,scope:CompetitionScope='discover',query='',selected='',approvals?:LeagueApprovals,allowReviewedOverview=false,allowPublishedSchedule=false):Promise<CompetitionSnapshot>{
 const input=competitionInput(scope,query,selected);query=input.query
 const base:CompetitionSnapshot={owner,checkedAt:new Date().toISOString(),scope,query,leagues:[],moreLeagues:false,detail:null,connections:[],moreConnections:false}
 if(!owner||owner===publicCompetitionOwner&&(!approvals||scope!=='discover'))throw Error('Account required')
 const approvedIds = approvals && [...approvals.keys()]
 const summaryApproved = (league: OfficeLeague) =>
  !approvals || approvals.get(league.id)?.summary === reviewedRevisionDigest(league)
 if (approvals && selected && !approvals.has(selected)) throw Error('League unavailable')
 if (approvedIds?.length === 0) return base
 if(selected){
  const get=async()=>{const r=await db.from('tiq_leagues').select(columns).eq('id',selected).eq('is_public',true).neq('season_status','draft').abortSignal(timeout()).maybeSingle();if(r.error)throw Error('League unavailable');return r.data as Row|null}
  const source=await get();if(!source||source.id!==selected)throw Error('League unavailable')
  const league=publicLeague(source)
  if(!summaryApproved(league))throw Error('League unavailable')
  const detail=await readNativeLeagueSeason(db,league,source,get,true)
  const connections:CompetitionConnection[] = allowReviewedOverview && owner !== publicCompetitionOwner && source.created_by_user_id === owner
   ? [{leagueId: selected, kind: 'organizer', status: 'active'}] : []
  const approvedDigest=approvals?.get(selected)?.detail
  if(approvedDigest&&approvedDigest!==reviewedRevisionDigest(detail)){
   const [matches,results]=await Promise.all([
    league.status==='active'?attestedLeagueSchedule(league).catch(()=>[]):Promise.resolve([]),
    league.format==='team'?loadApprovedLeagueScores(league).catch(()=>[]):Promise.resolve([]),
   ])
   const prior=beforeApprovedLeagueScores(detail.results,results)
   const baseline=prior.length!==detail.results.length&&!detail.moreResults
    ? {...detail,results:prior,standings:standingsFromLeagueScores(prior,source)}
    : detail
   let saved:ReturnType<typeof mergeAttestedLeagueMatches>|null=null
   try{saved=mergeAttestedLeagueMatches(baseline,matches,approvedDigest)}catch{/* Details can change between reads. */}
   if(saved?.fullDetail)return {...base,leagues:[league],detail,connections}
   if(!allowReviewedOverview&&!(allowPublishedSchedule&&saved?.publishedSchedule.length))throw Error('League records changed')
   return {...base,leagues:[league],connections,detailsUnderReview:true,
    ...(saved?.publishedSchedule.length?{publishedSchedule:saved.publishedSchedule}:{}),
    ...(results.length?{approvedScores:{results:results.slice(0,100),standings:standingsFromLeagueScores(results,source)}}:{}),
    detail:{league,participants:[],fixtures:[],results:[],standings:[],moreParticipants:false,moreFixtures:false,moreResults:false,standingsAvailable:false}}
  }
  return {...base,leagues:[league],detail:approvals ? detail : {...detail,fixtures:detail.fixtures.filter(fixture=>fixture.status!=='postponed')},connections}
 }
 const listLimit = approvedIds?.length ?? 21
 const publicQuery=()=>{let q=db.from('tiq_leagues').select(columns).eq('is_public',true).neq('season_status','draft')
  if(query)q=q.ilike('league_name','%'+query.replace(/[\\%_]/g,'\\$&')+'%')
  if(approvedIds)q=q.in('id',approvedIds)
  return q.order('updated_at',{ascending:false}).order('id').limit(listLimit).abortSignal(timeout())}
 const approvedList=(result:Parameters<typeof rows>[0])=>rows(result,listLimit).filter(r=>!approvals||summaryApproved(publicLeague(r)))
 if(scope==='discover'){
  const source=approvedList(await publicQuery()),leagues=source.slice(0,20).map(publicLeague)
  if(new Set(leagues.map(l=>l.id)).size!==leagues.length)throw Error('Ambiguous leagues')
  return {...base,leagues,moreLeagues:source.length>20}
 }
 const linkedPlayer=async()=>{
  const result=await db.from('profiles').select('id,linked_player_id').eq('id',owner).abortSignal(timeout()).maybeSingle()
  if(result.error||result.data?.id!==owner)throw Error('Linked player unavailable')
  return text(result.data.linked_player_id)
 }
 const player=approvals?'':await linkedPlayer()
 const entryStatuses=approvals?['active','pending','rejected','removed']:['active','pending']
 const entries=async(table:string,column:string,value:string)=>{
  const request=db.from(table).select('league_id,entry_status,'+column).eq(column,value).in('entry_status',entryStatuses)
  if(approvedIds)request.in('league_id',approvedIds)
  return rows(await request.order('league_id').limit(51).abortSignal(timeout()),51)
 }
 const [playerRows,teamRows,linkedRows,created]=await Promise.all([
  entries('tiq_player_league_entries','created_by_user_id',owner),
  entries('tiq_team_league_entries','created_by_user_id',owner),
  player?entries('tiq_player_league_entries','player_id',player):Promise.resolve([]),
  publicQuery().eq('created_by_user_id',owner)
 ])
 const connections:CompetitionConnection[]=[]
 const add=(source:Row[],kind:'player'|'team',column:string,value:string)=>{for(const r of source){
  if(r[column]!==value||!text(r.league_id)||!/^[a-zA-Z0-9_-]{1,80}$/.test(text(r.league_id))||!entryStatuses.includes(text(r.entry_status)))throw Error('Entry account changed')
  const c:CompetitionConnection={leagueId:text(r.league_id),kind,status:r.entry_status as CompetitionConnection['status']}
  if(!connections.some(x=>x.leagueId===c.leagueId&&x.kind===kind&&x.status===c.status))connections.push(c)
 }}
 add(playerRows,'player','created_by_user_id',owner);add(teamRows,'team','created_by_user_id',owner);add(linkedRows,'player','player_id',player)
 const ids=[...new Set(connections.map(c=>c.leagueId))]
 const joined=ids.length?approvedList(await publicQuery().in('id',ids)):[]
 const owned=approvedList(created);if(owned.some(r=>r.created_by_user_id!==owner))throw Error('Season ownership changed')
 const unique=new Map<string,Row>();for(const r of [...owned,...joined]){publicLeague(r);unique.set(text(r.id),r)}
 const source=[...unique.values()].sort((a,b)=>text(b.updated_at).localeCompare(text(a.updated_at))||text(a.id).localeCompare(text(b.id))),leagues=source.slice(0,20).map(publicLeague),visible=new Set(leagues.map(l=>l.id))
 for(const r of owned)connections.push({leagueId:text(r.id),kind:'organizer',status:'active'})
 if(!approvals&&await linkedPlayer()!==player)throw Error('Linked player changed')
 return {...base,leagues,connections:connections.filter(c=>visible.has(c.leagueId)),moreLeagues:source.length>20||owned.length>20||joined.length>20,moreConnections:[playerRows,teamRows,linkedRows].some(r=>r.length>50)}
}
