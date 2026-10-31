import {nativeCoachChatUnread} from '@/lib/native-coach-chat-unread'
import {supabaseKey} from '@/lib/supabase-public-config'
import {verifiedAccount,accountClient} from '@/lib/mobile-account-auth'
import {nativeChatUnread} from '@/lib/native-chat-unread'
export const runtime='nodejs'
export const maxDuration=30
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}})
export async function GET(request:Request){
 const account=await verifiedAccount(request);if(!account)return json({ok:false},401)
 if(new URL(request.url).search)return json({ok:false},400)
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();if(!key)return json({ok:false},503)
 try{const [teams,coach]=await Promise.all([nativeChatUnread(accountClient(key),account.user.id),nativeCoachChatUnread(accountClient(supabaseKey,account.token),account.user.id).catch(()=>{console.warn('native_coach_unread_unavailable');return {available:false,total:0,connections:[]}})]);return json({ok:true,...teams,coach})}catch{return json({ok:false},503)}
}
