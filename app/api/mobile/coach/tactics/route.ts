import {getCoachApiAuth} from '@/lib/coach-api-auth'
import {readAccountJson} from '@/lib/mobile-account-auth'
import {coachId} from '@/lib/native-coach-contract'
import {NativeCoachFault} from '@/lib/native-coach'
import {readTacticsIntent} from '@/lib/native-tactics-contract'
import {loadNativeTactics,saveNativeTactics} from '@/lib/native-tactics'
export const runtime='nodejs'
export const maxDuration=30
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}})
async function handle(request:Request,write:boolean){
 const auth=await getCoachApiAuth(request);if(!auth.ok)return json({ok:false},auth.response.status)
 let id='',intent
 try{const params=new URL(request.url).searchParams;if([...params.keys()].some(k=>k!=='id')||params.getAll('id').length>1||write&&params.size)throw Error('Invalid board query');if(params.has('id'))id=coachId(params.get('id'));if(write)intent=readTacticsIntent(await readAccountJson(request,180000))}catch{return json({ok:false,message:'Review the board details before saving.'},400)}
 try{return json({ok:true,...await (intent?saveNativeTactics(auth.supabase,auth.userId,intent):loadNativeTactics(auth.supabase,auth.userId,id))})}
 catch(error){return error instanceof NativeCoachFault?json({ok:false,message:error.message},error.status):json({ok:false,message:'Board library could not be confirmed. Check saved boards before trying again.'},503)}
}
export const GET=(request:Request)=>handle(request,false)
export const POST=(request:Request)=>handle(request,true)
