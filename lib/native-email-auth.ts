import {MEMBERSHIP_TIERS} from './product-story'
import {createHash,randomUUID} from 'node:crypto'
import type {SupabaseClient} from '@supabase/supabase-js'
export function validAccountEmail(value:unknown){if(typeof value!=='string')return null;const email=value.trim().toLowerCase();return email.length<=320&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:null}
export function accountCodeEmail(code:string){if(!/^(?:\d{6}|\d{8})$/.test(code))throw Error('Invalid verification code');return '<!doctype html><html lang="en"><body style="background:#06172f;color:#f1f7ff;font-family:Arial,sans-serif;padding:24px"><h1>Your TenAceIQ code</h1><p>Enter this code in TenAceIQ to finish signing in.</p><p style="font-size:34px;font-weight:700;letter-spacing:6px">'+code+'</p><p>If you are new, confirming your email finishes your '+MEMBERSHIP_TIERS.free.name+' account. Existing access stays the same.</p><p>This code can sign in to your account. Never share it. If you did not request it, ignore this email.</p></body></html>'}
export async function sendNativeAccountCode(service:SupabaseClient,email:string,ip:string,resendKey:string,send:typeof fetch=fetch){
 const digest=(v:string)=>createHash('sha256').update(v).digest('hex')
 const {data:allowed,error:rateError}=await service.rpc('consume_native_email_auth',{p_email_hash:digest('email:'+email),p_ip_hash:digest('ip:'+ip)})
 if(rateError)return {ok:false as const,status:503}
 if(allowed!==true)return {ok:false as const,status:429}
 // The provider creates a new unconfirmed member only if necessary. It never sets a paid role.
 const {data,error}=await service.auth.admin.generateLink({type:'magiclink',email,options:{redirectTo:'https://www.tenaceiq.com/login'}})
 if(error||!data.properties||!/^(?:\d{6}|\d{8})$/.test(data.properties.email_otp))return {ok:false as const,status:503}
 const response=await send('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+resendKey,'Content-Type':'application/json','Idempotency-Key':'native-account-code-'+randomUUID()},body:JSON.stringify({from:'TenAceIQ <welcome@'+(process.env.RESEND_EMAIL_DOMAIN?.trim()||'tenaceiq.com')+'>',to:[email],subject:'Your TenAceIQ sign-in code',html:accountCodeEmail(data.properties.email_otp)}),redirect:'error',signal:AbortSignal.timeout(12000)})
 return response.ok?{ok:true as const,status:202}:{ok:false as const,status:503}
}
