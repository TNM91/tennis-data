import type {SupabaseClient} from '@supabase/supabase-js'
import {tournamentInput,type TournamentSnapshot,type TournamentSummary} from './native-tournaments-contract'
import {normalizeTournamentEventDetails,isTournamentEventRegistrationClosed} from './tournament-event-presentation'
import {getTournamentDrawFormatDefinition} from './competition-format-registry'
import {nativeTournamentDraw} from './native-tournament-draw'
import {isPublishedNativeTournament,nativeTournamentDrawColumns,nativeTournamentSummaryColumns,publishedNativeTournamentId,readTournamentApprovals,tournamentRevisionDigest} from './native-tournament-approvals'
import {readTestflightTournament,testflightTournamentId} from './testflight-tournament'
import type {TiqTournamentRecord} from './tiq-tournament-registry'
export {nativeTournamentDraw} from './native-tournament-draw'
type Row=Record<string,unknown>
const text=(v:unknown)=>typeof v==='string'?v.trim():''
const signal=()=>AbortSignal.timeout(12000)
const list=(r:{data:unknown;error:unknown},limit:number)=>{if(r.error||!Array.isArray(r.data)||r.data.length>limit)throw Error('Tournaments unavailable');return r.data as Row[]}
function published(r:Row, demoId = ''):TournamentSummary{
 if((r.is_public!==true&&r.id!==demoId)||!['open','scheduled','completed'].includes(text(r.status))||!/^[a-zA-Z0-9_-]{1,80}$/.test(text(r.id))||!text(r.name)||text(r.name).length>500||!['players','teams'].includes(text(r.entrant_type))||typeof r.is_event!=='boolean'||!text(r.updated_at))throw Error('Tournament unavailable')
 const details=normalizeTournamentEventDetails(r.event_details),format=text(r.format)
 return {id:text(r.id),parentId:text(r.event_id),isEvent:r.is_event,name:text(r.name),format,formatLabel:getTournamentDrawFormatDefinition(format).id===format?getTournamentDrawFormatDefinition(format).label:'Format to be confirmed',entrantType:r.entrant_type as 'players'|'teams',status:r.status as TournamentSummary['status'],date:text(r.starts_on),location:text(r.location_label).slice(0,500),updatedAt:text(r.updated_at),details,
  registrationClosed:(r.status==='scheduled'&&isPublishedNativeTournament(r))||isTournamentEventRegistrationClosed({status:r.status as TiqTournamentRecord['status'],startsOn:text(r.starts_on),eventDetails:details})}
}
/** Caller JWT/RLS only. No entry contacts, private desk state, service role or production writes. */
export function loadFirstPartyNativeTournaments(db: SupabaseClient, owner: string, input: ReturnType<typeof tournamentInput>) {
  const approvals = readTournamentApprovals(process.env.TIQ_FIRST_PARTY_TOURNAMENT_APPROVALS)
  return loadNativeTournaments(db, owner, input.query, input.selected, input.division, approvals, true)
}

