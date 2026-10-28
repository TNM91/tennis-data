import {accountClient,accountLifecycleReady,accountResponse,readAccountJson,verifiedAccount} from '@/lib/mobile-account-auth'
export const runtime='nodejs'
export async function GET(request:Request){return handle(request,false)}
export async function POST(request:Request){return handle(request,true)}
async function handle(request:Request,create:boolean){
 const account=await verifiedAccount(request);if(!account)return accountResponse({ok:false},401)
 if(create){const body=await readAccountJson(request);if(body?.confirmation!=='DELETE'||Object.keys(body).some(k=>k!=='confirmation'))return accountResponse({ok:false},400)}
 if(create&&!account.recent)return accountResponse({ok:false,verificationRequired:true},403)
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();if(!key)return accountResponse({ok:false},503)
 try{const service=accountClient(key);if(!await accountLifecycleReady(service))return accountResponse({ok:false},503)
 const {data,error}=await service.rpc('native_account_deletion_request',{p_owner:account.user.id,p_email:account.user.email,p_create:create})
 if(error||data?.ok!==true||data.reviewDays!==7)return accountResponse({ok:false},503)
 return accountResponse({ok:true,email:account.user.email,reviewDays:7,verificationRequired:!account.recent,request:data.request},create?202:200)
 }catch{return accountResponse({ok:false},503)}
}
