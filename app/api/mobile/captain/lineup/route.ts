import {getCaptainApiAuth} from '@/lib/captain-api-auth'
import {getCaptainAvailabilityServiceClient} from '@/lib/captain-availability-request-server'
import {loadNativeLineup,saveNativeLineup} from '@/lib/native-captain-lineup'
import {lineupRecord} from '@/lib/native-captain-lineup-contract'
export const runtime='nodejs'
export const maxDuration=30
const json=(data:unknown,status:number)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}})
async function handle(request:Request,write:boolean){
 const auth=await getCaptainApiAuth(request);if(!auth.ok)return auth.response
 try{
  const params=new URL(request.url).searchParams,scope={teamName:params.get('team')||'',leagueName:params.get('league')||'',flight:params.get('flight')||''}
  let body:Record<string,unknown>={}
  if(write){const raw=await request.text();if(raw.length>40000)return json({ok:false,message:'This lineup is too large.'},413);try{body=lineupRecord(JSON.parse(raw))}catch{return json({ok:false,message:'Check the lineup details.'},400)}}
  const service=getCaptainAvailabilityServiceClient(),result=write?await saveNativeLineup(service,auth.userId,scope,body):await loadNativeLineup(service,auth.userId,scope,params.get('match')||'')
  return json(result,result.status)
 }catch{return json({ok:false,message:'Captain lineups are unavailable. Retry when your connection is ready.'},503)}
}
export async function GET(request:Request){return handle(request,false)}
export async function PUT(request:Request){return handle(request,true)}
