import type {SupabaseClient} from '@supabase/supabase-js'
import {accountActuallyRemoved,sendDeletionConfirmation} from './account-deletion-admin'
import {eraseAccountBilling} from './account-erasure-billing'

type Phase='queued'|'waiting'|'billing'|'files'|'data'|'auth'|'confirmation'
export type ErasureJob={id:string;account_id:string;verified_email:string;phase:Phase;lease_token:string;not_before:string|null;stripe_customer_id:string|null;stripe_subscription_id:string|null}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const buckets=new Set(['profile-photos','data-assist-screenshots','personal-quest-photos','team-room-files','tiq-league-photos','club-branding'])
export function erasureConfiguration(env:Record<string,string|undefined>=process.env){
 const ttl=Number(env.ACCOUNT_ERASURE_MAX_JWT_SECONDS)
 return env.ACCOUNT_ERASURE_ENABLED==='true'&&Number.isInteger(ttl)&&ttl>=300&&ttl<=86400?{jwtSeconds:ttl}:null
}
function parseJob(row:unknown):ErasureJob|null{
 if(!row||typeof row!=='object')return null;const r=row as Record<string,unknown>
 if(!uuid.test(String(r.id))||!uuid.test(String(r.account_id))||!uuid.test(String(r.lease_token))||typeof r.verified_email!=='string'||!['queued','waiting','billing','files','data','auth','confirmation'].includes(String(r.phase)))return null
 return r as ErasureJob
}
export async function runAccountErasure(service:SupabaseClient,options:{id?:string;env?:Record<string,string|undefined>;send?:typeof fetch;now?:()=>number}={}){
 const env=options.env||process.env,config=erasureConfiguration(env),now=options.now||Date.now,started=now()
 if(!config)return {state:'disabled' as const}
 const call=async(action:string,job?:ErasureJob,value?:string)=>{const {data,error}=await service.rpc('automated_account_erasure',{p_action:action,p_id:job?.id||options.id||null,p_lease:job?.lease_token||null,p_value:value||null});if(error||data?.ok!==true)throw Error('queue');return data}
 const claimed=await call('claim');if(!claimed.job)return {state:'idle' as const}
 const job=parseJob(claimed.job);if(!job)throw Error('queue')
 let failure='provider'
 try{
  // Every persisted transition is lease-fenced. External provider operations are retry-safe.
  for(let step=0;step<9&&now()-started<40000;step++){
   switch(job.phase){
    case 'queued':{
     failure='preflight';await call('preflight',job)
     failure='auth';const identity=await service.auth.admin.getUserById(job.account_id)
     if(identity.error||identity.data.user?.id!==job.account_id||identity.data.user.email?.toLowerCase()!==job.verified_email.toLowerCase())throw Error('auth')
     const frozen=await service.auth.admin.updateUserById(job.account_id,{ban_duration:'876000h'})
     if(frozen.error)throw Error('auth')
     // A ban alone does not revoke refresh sessions; the scoped SQL step removes them.
     await call('freeze',job,String(config.jwtSeconds));job.phase='waiting'
     return {state:'waiting' as const}
    }
    case 'waiting':
     failure='preflight';await call('ready',job);job.phase='billing';break
    case 'billing':
     failure='billing';if(!await eraseAccountBilling(job,env.STRIPE_SECRET_KEY?.trim()||'',options.send,started+30000)){await call('release',job);return {state:'pending' as const}}
     await call('advance',job,'files');job.phase='files';break
    case 'files':{
     failure='storage'
     const plan=await call('files',job);if(!Array.isArray(plan.objects)||plan.objects.length>100)throw Error('storage')
     if(!plan.objects.length){await call('advance',job,'data');job.phase='data';break}
     const groups=new Map<string,string[]>()
     for(const object of plan.objects){if(!object||!buckets.has(object.bucket_id)||typeof object.name!=='string'||!object.name||object.name.length>2048)throw Error('storage');groups.set(object.bucket_id,[...(groups.get(object.bucket_id)||[]),object.name])}
     for(const [bucket,paths] of groups){const result=await service.storage.from(bucket).remove(paths);if(result.error)throw Error('storage')}
     // Re-query the same first page, never offset over a changing object list.
     break
    }
    case 'data':
     failure='schema';await call('erase_data',job);job.phase='auth';break
    case 'auth':{
     failure='schema';await call('authorize_auth',job)
     failure='auth'
     if(!await accountActuallyRemoved(service,job.account_id)){
      const identity=await service.auth.admin.getUserById(job.account_id)
      if(identity.error||identity.data.user?.id!==job.account_id||identity.data.user.email?.toLowerCase()!==job.verified_email.toLowerCase())throw Error('auth')
      const result=await service.auth.admin.deleteUser(job.account_id,false);if(result.error&&!await accountActuallyRemoved(service,job.account_id))throw Error('auth')
     }
     if(!await accountActuallyRemoved(service,job.account_id))throw Error('auth')
     failure='verify';await call('verify',job);job.phase='confirmation';break
    }
    case 'confirmation':
     failure='verify'
     if(!await accountActuallyRemoved(service,job.account_id))throw Error('verify')
     await call('verify',job)
     failure='mail'
     if(!env.RESEND_API_KEY||!await sendDeletionConfirmation(job.verified_email,job.id,env.RESEND_API_KEY,options.send))throw Error('mail')
     await call('complete',job)
     return {state:'completed' as const}
   }
  }
  await call('release',job)
  return {state:'pending' as const}
 }catch{
  // Persist only a fixed error code. No provider payload, email, token or file path in logs/queue errors.
  await call('retry',job,failure)
  console.error('Account erasure step will retry',{requestId:job.id,step:failure})
  return {state:'retry' as const}
 }
}
