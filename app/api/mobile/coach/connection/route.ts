import {verifiedAccount,accountClient,readAccountJson} from '@/lib/mobile-account-auth'
import {acceptCoachInvitation,CoachInviteAcceptanceFault} from '@/lib/coach-invite-acceptance'
import {readCoachConnectionIntent} from '@/lib/native-coach-connection-contract'
import {nativeCoachConnection} from '@/lib/native-coach-connection'
export const runtime='nodejs'
export const maxDuration=30
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}})
export async function POST(request:Request){
 const account=await verifiedAccount(request)
 if(!account)return json({ok:false,message:'Sign in with your verified email to review this invitation.'},401)
 let intent
 try{intent=readCoachConnectionIntent(await readAccountJson(request,2048))}catch{return json({ok:false,message:'Paste the complete invitation link from your coach.'},400)}
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
 if(!key)return json({ok:false,message:'Coach connections are temporarily unavailable.'},503)
 try{
  const service=accountClient(key)
  if(intent.action==='accept')await acceptCoachInvitation(service,intent.token,account.user,intent.revision)
  return json({ok:true,...await nativeCoachConnection(service,intent.token,account.user)})
 }catch(error){
  if(error instanceof CoachInviteAcceptanceFault)return json({ok:false,message:error.message},error.status)
  console.error('Native Coach connection could not be confirmed')
  return json({ok:false,message:'The connection could not be confirmed. Check its status before trying again.'},503)
 }
}
