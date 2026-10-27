import {CapacitorHttp,type HttpOptions,type HttpResponse} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import {buildTeamScheduleCalendarItems} from '../../lib/team-schedule-calendar'
import {buildPlayerCalendarItemPayload} from '../../lib/player-calendar-items'
import {loadImportBatch,loadImportDetail,type ImportBatch,type ImportDetail} from './data-imports-data'
import {loadCourtCalendar,parseCourtCalendar,type CourtCalendar} from './lab-calendar'
import {html} from './match-details'
export function scheduleCalendarPlan(owner:string,batch:ImportBatch,detail:ImportDetail){
 if(owner!==batch.owner||batch.kind!=='schedule'||batch.status==='rejected'||detail.ocr!=='processed'||!detail.schedule)throw Error('Open a processed schedule to review its calendar dates.')
 const items=buildTeamScheduleCalendarItems({...detail.schedule,calendarOwnerId:owner}).map(item=>{
  const saved=buildPlayerCalendarItemPayload(item,owner)!
  return {...item,title:saved.title,date:saved.scheduled_date,time:saved.scheduled_time,location:saved.location}
 })
 if(!items.length||items.length>100)throw Error('This schedule needs at least one valid match date before adding it to My Calendar.')
 return {items,skipped:detail.schedule.matches.length-items.length}
}
export type ScheduleCalendarOps={load:()=>Promise<{batch:ImportBatch;detail:ImportDetail|null}>;post:(o:HttpOptions)=>Promise<HttpResponse>;calendar:()=>Promise<CourtCalendar>}
export function createScheduleCalendar(client:SupabaseClient,owner:string,batch:ImportBatch,detail:ImportDetail,current:()=>boolean,injected?:ScheduleCalendarOps){
 const plan=scheduleCalendarPlan(owner,batch,detail)
 let phase:'review'|'saving'|'saved'|'uncertain'='review'
 const own=async()=>{const {data,error}=await client.auth.getSession();if(error||!current()||data.session?.user.id!==owner||!data.session.access_token)throw Error('Close this upload and sign in again.');return data.session.access_token}
 const ops:ScheduleCalendarOps=injected||{load:async()=>{const fresh=await loadImportBatch(client,owner,batch.id,current);return {batch:fresh,detail:await loadImportDetail(client,fresh,current)}},post:o=>CapacitorHttp.post(o),calendar:()=>loadCourtCalendar(client,owner,current)}
 const matches=(calendar:CourtCalendar)=>plan.items.every(item=>calendar.events.some(e=>e.source==='personal'&&e.id===item.id&&e.title===item.title&&e.date===item.date&&e.time.slice(0,5)===item.time&&e.location===item.location&&e.kind==='match'&&!e.recurrence))
 return {plan,getPhase:()=>phase,
  async save(){
   if(phase!=='review'||!current())return
   phase='saving';let requested=false
   try{
    await own();const fresh=await ops.load();await own()
    if(fresh.batch.id!==batch.id||fresh.batch.owner!==owner||fresh.batch.kind!=='schedule'||fresh.batch.status==='rejected'||!fresh.detail||JSON.stringify(fresh.detail)!==JSON.stringify(detail))throw Error('This saved schedule changed. Refresh it and review its calendar dates again.')
    const token=await own();requested=true
    const response=await ops.post({url:'https://www.tenaceiq.com/api/player/calendar-items',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},data:{items:plan.items},disableRedirects:true,responseType:'json',connectTimeout:12000,readTimeout:30000})
    await own()
    const data=response.data as {ok?:boolean;items?:unknown[];savedCount?:number;skippedCount?:number}|null
    if(response.status!==200||data?.ok!==true||data.savedCount!==plan.items.length||data.skippedCount!==0||!Array.isArray(data.items)||data.items.length!==plan.items.length)throw Error('Calendar save not confirmed.')
    const calendar=parseCourtCalendar({ok:true,items:data.items,competitionItems:[],competitionWarning:''})
    if(!matches(calendar))throw Error('Calendar save not confirmed.')
    phase='saved'
   }catch(cause){phase=requested?'uncertain':'review';if(requested)throw Error('The calendar save may still finish. Check saved calendar dates before another save.');throw cause}
  },
  async check(){
   if(phase==='saving'||!current())return false
   await own();const calendar=await ops.calendar();await own()
   const found=matches(calendar);phase=found?'saved':phase==='review'?'review':'uncertain';return found
  },
 }
}
export function scheduleCalendarHtml(controller:ReturnType<typeof createScheduleCalendar>|null,available:boolean,busy=false){
 if(!available)return ''
 const phase=controller?.getPhase(),items=controller?.plan.items||[]
 return '<section class="import-calendar"><h2 tabindex="-1" data-import-calendar-heading>Schedule dates for My Calendar</h2><p>Review the saved schedule before adding personal match dates. Unsaved corrections are not included. This does not confirm an import, reply to team availability, or add events to your iPhone calendar.</p>'+ (controller?'<p>'+items.length+' dates &middot; Skipped rows: '+controller.plan.skipped+' (missing date or repeated match ID).</p><ol>'+items.map(item=>'<li><strong>'+html(item.title)+'</strong><p>'+html(item.date)+' &middot; '+html(item.time||'Time not set')+'</p><p>'+html(item.location||'Location not set')+'</p></li>').join('')+'</ol>'+ (phase==='saved'?'<p role="status">Matching dates are saved in your TenAceIQ calendar. Refresh Your calendar in My Lab to see them.</p>':phase==='uncertain'?'<p role="status">Save not confirmed. Check saved calendar dates; this does not send another save.</p>':'<p>This adds or updates the matching personal entries with these saved dates and locations. It replaces their personal edits and clears repeat/availability settings. These copies do not sync automatically when the schedule changes.</p><label class="import-consent"><input type="checkbox" data-import-calendar-consent> I reviewed these dates and want to add or update my personal calendar.</label><button type="button" data-import-calendar-save disabled>Save dates to My Calendar</button>')+'<button type="button" class="secondary" data-import-calendar-check '+(busy?'disabled':'')+'>Check saved calendar dates</button>':'')+'<button type="button" class="secondary" data-import-calendar-preview '+(busy||phase==='uncertain'?'disabled':'')+'>Review saved schedule dates</button></section>'
}
