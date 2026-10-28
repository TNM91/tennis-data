import {after} from 'next/server'
import {accountClient,accountLifecycleReady,accountResponse,readAccountJson,verifiedAccount} from '@/lib/mobile-account-auth'
import {runAccountErasure} from '@/lib/account-erasure'
export const runtime='nodejs'
export const maxDuration=60
export async function GET(request:Request){return handle(request,false)}
export async function POST(request:Request){return handle(request,true)}
async function handle(request:Request,create:boolean){
 const account=await verifiedAccount(request);if(!account)return accountResponse({ok:false},401)
 if(create){const body=await readAccountJson(request);if(body?.confirmation!=='DELETE'||body.automatic!==true||body.cancelWebBilling!==true||Object.keys(body).some(k=>!['confirmation','automatic','cancelWebBilling'].includes(k)))return accountResponse({ok:false},400)}
 if(create&&!account.recent)return accountResponse({ok:false,verificationRequired:true},403)
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();if(!key)return accountResponse({ok:false},503)
 try{
  const service=accountClient(key);if(!await accountLifecycleReady(service))return accountResponse({ok:false},503)
  const {data,error}=await service.rpc('native_account_deletion_request',{p_owner:account.user.id,p_email:account.user.email,p_create:create,p_automatic:create,p_billing_ready:!!process.env.STRIPE_SECRET_KEY?.trim()})
  if(error||data?.ok!==true||data.reviewDays!==7||data.fulfillment!=='automated')return accountResponse({ok:false,...(['ownership','last_admin','billing'].includes(data?.blocked)?{blocked:data.blocked}:{})},data?.blocked?409:503)
  if(create&&data.request?.id)after(async()=>{try{await runAccountErasure(service,{id:data.request.id})}catch{/* Durable queue is retried by the protected runner. */}})
  return accountResponse({ok:true,email:account.user.email,reviewDays:7,fulfillment:'automated',verificationRequired:!account.recent,request:data.request},create?202:200)
 }catch{return accountResponse({ok:false},503)}
}
