import {notifyNativeTeamPoll} from '@/lib/native-team-poll-alert'
import {getSignedInPlayerApiAuth} from '@/lib/player-api-auth'
import {getCaptainAvailabilityServiceClient} from '@/lib/captain-availability-request-server'
import {nativeTeamPoll} from '@/lib/native-team-polls'
import {validPollAction} from '@/lib/team-poll-contract'
export const runtime='nodejs'
export const maxDuration=30
const json=(v:unknown,status:number)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}})
function context(request:Request){const q=new URL(request.url).searchParams;return {scope:{teamName:q.get('team')||'',leagueName:q.get('league')||'',flight:q.get('flight')||''},room:q.get('room')||''}}
export async function GET(request:Request){
 const auth=await getSignedInPlayerApiAuth(request);if(!auth.ok)return auth.response
 const {scope,room}=context(request),action={action:'get',id:new URL(request.url).searchParams.get('poll')||''}
 if(!validPollAction(action))return json({ok:false},400)
 try{const r=await nativeTeamPoll(getCaptainAvailabilityServiceClient(),auth.userId,scope,room,action);return json(r,r.status)}catch{return json({ok:false},503)}
}
export async function POST(request:Request){
 const auth=await getSignedInPlayerApiAuth(request);if(!auth.ok)return auth.response
 let body:unknown;const reader=request.body?.getReader();if(!reader)return json({ok:false},400)
 try{let text='',size=0;const decoder=new TextDecoder();while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>8192){await reader.cancel();return json({ok:false},413)}text+=decoder.decode(chunk.value,{stream:true})}text+=decoder.decode();body=JSON.parse(text)}catch{return json({ok:false},400)}finally{reader.releaseLock()}
 if(!validPollAction(body)||body.action==='get')return json({ok:false},400)
 const {scope,room}=context(request);try{const service=getCaptainAvailabilityServiceClient(),r=await nativeTeamPoll(service,auth.userId,scope,room,body,parentId=>notifyNativeTeamPoll(service,auth.userId,scope,room,parentId));return json(r,r.status)}catch{return json({ok:false},503)}
}
