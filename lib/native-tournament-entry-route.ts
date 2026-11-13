import type { SupabaseClient } from '@supabase/supabase-js'
import { accountClient } from './mobile-account-auth'
import { loadTournamentEntryPublications } from './first-party-tournament-entry'
import {getSignedInPlayerApiAuth} from './player-api-auth'
import {tournamentEntryId,tournamentEntryAction,readTournamentEntrySnapshot} from './native-tournament-entry-contract'
const entryResponse = (firstParty: boolean) => (data: object, status: number) =>
 Response.json(firstParty ? {...data, scope:'first-party'} : data, {
  status, headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'},
 })
async function registration(db: SupabaseClient, owner: string, firstParty: boolean, action: string, parent: string, division: string, data?: object) {
 if (!firstParty) {
  return db.rpc('native_tournament_registration', {p_action:action,p_parent:parent,p_division:division,...(data?{p_data:data}:{})})
 }
 const publications = await loadTournamentEntryPublications(db, [parent, division].filter(Boolean), undefined, undefined, owner)
 const active = publications.get(division), root = parent ? publications.get(parent) : active
 if (!active || !root || active.is_event || (active.event_id ?? '') !== parent ||
     parent && (!root.is_event || root.event_id !== null)) {
  return { data: {ok:false,status:404,message:'This tournament entry is unavailable.'}, error:null }
 }
 const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
 if (!key) throw Error('Registration unavailable')
 return accountClient(key).rpc('native_first_party_tournament_registration', {
  p_actor:owner,p_action:action,p_parent:parent,p_division:division,
  p_publication:Object.fromEntries(publications),p_data:data??{},
 }).retry(false)
}

export async function getNativeTournamentEntry(request:Request, firstParty = false){
 const json=entryResponse(firstParty)
 const auth=await getSignedInPlayerApiAuth(request);if(!auth.ok){if(firstParty)return json({ok:false,message:'Sign in to use tournament entries.'},auth.response.status);auth.response.headers.set('Cache-Control','private, no-store');return auth.response}
 let parent:string,division:string,organizer:boolean
 try{const p=new URL(request.url).searchParams;if([...p.keys()].some(k=>!['parent','division','organizer'].includes(k))||p.getAll('parent').length!==1||p.getAll('division').length!==1||p.getAll('organizer').length>1||p.has('organizer')&&p.get('organizer')!=='1')throw Error();parent=tournamentEntryId(p.get('parent'),true);division=tournamentEntryId(p.get('division'));organizer=p.get('organizer')==='1'}catch{return json({ok:false,message:'Choose a tournament division.'},400)}
 try{
  const {data,error}=await registration(auth.supabase,auth.userId,firstParty,organizer?'queue':'review',parent,division)
  if(error)throw error
  if(data?.ok!==true)return json({ok:false,message:[401,403,404,409].includes(data?.status)?data.message:'Registration is unavailable.'},[401,403,404,409].includes(data?.status)?data.status:503)
  return json({ok:true,...readTournamentEntrySnapshot(data,auth.userId,parent,division,organizer)},200)
 }catch{return json({ok:false,message:'Registration is unavailable. Refresh to try again.'},503)}
}
export async function postNativeTournamentEntry(request:Request, firstParty = false){
 const json=entryResponse(firstParty)
 const auth=await getSignedInPlayerApiAuth(request);if(!auth.ok){if(firstParty)return json({ok:false,message:'Sign in to use tournament entries.'},auth.response.status);auth.response.headers.set('Cache-Control','private, no-store');return auth.response}
 let body:ReturnType<typeof tournamentEntryAction>
 try{
  if(new URL(request.url).search||!request.headers.get('content-type')?.startsWith('application/json'))throw Error()
  const reader=request.body?.getReader();if(!reader)throw Error();let raw='',size=0;const decoder=new TextDecoder()
  try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>12000){await reader.cancel();return json({ok:false,message:'Entry details are too large.'},413)}raw+=decoder.decode(r.value,{stream:true})}raw+=decoder.decode()}finally{reader.releaseLock()}
  body=tournamentEntryAction(JSON.parse(raw))
 }catch{return json({ok:false,message:'Check the entry details and refresh before continuing.'},400)}
 try{
  const {data,error}=await registration(auth.supabase,auth.userId,firstParty,body.action,body.parent,body.division,body.data)
  if(error)throw error
  if(data?.ok!==true)return json({ok:false,message:[400,401,403,404,409,429].includes(data?.status)?data.message:'Your request could not be confirmed. Check entry status.'},[400,401,403,404,409,429].includes(data?.status)?data.status:503)
  const snapshot=readTournamentEntrySnapshot(data,auth.userId,body.parent,body.division)
  if(!snapshot.receipt||typeof snapshot.alreadySubmitted!=='boolean')throw Error('Missing confirmation')
  return json({ok:true,...snapshot},200)
 }catch{return json({ok:false,message:'Your request could not be confirmed. Refresh entry status before trying again.'},503)}
}
