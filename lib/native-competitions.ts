import type {SupabaseClient} from '@supabase/supabase-js'
import {competitionInput,type CompetitionScope,type CompetitionSnapshot,type CompetitionConnection} from './native-competitions-contract'
import type {OfficeLeague} from './native-league-office-contract'
import {nativeLeagueColumns,readNativeLeagueSeason} from './native-league-season'
type Row=Record<string,unknown>
const columns=nativeLeagueColumns+',is_public'
const text=(v:unknown)=>typeof v==='string'?v.trim():''
const rows=(r:{data:unknown;error:unknown},max:number):Row[]=>{if(r.error||!Array.isArray(r.data)||r.data.length>max)throw Error('Competition records unavailable');return r.data as Row[]}
const timeout=()=>AbortSignal.timeout(12000)
function publicLeague(r:Row):OfficeLeague{
 if(r.is_public!==true||r.season_status==='draft'||!text(r.id)||!text(r.league_name)||!['team','individual'].includes(text(r.league_format)))throw Error('League visibility changed')
 return {id:text(r.id),name:text(r.league_name),format:r.league_format as 'team'|'individual',season:text(r.season_label),status:text(r.season_status),flight:text(r.flight),location:text(r.location_label),startsOn:text(r.starts_on),endsOn:text(r.ends_on),timeZone:text(r.schedule_time_zone)||'America/Chicago',updatedAt:text(r.updated_at)}
}
/** Public TiQ seasons only. All reads use the verified caller JWT/RLS client. No access grant or service role. */
export async function loadNativeCompetitions(db:SupabaseClient,owner:string,scope:CompetitionScope='discover',query='',selected=''):Promise<CompetitionSnapshot>{
 const input=competitionInput(scope,query,selected);query=input.query
 const base:CompetitionSnapshot={owner,checkedAt:new Date().toISOString(),scope,query,leagues:[],moreLeagues:false,detail:null,connections:[],moreConnections:false}
 if(!owner)throw Error('Account required')
 if(selected){
  const get=async()=>{const r=await db.from('tiq_leagues').select(columns).eq('id',selected).eq('is_public',true).neq('season_status','draft').abortSignal(timeout()).maybeSingle();if(r.error)throw Error('League unavailable');return r.data as Row|null}
  const source=await get();if(!source||source.id!==selected)throw Error('League unavailable')
  const league=publicLeague(source),detail=await readNativeLeagueSeason(db,league,source,get,true)
  return {...base,leagues:[league],detail}
 }
 const publicQuery=()=>{let q=db.from('tiq_leagues').select(columns).eq('is_public',true).neq('season_status','draft')
  if(query)q=q.ilike('league_name','%'+query.replace(/[\\%_]/g,'\\$&')+'%')
  return q.order('updated_at',{ascending:false}).order('id').limit(21).abortSignal(timeout())}
 if(scope==='discover'){
  const source=rows(await publicQuery(),21),leagues=source.slice(0,20).map(publicLeague)
  if(new Set(leagues.map(l=>l.id)).size!==leagues.length)throw Error('Ambiguous leagues')
  return {...base,leagues,moreLeagues:source.length>20}
 }
 const profile=await db.from('profiles').select('id,linked_player_id').eq('id',owner).abortSignal(timeout()).maybeSingle()
 if(profile.error||!profile.data||profile.data.id!==owner)throw Error('Linked player unavailable')
 const player=text(profile.data.linked_player_id)
 const entries=async(table:string,column:string,value:string)=>rows(await db.from(table).select('league_id,entry_status,'+column).eq(column,value).in('entry_status',['active','pending']).order('league_id').limit(51).abortSignal(timeout()),51)
 const [playerRows,teamRows,linkedRows,created]=await Promise.all([
  entries('tiq_player_league_entries','created_by_user_id',owner),
  entries('tiq_team_league_entries','created_by_user_id',owner),
  player?entries('tiq_player_league_entries','player_id',player):Promise.resolve([]),
  publicQuery().eq('created_by_user_id',owner)
 ])
 const connections:CompetitionConnection[]=[]
 const add=(source:Row[],kind:'player'|'team',column:string,value:string)=>{for(const r of source){
  if(r[column]!==value||!text(r.league_id)||!/^[a-zA-Z0-9_-]{1,80}$/.test(text(r.league_id))||!['active','pending'].includes(text(r.entry_status)))throw Error('Entry account changed')
  const c:CompetitionConnection={leagueId:text(r.league_id),kind,status:r.entry_status as 'active'|'pending'}
  if(!connections.some(x=>x.leagueId===c.leagueId&&x.kind===kind&&x.status===c.status))connections.push(c)
 }}
 add(playerRows,'player','created_by_user_id',owner);add(teamRows,'team','created_by_user_id',owner);add(linkedRows,'player','player_id',player)
 const ids=[...new Set(connections.map(c=>c.leagueId))]
 const joined=ids.length?rows(await publicQuery().in('id',ids),21):[]
 const owned=rows(created,21);if(owned.some(r=>r.created_by_user_id!==owner))throw Error('Season ownership changed')
 const unique=new Map<string,Row>();for(const r of [...owned,...joined]){publicLeague(r);unique.set(text(r.id),r)}
 const source=[...unique.values()].sort((a,b)=>text(b.updated_at).localeCompare(text(a.updated_at))||text(a.id).localeCompare(text(b.id))),leagues=source.slice(0,20).map(publicLeague),visible=new Set(leagues.map(l=>l.id))
 for(const r of owned)connections.push({leagueId:text(r.id),kind:'organizer',status:'active'})
 const latest=await db.from('profiles').select('id,linked_player_id').eq('id',owner).abortSignal(timeout()).maybeSingle()
 if(latest.error||latest.data?.id!==owner||text(latest.data.linked_player_id)!==player)throw Error('Linked player changed')
 return {...base,leagues,connections:connections.filter(c=>visible.has(c.leagueId)),moreLeagues:source.length>20||owned.length>20||joined.length>20,moreConnections:[playerRows,teamRows,linkedRows].some(r=>r.length>50)}
}
