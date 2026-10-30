import type {SupabaseClient} from '@supabase/supabase-js'
import {tournamentInput,type TournamentSnapshot,type TournamentSummary,type TournamentDetail,type TournamentStanding} from './native-tournaments-contract'
import {normalizeTournamentEventDetails,isTournamentEventRegistrationClosed} from './tournament-event-presentation'
import {getTournamentDrawFormatDefinition} from './competition-format-registry'
import {buildTournamentPreview,buildTournamentGroupChampionship,buildRoundRobinStandings} from './tournament-draw'
import type {TiqTournamentRecord,TiqTournamentMatchResult,TiqTournamentMatchSchedule,TiqTournamentMatchPreview,TiqTournamentStanding} from './tiq-tournament-registry'
type Row=Record<string,unknown>
const columns='id,event_id,is_event,name,format,entrant_type,status,starts_on,location_label,event_details,updated_at,is_public'
const text=(v:unknown)=>typeof v==='string'?v.trim():''
const signal=()=>AbortSignal.timeout(12000)
const list=(r:{data:unknown;error:unknown})=>{if(r.error||!Array.isArray(r.data)||r.data.length>21)throw Error('Tournaments unavailable');return r.data as Row[]}
function published(r:Row):TournamentSummary{
 if(r.is_public!==true||!['open','scheduled','completed'].includes(text(r.status))||!/^[a-zA-Z0-9_-]{1,80}$/.test(text(r.id))||!text(r.name)||text(r.name).length>500||!['players','teams'].includes(text(r.entrant_type))||typeof r.is_event!=='boolean'||!text(r.updated_at))throw Error('Tournament unavailable')
 const details=normalizeTournamentEventDetails(r.event_details),format=text(r.format)
 return {id:text(r.id),parentId:text(r.event_id),isEvent:r.is_event,name:text(r.name),format,formatLabel:getTournamentDrawFormatDefinition(format).id===format?getTournamentDrawFormatDefinition(format).label:'Format to be confirmed',entrantType:r.entrant_type as 'players'|'teams',status:r.status as TournamentSummary['status'],date:text(r.starts_on),location:text(r.location_label).slice(0,500),updatedAt:text(r.updated_at),details,registrationClosed:isTournamentEventRegistrationClosed({status:r.status as TiqTournamentRecord['status'],startsOn:text(r.starts_on),eventDetails:details})}
}
function mapStanding(s:TiqTournamentStanding,group=''):TournamentStanding{return {name:s.entrant,group,played:s.played,wins:s.wins,losses:s.losses,gamesWon:s.gamesWon,gamesLost:s.gamesLost,gameDiff:s.gameDiff,winPct:s.winPct}}
function draw(r:Row):Pick<TournamentDetail,'entrants'|'drawNotice'|'matches'|'standings'>{
 const unavailable=(drawNotice:string)=>({entrants:0,drawNotice,matches:[],standings:[]})
 if(!['single_elimination','round_robin','group_playoffs'].includes(text(r.format)))return unavailable('Draw details for this format are not available in the app yet.')
 if(!Array.isArray(r.entrants)||r.entrants.length>64||r.entrants.some(v=>typeof v!=='string'||!v.trim()||v.length>256))return unavailable('This draw exceeds the app’s current display limit. No partial standings are shown.')
 const entrants=r.entrants.map(v=>text(v));if(new Set(entrants).size!==entrants.length||entrants.includes('Bye'))throw Error('Ambiguous tournament entrants')
 const record=(v:unknown):Row=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length>500||JSON.stringify(v).length>250000)throw Error('Incomplete tournament draw');return v as Row}
 let raw:Row,saved:Row;try{raw=record(r.results);saved=record(r.schedule)}catch{return unavailable('This draw cannot be shown completely. Refresh for the latest published details.')}
 const schedule:Record<string,TiqTournamentMatchSchedule>={},results:Record<string,TiqTournamentMatchResult>={}
 for(const [id,v] of Object.entries(saved)){const s=v as Row;if(!s||typeof s!=='object'||Array.isArray(s))continue
  const date=text(s.date),time=text(s.time),court=text(s.court)
  if(id.length>120||court.length>160||date&&!/^\d{4}-\d{2}-\d{2}$/.test(date)||time&&!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))continue
  schedule[id]={date,time,court,updatedAt:''}
 }
 const format=r.format as TiqTournamentRecord['format']
 // Resolve only winners of the current known sides. Old side-bound results cannot advance a changed draw.
 for(let pass=0;pass<8;pass++){
  let added=0;const matches=buildTournamentPreview({format,entrants,results,schedule})
  for(const m of matches){const v=raw[m.id] as Row|undefined;if(results[m.id]||!v||typeof v!=='object'||!entrants.includes(m.sideA)||!entrants.includes(m.sideB))continue
   const winner=text(v.winner),score=text(v.score)
   if(format==='group_playoffs'&&(v.sideA!==m.sideA||v.sideB!==m.sideB))continue
   if(![m.sideA,m.sideB].includes(winner)||score.length>500||(v.sideA!==undefined||v.sideB!==undefined)&&(v.sideA!==m.sideA||v.sideB!==m.sideB))continue
   results[m.id]={winner,score,updatedAt:'',sideA:m.sideA,sideB:m.sideB};added++
  }
  if(!added)break
 }
 const source={format,entrants,results,schedule},matches=buildTournamentPreview(source).filter(m=>m.sideA!=='Bye'&&m.sideB!=='Bye')
 if(matches.length>500)return unavailable('This draw exceeds the app’s current display limit. No partial standings are shown.')
 const match=(m:TiqTournamentMatchPreview)=>({id:m.id,label:m.label,round:m.round,a:m.sideA,b:m.sideB,winner:m.result?.winner||'',score:m.result?.score||'',date:m.schedule?.date||'',time:m.schedule?.time||'',court:m.schedule?.court||''})
 const standings=format==='round_robin'?buildRoundRobinStandings(source).map(s=>mapStanding(s)):format==='group_playoffs'?buildTournamentGroupChampionship(source).groups.flatMap(g=>g.standings.map(s=>mapStanding(s,g.name))):[]
 return {entrants:entrants.length,drawNotice:'',matches:matches.map(match),standings}
}
/** Caller JWT/RLS only. No entry contacts, private desk state, service role or production writes. */
export async function loadNativeTournaments(db:SupabaseClient,owner:string,query='',selected='',division=''):Promise<TournamentSnapshot>{
 const input=tournamentInput(query,selected,division);if(!owner)throw Error('Account required')
 const base:TournamentSnapshot={owner,checkedAt:new Date().toISOString(),...input,tournaments:[],more:false,detail:null}
 const publicQuery=(full=false)=>db.from('tiq_tournaments').select(columns+(full?',entrants,results,schedule':'')).eq('is_public',true).neq('status','draft')
 const get=async(id:string,full=false)=>{const result=await publicQuery(full).eq('id',id).abortSignal(signal()).maybeSingle();const row=result.data as unknown as Row|null;if(result.error||!row||row.id!==id)throw Error('Tournament unavailable');published(row);return row}
 if(!selected){let q=publicQuery().is('event_id',null);if(input.query)q=q.ilike('name','%'+input.query.replace(/[\\%_]/g,'\\$&')+'%')
  const records=list(await q.order('updated_at',{ascending:false}).order('id').limit(21).abortSignal(signal())),tournaments=records.slice(0,20).map(published)
  if(tournaments.some(t=>t.parentId)||new Set(tournaments.map(t=>t.id)).size!==tournaments.length)throw Error('Ambiguous tournament list')
  return {...base,tournaments,more:records.length>20}
 }
 const rootRow=await get(selected),root=published(rootRow);if(root.parentId||division&&!root.isEvent)throw Error('Choose a public event')
 const children=root.isEvent?list(await publicQuery().eq('event_id',selected).eq('is_event',false).order('name').order('id').limit(21).abortSignal(signal())):[]
 const divisions=children.slice(0,20).map(published);if(divisions.some(d=>d.parentId!==selected||d.isEvent)||new Set(divisions.map(d=>d.id)).size!==divisions.length)throw Error('Event divisions changed')
 const id=root.isEvent?division:selected,activeRow=id?await get(id,true):null,active=activeRow?published(activeRow):null
 if(active&&(active.isEvent||active.parentId!==(root.isEvent?selected:'')))throw Error('Division moved to another event')
 const details=activeRow?draw(activeRow):{entrants:0,drawNotice:'',matches:[],standings:[]}
 if(activeRow&&JSON.stringify(activeRow)!==JSON.stringify(await get(id,true)))throw Error('Draw changed. Refresh.')
 if(JSON.stringify(rootRow)!==JSON.stringify(await get(selected)))throw Error('Event visibility changed. Refresh.')
 return {...base,tournaments:[root],detail:{root,divisions,moreDivisions:children.length>20,active,...details}}
}
