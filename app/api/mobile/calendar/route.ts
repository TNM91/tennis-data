import {verifiedAccount,accountClient,readAccountJson} from '@/lib/mobile-account-auth'
import {supabaseKey} from '@/lib/supabase-public-config'
import {calendarId,calendarIntent,calendarRange} from '@/lib/native-calendar-contract'
import {CalendarFault,calendarPersonal,loadNativeCalendar,respondNativeCalendar,writeCalendarPersonal} from '@/lib/native-calendar'
export const runtime='nodejs'
export const maxDuration=30
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}})
async function handle(request:Request,write:boolean){
 const account=await verifiedAccount(request);if(!account)return json({ok:false},401)
 const owner=account.user.id,client=accountClient(supabaseKey,account.token)
 const params=new URL(request.url).searchParams
 if([...params.keys()].some(k=>!['from','to','item'].includes(k)||params.getAll(k).length!==1)||write&&params.size)return json({ok:false},400)
 let intent,range,id=''
 try{if(write)intent=calendarIntent(await readAccountJson(request,12000));else if(params.has('item')){if(params.size!==1)throw Error();id=calendarId(params.get('item'))}else range=calendarRange(params.get('from'),params.get('to'))}catch{return json({ok:false,message:'Review the calendar date and change before trying again.'},400)}
 try{
  if(intent)return json({ok:true,owner,...(intent.action==='respond'?await respondNativeCalendar(client,owner,intent):await writeCalendarPersonal(client,owner,intent))})
  if(id)return json({ok:true,owner,item:await calendarPersonal(client,owner,id)})
  return json({ok:true,...await loadNativeCalendar(client,owner,range!)})
 }catch(error){return json({ok:false,message:error instanceof CalendarFault?error.message:'The calendar result couldn’t be confirmed. Refresh before trying again.'},error instanceof CalendarFault?error.status:503)}
}
export const GET=(request:Request)=>handle(request,false)
export const POST=(request:Request)=>handle(request,true)