export async function loadNativeTournaments(db:SupabaseClient,owner:string,query='',selected='',division='',approvals?:ReturnType<typeof readTournamentApprovals>,nativePublication=false):Promise<TournamentSnapshot>{
 const input=tournamentInput(query,selected,division);if(!owner)throw Error('Account required')
 const base:TournamentSnapshot={owner,checkedAt:new Date().toISOString(),...input,tournaments:[],more:false,detail:null}
 const approvedIds = approvals && [...approvals.keys()]
 const demoId = approvals ? testflightTournamentId(owner) : ''
 if (approvals && [selected, division].some(id => id && id !== demoId && !approvals.has(id) &&
     !(nativePublication && publishedNativeTournamentId(id)))) throw Error('Tournament unavailable')

 const isApproved = (row: Row, full = false) => {
  if (!approvals) return true
  if (nativePublication && isPublishedNativeTournament(row)) return true
  const approval = approvals.get(text(row.id))
  return !!approval && tournamentRevisionDigest(row) === approval.summary &&
    (!full || tournamentRevisionDigest(row, true) === approval.draw)
 }
 const publicQuery = (full = false, native = false) => {
  const request = db.from('tiq_tournaments').select(full ? nativeTournamentDrawColumns : nativeTournamentSummaryColumns)
    .eq('is_public', true).neq('status', 'draft')
  if (native) return request.like('id', 'tiq-native-%')
  return approvedIds ? request.in('id', approvedIds) : request
 }
 // Read the whole bounded approval set before truncating so stale revisions cannot hide approved events.
 const listLimit = approvedIds?.length ?? 21
 const approvedList = (result: Parameters<typeof list>[0]) =>
  list(result, listLimit).filter(row => isApproved(row))
 const getDemo = (full = false) => readTestflightTournament(db, owner, full ? nativeTournamentDrawColumns : nativeTournamentSummaryColumns, signal())
 const get=async(id:string,full=false)=>{
  if (id === demoId) {
   const row = await getDemo(full)
   if (!row) throw Error('Tournament unavailable')
   published(row,demoId)
   return row
  }
  const result=await publicQuery(full,nativePublication&&publishedNativeTournamentId(id)).eq('id',id).abortSignal(signal()).maybeSingle()
  const row=result.data as unknown as Row|null
  if(result.error||!row||row.id!==id||!isApproved(row,full))throw Error('Tournament unavailable')
  published(row)
  return row
 }
 if(!selected){
  const search = (native = false) => {
   let q=publicQuery(false,native).is('event_id',null)
   if(input.query)q=q.ilike('name','%'+input.query.replace(/[\\%_]/g,'\\$&')+'%')
   return q.order('updated_at',{ascending:false}).order('id').limit(native?21:listLimit).abortSignal(signal()).then(result=>
     native?list(result,21).filter(isPublishedNativeTournament):approvedList(result))
  }
  const [reviewed, demo, native] = await Promise.all([
   approvedIds?.length === 0 ? [] as Row[] : search(),
   demoId ? getDemo() : null,
   nativePublication ? search(true) : [],
  ])
  const records = [...new Map([...reviewed, ...native].map(row=>[text(row.id),row])).values()].sort((a,b)=>
    text(b.updated_at).localeCompare(text(a.updated_at)) || text(a.id).localeCompare(text(b.id)))
  if (demo && text(demo.name).toLowerCase().includes(input.query.toLowerCase())) records.unshift(demo)
  const tournaments=records.slice(0,20).map(row=>published(row,demoId))
  if(tournaments.some(t=>t.parentId)||new Set(tournaments.map(t=>t.id)).size!==tournaments.length)throw Error('Ambiguous tournament list')
  return {...base,tournaments,more:records.length>20}
 }
 const rootRow=await get(selected),root=published(rootRow,demoId);if(root.parentId||division&&!root.isEvent)throw Error('Choose a public event')
 const nativeRoot=nativePublication&&publishedNativeTournamentId(root.id)
 const childRows=root.isEvent?await publicQuery(false,nativeRoot).eq('event_id',selected).eq('is_event',false)
   .order('name').order('id').limit(nativeRoot?21:listLimit).abortSignal(signal()):null
 const children=childRows?(nativeRoot?list(childRows,21).filter(isPublishedNativeTournament):approvedList(childRows)):[]
 const divisions=children.slice(0,20).map(row=>published(row));if(divisions.some(d=>d.parentId!==selected||d.isEvent)||new Set(divisions.map(d=>d.id)).size!==divisions.length)throw Error('Event divisions changed')
 const id=root.isEvent?division:selected,activeRow=id?await get(id,true):null,active=activeRow?published(activeRow,demoId):null
 if(active&&(active.isEvent||active.parentId!==(root.isEvent?selected:'')))throw Error('Division moved to another event')
 const emptyDraw={entrants:0,drawNotice:'',matches:[],standings:[]}
 const details=activeRow ? isPublishedNativeTournament(activeRow)&&active?.status==='open'
  ? {...emptyDraw,drawNotice:'The organizer will publish the draw after reviewing entries.'}
  : nativeTournamentDraw(activeRow) : emptyDraw
 if(activeRow&&JSON.stringify(activeRow)!==JSON.stringify(await get(id,true)))throw Error('Draw changed. Refresh.')
 if(JSON.stringify(rootRow)!==JSON.stringify(await get(selected)))throw Error('Event visibility changed. Refresh.')
 return {...base,tournaments:[root],detail:{root,divisions,moreDivisions:children.length>20,active,...details}}
}
