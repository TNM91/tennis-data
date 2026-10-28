import {accountClient,accountResponse,verifiedAccount} from '@/lib/mobile-account-auth'
export const runtime='nodejs'
async function administrator(request:Request){
 const account=await verifiedAccount(request);if(!account)return null
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();if(!key)return null
 const service=accountClient(key),{data,error}=await service.from('profiles').select('role').eq('id',account.user.id).limit(1).abortSignal(AbortSignal.timeout(12000)).maybeSingle()
 return !error&&data?.role==='admin'?{service,id:account.user.id}:null
}
export async function GET(request:Request){try{
 const admin=await administrator(request);if(!admin)return accountResponse({ok:false},403)
 const {data,error}=await admin.service.rpc('admin_account_deletion_request',{p_actor:admin.id,p_action:'list'})
 return error||data?.ok!==true?accountResponse({ok:false},503):accountResponse(data)
}catch{return accountResponse({ok:false},503)}}
export async function POST(){return accountResponse({ok:false},405,{Allow:'GET'})}
