import type {SupabaseClient} from '@supabase/supabase-js'
import {CapacitorHttp} from '@capacitor/core'
import {readCalendarPractices} from '../../lib/native-calendar-practices-contract'
import type {CalendarRange,NativeCalendar} from '../../lib/native-calendar-contract'
import {calendarRequest,readCalendar} from './calendar-data'

export async function calendarPracticesRequest(client:SupabaseClient,owner:string,current:()=>boolean,range:CalendarRange,send=CapacitorHttp.get){
 const own=async()=>{const {data,error}=await client.auth.getSession();if(error||!current()||data.session?.user.id!==owner||!data.session.access_token)throw Error('Calendar account changed');return data.session}
 const session=await own(),response=await send({url:'https://www.tenaceiq.com/api/mobile/calendar/practices?'+new URLSearchParams(range),headers:{Authorization:'Bearer '+session.access_token,'Cache-Control':'no-store'},webFetchExtra:{cache:'no-store'},disableRedirects:true,responseType:'json',connectTimeout:12000,readTimeout:30000})
 await own();if(response.status!==200)throw Error('Team practice dates unavailable')
 return readCalendarPractices(response.data,owner,range)
}
export async function loadCalendarSources(client:SupabaseClient,owner:string,current:()=>boolean,range:CalendarRange,base=calendarRequest,team=calendarPracticesRequest):Promise<NativeCalendar>{
 const [calendar,practices]=await Promise.allSettled([base(client,owner,current,range).then(value=>readCalendar(value,owner,range)),team(client,owner,current,range)])
 if(!current()||calendar.status==='rejected')throw Error('Calendar unavailable')
 return {...calendar.value,practices:practices.status==='fulfilled'?practices.value:[],practicesUnavailable:practices.status==='rejected',warnings:[...calendar.value.warnings,...(practices.status==='rejected'?['Team practice dates couldn’t load. Refresh to check them.']:[])]}
}
