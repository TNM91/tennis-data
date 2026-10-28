import {erasureConfiguration} from './account-erasure'
import {createClient} from '@supabase/supabase-js'
import {supabaseUrl,supabaseKey} from './supabase-public-config'
export const accountResponse=(body:unknown,status=200,extra:Record<string,string>={})=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store',...extra}})
export function accountClient(key:string,token?:string){return createClient(supabaseUrl,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:init?.signal?AbortSignal.any([init.signal,AbortSignal.timeout(12000)]):AbortSignal.timeout(12000)}),...(token?{headers:{Authorization:'Bearer '+token}}:{})}})}
export async function verifiedAccount(request:Request){
 const token=request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];if(!token||token.length>8192)return null
 try{const client=accountClient(supabaseKey),{data,error}=await client.auth.getUser(token);return !error&&data.user?.email&&data.user.email_confirmed_at?{user:data.user,token,recent:recentAccountAuthentication(token,data.user.id)}:null}catch{return null}
}
export async function readAccountJson(request:Request,limit=2048):Promise<Record<string,unknown>|null>{
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')||Number(request.headers.get('content-length')||0)>limit)return null
 const reader=request.body?.getReader();if(!reader)return null
 let bytes=0,text='';const decoder=new TextDecoder()
 try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.length;if(bytes>limit){await reader.cancel();return null}text+=decoder.decode(part.value,{stream:true})}text+=decoder.decode();const value=JSON.parse(text);return value&&typeof value==='object'&&!Array.isArray(value)?value:null}catch{return null}finally{reader.releaseLock()}
}
export async function accountLifecycleReady(service:ReturnType<typeof accountClient>){const {data,error}=await service.rpc('native_account_lifecycle_config');return !!erasureConfiguration()&&!!process.env.RESEND_API_KEY?.trim()&&!!process.env.CRON_SECRET?.trim()&&!error&&data?.version===2&&data?.deletionReviewDays===7&&data?.fulfillment==='automated'&&data?.queueReady===true}

// Called only after getUser has remotely verified this exact JWT. Refresh iat is not reauthentication.
export function recentAccountAuthentication(verifiedToken:string,owner:string,now=Date.now()) {
 try{const parts=verifiedToken.split('.');if(parts.length!==3)return false;const claims=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));return claims.sub===owner&&Array.isArray(claims.amr)&&claims.amr.some((v:unknown)=>{if(!v||typeof v!=='object')return false;const item=v as Record<string,unknown>;return ['otp','password'].includes(String(item.method))&&typeof item.timestamp==='number'&&Number.isFinite(item.timestamp)&&item.timestamp*1000<=now+60000&&item.timestamp*1000>=now-600000})}catch{return false}
}
