import {verifiedAccount,accountClient} from '@/lib/mobile-account-auth'
import {calendarRange} from '@/lib/native-calendar-contract'
import {nativeCalendarPractices} from '@/lib/native-calendar-practices'
export const runtime='nodejs'
export const maxDuration=30
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}})
export async function GET(request:Request){
 const account=await verifiedAccount(request);if(!account)return json({ok:false},401)
 const query=new URL(request.url).searchParams
 let range
 try{if([...query.keys()].some(key=>!['from','to'].includes(key)||query.getAll(key).length!==1))throw Error();range=calendarRange(query.get('from'),query.get('to'))}catch{return json({ok:false},400)}
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();if(!key)return json({ok:false},503)
 try{return json({ok:true,...await nativeCalendarPractices(accountClient(key),account.user.id,range)})}catch{return json({ok:false},503)}
}
