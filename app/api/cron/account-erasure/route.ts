import {accountClient,accountResponse} from '@/lib/mobile-account-auth'
import {erasureConfiguration,runAccountErasure} from '@/lib/account-erasure'
export const runtime='nodejs'
export const maxDuration=60
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET?.trim()
 if(!secret||request.headers.get('authorization')!=='Bearer '+secret)return accountResponse({ok:false},401)
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
 if(!key||!erasureConfiguration())return accountResponse({ok:false},503)
 try{return accountResponse({ok:true,...await runAccountErasure(accountClient(key))})}
 catch{return accountResponse({ok:false},503)}
}
