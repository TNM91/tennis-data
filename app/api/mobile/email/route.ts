import {accountClient,accountLifecycleReady,accountResponse,readAccountJson,verifiedAccount} from '@/lib/mobile-account-auth'
import {sendNativeAccountCode,validAccountEmail} from '@/lib/native-email-auth'
export const runtime='nodejs'
export async function POST(request:Request){
 const origin=request.headers.get('origin');if(origin&&!['https://www.tenaceiq.com','https://tenaceiq.com','capacitor://localhost','http://localhost'].includes(origin))return accountResponse({ok:false},403)
 const body=await readAccountJson(request),email=validAccountEmail(body?.email)
 if(!email||!body||Object.keys(body).some(k=>!['email','acceptedTerms'].includes(k)))return accountResponse({ok:false},400)
 if(request.headers.has('authorization')){const account=await verifiedAccount(request);if(!account||account.user.email?.toLowerCase()!==email)return accountResponse({ok:false},401)}else if(body.acceptedTerms!==true)return accountResponse({ok:false},400)
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),resend=process.env.RESEND_API_KEY?.trim();if(!key||!resend)return accountResponse({ok:false},503)
 try{const service=accountClient(key);if(!await accountLifecycleReady(service))return accountResponse({ok:false},503)
 const ip=(request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown').slice(0,128),result=await sendNativeAccountCode(service,email,ip,resend)
 return accountResponse({ok:result.ok},result.status,result.status===429?{'Retry-After':'60'}:{})
 }catch{return accountResponse({ok:false},503)}
}
