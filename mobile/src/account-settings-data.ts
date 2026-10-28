import {CapacitorHttp} from '@capacitor/core'
import {createClient,type SupabaseClient} from '@supabase/supabase-js'
import {supabaseUrl,supabaseKey} from '../../lib/supabase-public-config'
export type DeletionRequest={id:string;status:'requested'|'reviewing'|'erased'|'completed';requestedAt:string;dueAt:string}
export type AccountSettings={email:string;reviewDays:7;fulfillment:'automated';verificationRequired:boolean;request:DeletionRequest|null}
export function parseAccountSettings(value:unknown):AccountSettings|null{
 if(!value||typeof value!=='object')return null;const row=value as Record<string,unknown>
 if(row.ok!==true||row.fulfillment!=='automated'||row.reviewDays!==7||typeof row.email!=='string'||row.email.length>320||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)||typeof row.verificationRequired!=='boolean')return null
 if(row.request!==null){const r=row.request as Record<string,unknown>;if(!r||typeof r.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r.id)||!['requested','reviewing','erased','completed'].includes(String(r.status)))return null;for(const key of ['requestedAt','dueAt'])if(typeof r[key]!=='string'||String(r[key]).length>40||!Number.isFinite(Date.parse(String(r[key]))))return null;if(Date.parse(String(r.dueAt))<Date.parse(String(r.requestedAt)))return null}
 return {email:row.email,reviewDays:7,fulfillment:'automated',verificationRequired:row.verificationRequired,request:row.request as DeletionRequest|null}
}
async function ownedSession(client:SupabaseClient,owner:string,current:()=>boolean){if(!current())throw Error('Visit closed');const {data,error}=await client.auth.getSession();if(error||!current()||data.session?.user.id!==owner)throw Error('Visit closed');return data.session}
export async function readAccountSettings(client:SupabaseClient,owner:string,current:()=>boolean,create=false,transport=CapacitorHttp){
 const session=await ownedSession(client,owner,current),options={url:'https://www.tenaceiq.com/api/mobile/account',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},responseType:'json' as const,disableRedirects:true,connectTimeout:12000,readTimeout:12000}
 const response=create?await transport.post({...options,data:{confirmation:'DELETE',automatic:true,cancelWebBilling:true}}):await transport.get(options)
 await ownedSession(client,owner,current)
 if(response.status===403&&response.data?.verificationRequired===true)throw Error('verification_required')
 if(response.status===409&&['ownership','last_admin','billing'].includes(response.data?.blocked))throw Error('deletion_'+response.data.blocked)
 const parsed=parseAccountSettings(response.data);if(![200,202].includes(response.status)||!parsed||create&&!parsed.request)throw Error('Account unavailable')
 return parsed
}
export function safeBillingPortal(value:unknown){try{if(typeof value!=='string'||value.length>2048)return null;const url=new URL(value);return url.protocol==='https:'&&url.hostname==='billing.stripe.com'&&url.port===''&&!url.username&&!url.password&&!url.hash&&url.pathname.startsWith('/p/session/')?url.href:null}catch{return null}}
export async function loadBillingPortal(client:SupabaseClient,owner:string,current:()=>boolean,transport=CapacitorHttp){
 const session=await ownedSession(client,owner,current),response=await transport.post({url:'https://www.tenaceiq.com/api/checkout/portal',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},data:{},responseType:'json',disableRedirects:true,connectTimeout:12000,readTimeout:12000});await ownedSession(client,owner,current)
 if(response.status===404)throw Error('billing_not_found');const url=safeBillingPortal(response.data?.url);if(response.status!==200||response.data?.ok!==true||!url)throw Error('Billing unavailable');return url
}
export async function requestAccountCode(email:string,acceptedTerms:boolean,client?:SupabaseClient,owner?:string,current:()=>boolean=()=>true,transport=CapacitorHttp){
 if(!current())throw Error('Visit closed');const session=client&&owner?await ownedSession(client,owner,current):null
 const response=await transport.post({url:'https://www.tenaceiq.com/api/mobile/email',headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.access_token}:{})},data:session?{email}:{email,acceptedTerms},responseType:'json',disableRedirects:true,connectTimeout:12000,readTimeout:12000})
 if(client&&owner)await ownedSession(client,owner,current);if(!current())throw Error('Visit closed')
 if(response.status===429)throw Error('code_rate_limited');if(response.status!==202||response.data?.ok!==true)throw Error('Code unavailable')
}

// Verify in memory first: a closed or superseded visit must never persist its late OTP session.
export async function verifyNativeAccountCode(client:SupabaseClient,email:string,token:string,current:()=>boolean,owner?:string,verifier?:Pick<SupabaseClient['auth'],'verifyOtp'>){
 if(!current())throw Error('Visit closed');if(owner)await ownedSession(client,owner,current)
 const isolated=verifier||createClient(supabaseUrl,supabaseKey,{auth:{storageKey:'tenaceiq-email-verification',persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(12000)})}}).auth
 const result=await isolated.verifyOtp({email,token,type:'email'})
 if(!current())throw Error('Visit closed');if(owner)await ownedSession(client,owner,current)
 if(result.error||!result.data.session||result.data.user?.email?.toLowerCase()!==email||owner&&result.data.user.id!==owner)throw Error('Code not verified')
 const session=result.data.session;if(!session.access_token||!session.refresh_token)throw Error('Code not verified')
 if(!current())throw Error('Visit closed')
 const applied=await client.auth.setSession({access_token:session.access_token,refresh_token:session.refresh_token})
 if(applied.error)throw Error('Code not verified')
}
