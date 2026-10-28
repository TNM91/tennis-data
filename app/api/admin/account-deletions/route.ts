import {accountClient,accountResponse,readAccountJson,verifiedAccount} from '@/lib/mobile-account-auth'
import {accountActuallyRemoved,hasDeletionEvidence,sendDeletionConfirmation} from '@/lib/account-deletion-admin'
export const runtime='nodejs'
async function administrator(request:Request){const account=await verifiedAccount(request);if(!account)return null;const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();if(!key)return null;const service=accountClient(key);const {data,error}=await service.from('profiles').select('role').eq('id',account.user.id).limit(1).abortSignal(AbortSignal.timeout(12000)).maybeSingle();return !error&&data?.role==='admin'?{service,id:account.user.id}:null}
export async function GET(request:Request){try{const admin=await administrator(request);if(!admin)return accountResponse({ok:false},403);const {data,error}=await admin.service.rpc('admin_account_deletion_request',{p_actor:admin.id,p_action:'list'});return error||data?.ok!==true?accountResponse({ok:false},503):accountResponse(data)}catch{return accountResponse({ok:false},503)}}
export async function POST(request:Request){try{
 const admin=await administrator(request);if(!admin)return accountResponse({ok:false},403)
 const body=await readAccountJson(request);if(!body||typeof body.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id)||!['review','complete'].includes(String(body.action))||Object.keys(body).some(k=>!['id','action','evidence'].includes(k)))return accountResponse({ok:false},400)
 const invoke=async(action:string)=>admin.service.rpc('admin_account_deletion_request',{p_actor:admin.id,p_action:action,p_id:body.id})
 if(body.action==='review'){const r=await invoke('review');return r.error||r.data?.ok!==true?accountResponse({ok:false},r.data?.status||503):accountResponse({ok:true})}
 if(!hasDeletionEvidence(body.evidence))return accountResponse({ok:false,message:'Complete the erasure review first.'},400)
 let item=await invoke('get');if(item.error||item.data?.ok!==true)return accountResponse({ok:false},item.data?.status||503)
 if(item.data.row.status==='completed')return accountResponse({ok:true})
 const key=process.env.RESEND_API_KEY?.trim();if(!key)return accountResponse({ok:false,message:'Completion email is not configured.'},503)
 const row=item.data.row;if(!row.account_id||!row.verified_email||!['reviewing','erased'].includes(row.status))return accountResponse({ok:false,message:'Start the review first.'},409)
 if(!await accountActuallyRemoved(admin.service,row.account_id))return accountResponse({ok:false,message:'The Auth account still exists or its removal could not be verified.'},409)
 if(row.status==='reviewing'){item=await invoke('confirm_erased');if(item.error||item.data?.ok!==true||item.data.row.status!=='erased')return accountResponse({ok:false,message:'Account records or files still need erasure review.'},item.data?.status||503)}
 if(!await sendDeletionConfirmation(row.verified_email,body.id,key))return accountResponse({ok:false,message:'Erasure verified. Confirmation email was not accepted; retry completion.'},503)
 const done=await invoke('complete');return done.error||done.data?.ok!==true||done.data.row.status!=='completed'?accountResponse({ok:false,message:'Confirmation accepted; completion could not be recorded. Retry completion.'},503):accountResponse({ok:true})
 }catch{return accountResponse({ok:false},503)}}
