import {isValidCalendarDate} from '../../lib/calendar-date'
import {getWeeklyLevelUpPlanReps,type WeeklyLevelUpPlan} from '../../lib/level-up/weekly-plan'

export type CalendarWeeklyRep={planId:string;repId:string;identitySlug:string;weekStart:string}
export type ScheduledPracticeLinks=ReadonlyMap<string,{eventId:string;count:number}>
type LinkedRep=CalendarWeeklyRep&{progress?:{completed:boolean;version:number}}
export const CALENDAR_WEEKLY_REP_CHANGED='tenaceiq:calendar-weekly-rep-changed'
export type CalendarWeeklyRepChange={owner:string;calendarChanged:boolean}

const key=(owner:string)=>'tenaceiq:calendar-weekly-reps:v1:'+owner
const eventId=/^player-calendar-[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i
const limit=500
const validText=(value:unknown,max:number):value is string=>typeof value==='string'&&value.length<=max&&!!value.trim()

export function readCalendarWeeklyReps(owner:string){
 const links=new Map<string,LinkedRep>()
 try{
  const raw=owner?window.localStorage.getItem(key(owner)):null
  if(!raw||raw.length>1_000_000)return links
  const entries:unknown=JSON.parse(raw)
  if(!Array.isArray(entries)||entries.length>limit)return links
  for(const entry of entries){
   if(!Array.isArray(entry)||(entry.length!==5&&entry.length!==7))continue
   const [id,planId,repId,identitySlug,weekStart,completed,version]=entry as unknown[]
   if(typeof id!=='string'||!eventId.test(id)||!validText(planId,240)||!validText(repId,120)||!validText(identitySlug,120)||typeof weekStart!=='string'||!isValidCalendarDate(weekStart))continue
   const progress=typeof completed==='boolean'&&typeof version==='number'&&Number.isSafeInteger(version)?{completed,version}:undefined
   links.set(id,{planId,repId,identitySlug,weekStart,...(progress?{progress}:{})})
  }
 }catch{/* Calendar still works when device storage is unavailable. */}
 return links
}

function writeLinks(owner:string,links:Map<string,LinkedRep>){
 const entries=Array.from(links,([id,{planId,repId,identitySlug,weekStart,progress}])=>{
  const entry:(string|boolean|number)[]=[id,planId,repId,identitySlug,weekStart]
  if(progress)entry.push(progress.completed,progress.version)
  return entry
 }).slice(-limit)
 if(entries.length)window.localStorage.setItem(key(owner),JSON.stringify(entries))
 else window.localStorage.removeItem(key(owner))
}

export const calendarWeeklyRepKey=(rep:CalendarWeeklyRep)=>JSON.stringify([rep.planId,rep.repId,rep.identitySlug,rep.weekStart])

export function readScheduledPracticeLinks(owner:string):ScheduledPracticeLinks{
 const dates=new Map<string,{eventId:string;count:number}>()
 for(const [eventId,rep] of readCalendarWeeklyReps(owner)){
  const key=calendarWeeklyRepKey(rep)
  dates.set(key,{eventId,count:(dates.get(key)?.count??0)+1})
 }
 return dates
}

export function notifyCalendarWeeklyRepChange(owner:string,calendarChanged:boolean){
 const detail:CalendarWeeklyRepChange={owner,calendarChanged}
 window.dispatchEvent(new CustomEvent(CALENDAR_WEEKLY_REP_CHANGED,{detail}))
}

export function saveCalendarWeeklyRep(owner:string,id:string,rep:CalendarWeeklyRep|null){
 if(!owner||!eventId.test(id))return
 try{
  const links=readCalendarWeeklyReps(owner)
  links.delete(id)
  if(rep)links.set(id,rep)
  writeLinks(owner,links)
  if(rep)notifyCalendarWeeklyRepChange(owner,true)
 }catch{/* The saved calendar event is independent of the shortcut. */}
}

export function syncCalendarWeeklyRepProgress(owner:string,plans:WeeklyLevelUpPlan[]){
 if(!owner||!plans.length)return
 const links=readCalendarWeeklyReps(owner)
 if(!links.size)return
 const weeks=new Map(plans.map(plan=>[plan.id,plan]))
 let changed=false,completionChanged=false
 for(const [id,link] of links){
  const plan=weeks.get(link.planId)
  if(!plan||plan.identitySlug!==link.identitySlug||plan.weekStart!==link.weekStart)continue
  const version=Date.parse(plan.updatedAt)
  if(!Number.isFinite(version)||version<(link.progress?.version??-Infinity))continue
  const completed=Boolean(getWeeklyLevelUpPlanReps(plan).find(rep=>rep.id===link.repId)?.completedAt)
  if(link.progress?.completed===completed&&link.progress.version===version)continue
  if(Boolean(link.progress?.completed)!==completed)completionChanged=true
  links.set(id,{...link,progress:{completed,version}})
  changed=true
 }
 if(!changed)return
 try{
  writeLinks(owner,links)
  if(completionChanged)notifyCalendarWeeklyRepChange(owner,false)
 }catch{/* Saved week progress is independent of device storage. */}
}

export function clearCalendarWeeklyReps(owner:string){
 try{if(owner)window.localStorage.removeItem(key(owner))}catch{/* Storage can be unavailable. */}
}
