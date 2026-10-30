import {getSignedInPlayerApiAuth} from '@/lib/player-api-auth'
import {tournamentEntryId,tournamentEntryAction,readTournamentEntrySnapshot} from '@/lib/native-tournament-entry-contract'
export const runtime='nodejs'
export const maxDuration=60
const json=(data:unknown,status:number)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}})
export async function GET(request:Request){
 const auth=await getSignedInPlayerApiAuth(request);if(!auth.ok){auth.response.headers.set('Cache-Control','private, no-store');return auth.response}
 let parent:string,division:string,organizer:boolean
 try{const p=new URL(request.url).searchParams;if([...p.keys()].some(k=>!['parent','division','organizer'].includes(k))||p.getAll('parent').length!==1||p.getAll('division').length!==1||p.getAll('organizer').length>1||p.has('organizer')&&p.get('organizer')!=='1')throw Error();parent=tournamentEntryId(p.get('parent'),true);division=tournamentEntryId(p.get('division'));organizer=p.get('organizer')==='1'}catch{return json({ok:false,message:'Choose a tournament division.'},400)}
 try{
  const {data,error}=await auth.supabase.rpc('native_tournament_registration',{p_action:organizer?'queue':'review',p_parent:parent,p_division:division})
  if(error)throw error
  if(data?.ok!==true)return json({ok:false,message:[401,403,404,409].includes(data?.status)?data.message:'Registration is unavailable.'},[401,403,404,409].includes(data?.status)?data.status:503)
  return json({ok:true,...readTournamentEntrySnapshot(data,auth.userId,parent,division,organizer)},200)
 }catch{return json({ok:false,message:'Registration is unavailable. Refresh to try again.'},503)}
}
export async function POST(request:Request){
 const auth=await getSignedInPlayerApiAuth(request);if(!auth.ok){auth.response.headers.set('Cache-Control','private, no-store');return auth.response}
 let body:ReturnType<typeof tournamentEntryAction>
 try{
  if(new URL(request.url).search||!request.headers.get('content-type')?.startsWith('application/json'))throw Error()
  const reader=request.body?.getReader();if(!reader)throw Error();let raw='',size=0;const decoder=new TextDecoder()
  try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>12000){await reader.cancel();return json({ok:false,message:'Entry details are too large.'},413)}raw+=decoder.decode(r.value,{stream:true})}raw+=decoder.decode()}finally{reader.releaseLock()}
  body=tournamentEntryAction(JSON.parse(raw))
 }catch{return json({ok:false,message:'Check the entry details and refresh before continuing.'},400)}
 try{
  const {data,error}=await auth.supabase.rpc('native_tournament_registration',{p_action:body.action,p_parent:body.parent,p_division:body.division,p_data:body.data})
  if(error)throw error
  if(data?.ok!==true)return json({ok:false,message:[400,401,403,404,409,429].includes(data?.status)?data.message:'Your request could not be confirmed. Check entry status.'},[400,401,403,404,409,429].includes(data?.status)?data.status:503)
  const snapshot=readTournamentEntrySnapshot(data,auth.userId,body.parent,body.division)
  if(!snapshot.receipt||typeof snapshot.alreadySubmitted!=='boolean')throw Error('Missing confirmation')
  return json({ok:true,...snapshot},200)
 }catch{return json({ok:false,message:'Your request could not be confirmed. Refresh entry status before trying again.'},503)}
}
