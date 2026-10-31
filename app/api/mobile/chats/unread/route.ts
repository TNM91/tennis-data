import {verifiedAccount,accountClient} from '@/lib/mobile-account-auth'
import {nativeChatUnread} from '@/lib/native-chat-unread'
export const runtime='nodejs'
export const maxDuration=30
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}})
export async function GET(request:Request){
 const account=await verifiedAccount(request);if(!account)return json({ok:false},401)
 if(new URL(request.url).search)return json({ok:false},400)
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();if(!key)return json({ok:false},503)
 try{return json({ok:true,...await nativeChatUnread(accountClient(key),account.user.id)})}catch{return json({ok:false},503)}
}
