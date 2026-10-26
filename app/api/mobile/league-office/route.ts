import {getSignedInPlayerApiAuth,loadPlayerAccess} from '@/lib/player-api-auth'
import {loadNativeLeagueOffice} from '@/lib/native-league-office'
export const runtime='nodejs'
export const maxDuration=30
const json=(data:unknown,status:number)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}})
export async function GET(request:Request){
 const auth=await getSignedInPlayerApiAuth(request);if(!auth.ok){auth.response.headers.set('Cache-Control','private, no-store');return auth.response}
 try{const access=await loadPlayerAccess(auth.supabase,auth.userId);if(!access.canUseLeagueTools)return json({ok:false,message:'League Office access is required.'},403);const result=await loadNativeLeagueOffice(auth.supabase,auth.userId,new URL(request.url).searchParams.get('league')||'');return json({ok:true,...result},200)}catch{return json({ok:false,message:'League Office is unavailable. Refresh your access or connection.'},503)}
}
