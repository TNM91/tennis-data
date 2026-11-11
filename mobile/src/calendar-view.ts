import type {SupabaseClient} from '@supabase/supabase-js'
import {html} from './match-details'
import {COMPETITION_DATES_UNAVAILABLE,calendarDraft,personalDraft,sameCalendarDraft,type CalendarDraft,type CalendarIntent,type NativeCalendar} from '../../lib/native-calendar-contract'
import type {PlayerCalendarItem} from '../../lib/player-calendar-items'
import {formatCaptainPracticeTimeRange} from '../../lib/captain-practice-invite'
import {CalendarRequestFault,calendarRequest,readCalendarItem,calendarWindow,shiftCalendarDay,shiftCalendarPeriod,localCalendarDate,calendarExport,calendarMatchExport,calendarMatchVenueHref,calendarTournamentEntry,exportableCalendarOccurrences,personalCalendarOccurrence,personalOccurrenceKey,isCurrentCalendarOccurrence,isPracticeInProgress,isScheduledCompetitionMatch,type CalendarOccurrence} from './calendar-data'
import {loadCalendarSources} from './calendar-practices-data'
import {createCalendarFinder} from './calendar-finder'
import {CALENDAR_WEEKLY_REP_CHANGED,readCalendarWeeklyReps,saveCalendarWeeklyRep,type CalendarWeeklyRep,type CalendarWeeklyRepChange} from './calendar-weekly-reps'
import {openPlayerPractices} from './player-practices-view'
import {nextMatchTime,openTeamNextMatch} from './team-next-match-view'
import {teamNextMatchRequest} from './team-room-data'
import {openCompetitions} from './competitions-view'
import {openTournaments} from './tournaments-view'
import {openTournamentEntry} from './tournament-entry-view'
import {exportCoachFile,cancelCoachFile} from './native-coach-files'
import {Browser} from './native-browser'
import {firstPartyBuild} from './build-scope'
import {calendarScorecardSeed,type CalendarScorecardSeed} from './personal-match-data'
import websiteUi from '../generated/website-ui.json'

const label=(day:string)=>new Date(day+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'})
function previousMatchSchedule(before:Pick<CalendarOccurrence,'date'|'time'>&{location?:string},after:CalendarOccurrence){
 const beforeTime=before.time.slice(0,5),afterTime=after.time.slice(0,5)
 return [
  before.date!==after.date?label(before.date):'',
  beforeTime!==afterTime?formatCaptainPracticeTimeRange(beforeTime)||'Time not set':'',
  before.location!==undefined&&before.location!==after.location?before.location||'Venue not set':'',
 ].filter(Boolean).join(' · ')
}
const repeatNames:Record<string,string>={'':'Does not repeat','FREQ=DAILY':'Every day','FREQ=WEEKLY':'Every week','FREQ=MONTHLY':'Every month on this day'}
const calendarSources=['personal','competition','coach','team'] as const
const calendarFilters={all:'All types',personal:'Personal',competition:'Competitions','needs-reply':'Needs reply',coach:'Coach',team:firstPartyBuild?'Team matches':'Team practices'} as const
const calendarFilterOptions=Object.entries(calendarFilters).map(([value,label])=>`<option value="${value}">${label}</option>`).join('')
type CalendarFilter=keyof typeof calendarFilters
const groupByDate=(events:CalendarOccurrence[])=>{
 const dates=new Map<string,CalendarOccurrence[]>()
 for(const event of events){
  const group=dates.get(event.date)
  if(group)group.push(event)
  else dates.set(event.date,[event])
 }
 return dates
}
const dateDots=(events:CalendarOccurrence[])=>calendarSources.filter(source=>events.some(event=>event.source===source)).map(source=>`<i class="${source}"></i>`).join('')
type Panel='agenda'|'linked-practice'|'editor'|'review'|'delete'|'respond'|'export'|'match-export'|'recovery'|'leave'
type AgendaOpener={kind:'row'|'featured';key:string}|{kind:'new'|'export'}
type RefreshContext={message?:string;focusKey?:string;focusControl?:string;preferFeatured?:boolean;reviewReply?:CalendarOccurrence}
type MatchAvailability=NativeCalendar['competitions'][number]
type AvailabilityChoice=NonNullable<MatchAvailability['responseStatus']>
const savedReply=(match?:MatchAvailability):AvailabilityChoice=>match?.responseIsStale?'':match?.responseStatus??''
export type TournamentCalendarMatch=Pick<CalendarOccurrence,'id'|'date'|'time'>
export type CalendarStart='all'|'coach'|{practiceTitle:string;weeklyRep?:CalendarWeeklyRep;openDrill?:()=>void;onClose:()=>void}
 |{practiceEventId:string;onPracticeClose:(changed:boolean,message:string)=>void}
 |{tournamentMatch:TournamentCalendarMatch;onClose:(changed:boolean)=>void}
 |{event?:CalendarOccurrence;filter?:'coach'|'competition'|'needs-reply';followMovedMatch?:boolean;onClose:(changed:boolean)=>void}
type OpenCalendarRep=(rep:CalendarWeeklyRep,button:HTMLButtonElement,current:()=>boolean,review:boolean)=>{isOpen:()=>boolean;dispose:()=>void;back:()=>void}
export function openCalendar(client:SupabaseClient,owner:string,current:()=>boolean,trigger?:HTMLElement,initial:CalendarStart='all',openRep?:OpenCalendarRep,openScorecard?:(seed:CalendarScorecardSeed)=>void){
 const practice=typeof initial==='object'&&'practiceTitle' in initial?initial:null
 const linkedPractice=typeof initial==='object'&&'practiceEventId' in initial?initial:null
 const tournamentShortcut=typeof initial==='object'&&'tournamentMatch' in initial
 let initialTournamentMatch=tournamentShortcut?initial.tournamentMatch:undefined
 const highlight=typeof initial==='object'&&!('practiceTitle' in initial)&&!('practiceEventId' in initial)&&!tournamentShortcut?initial:undefined
 const replyShortcut=highlight?.filter==='needs-reply'?highlight.event:undefined
 let initialEvent=replyShortcut?undefined:highlight?.event
 let changed=false
 const dialog=document.createElement('dialog');dialog.className='native-calendar-screen';dialog.setAttribute('aria-label','Your calendar')
 let disposed=false,busy=false,calendar:NativeCalendar|null=null,notice='',mode:'week'|'month'=tournamentShortcut||highlight?.filter==='competition'?'month':'week',anchor=initialTournamentMatch?.date??highlight?.event?.date??localCalendarDate(),day='',shown=100,panel:Panel=linkedPractice?'linked-practice':'agenda',returnPanel:Panel='agenda'
 let practiceLookupFailed=false
 let failedRefresh:RefreshContext|null=null
 let filter:CalendarFilter=tournamentShortcut?'competition':typeof initial==='string'?initial:highlight?.filter??'all'
 let practiceView:ReturnType<typeof openPlayerPractices>|null=null
 let teamMatchView:ReturnType<typeof openTeamNextMatch>|null=null
 let competitionView:ReturnType<typeof openCompetitions>|null=null
 let weeklyRepView:ReturnType<OpenCalendarRep>|null=null
 let draft:CalendarDraft|null=null,baseline='',selected:CalendarOccurrence|null=null,pending:CalendarIntent|null=null,zone='America/Chicago'
 let matchExportZone=''
 let earlierSchedule=''
 let reply:AvailabilityChoice=''
 let draftStart:CalendarDraft|null=null
 let discardDestination:'agenda'|'close'='close'
 let schedulingRep=false
 let scheduledPracticeId=''
 let weeklyReps=readCalendarWeeklyReps(owner)
 const isPersonalPractice=(event:CalendarOccurrence)=>event.source==='personal'&&event.kind==='practice'&&!event.recurring
 const canOpenPractice=(event:CalendarOccurrence)=>isPersonalPractice(event)&&(event.id===scheduledPracticeId||Boolean(openRep&&weeklyReps.has(event.id)))
 const repDone=(id:string)=>weeklyReps.get(id)?.progress?.completed===true
 const practiceAction=(done:boolean)=>done?'View saved rep':'Open practice drill'
 const practiceStatus=(id:string)=>`<span class="cal-rep-status" data-cal-rep-status="${html(id)}"${repDone(id)?'':' hidden'}><span aria-hidden="true">✓</span><span>Rep done</span></span>`
 const practiceButton=(event:CalendarOccurrence,titleId:string)=>{
  const done=repDone(event.id)
  return `<button type="button" class="secondary cal-open-rep" data-cal-open-rep="${html(event.key)}" data-cal-rep-id="${html(event.id)}" ${done?'data-rep-done':''} aria-describedby="${titleId}"><span data-cal-rep-label>${practiceAction(done)}</span><span aria-hidden="true">›</span></button>`
 }
 let agendaOpener:AgendaOpener|null=null
 let query='',agendaScroll=0,finderSource:NativeCalendar|null=null,finder:ReturnType<typeof createCalendarFinder>|null=null
 const active=()=>!disposed&&current()
 const range=()=>calendarWindow(anchor,mode)
 const findEvents=(search:string)=>{
  if(calendar!==finderSource){finderSource=calendar;finder=calendar?createCalendarFinder(calendar):null}
  return finder?.find(search)??[]
 }
 const needsMatchReply=(event:CalendarOccurrence,now:Date)=>Boolean(calendar&&event.matchNeedsReply&&isCurrentCalendarOccurrence(event,calendar,now))
 const matchingEvents=()=>{
  const events=findEvents(query)
  if(filter==='needs-reply'){
   const now=new Date()
   return events.filter(event=>needsMatchReply(event,now))
  }
  return filter==='all'?events:events.filter(event=>event.source===filter)
 }
 const visible=(events=matchingEvents())=>day?events.filter(event=>event.date===day):events
 const selectedMatch=()=>selected?.source==='competition'?calendar?.competitions.find(match=>match.id===selected?.id):undefined
 const selectedTeamMatch=()=>selected?.source==='team'&&selected.kind==='match'?calendar?.teamMatches?.find(match=>match.roomId===selected?.id):undefined
 const scheduledMatch=()=>{
  const match=selectedMatch()
  return match&&isScheduledCompetitionMatch(match)?match:null
 }
 const exportableMatch=()=>scheduledMatch()&&selected?.time?selected:null
 const venueHref=()=>{
  const team=selectedTeamMatch()
  if(team)return calendarMatchVenueHref({location:team.match.facility})
  const match=scheduledMatch()
  return match&&match.date>=localCalendarDate()?calendarMatchVenueHref(match):''
 }
 const exportZone=()=>panel==='match-export'?matchExportZone:zone
 const exportEvents=()=>{
  if(panel!=='match-export')return exportableCalendarOccurrences(visible())
  const event=exportableMatch()
  return event?[event]:[]
 }
 const replyChanged=(match:MatchAvailability)=>Boolean(reply)&&reply!==savedReply(match)
 const hasReplyChanges=()=>{
  const match=selectedMatch()
  return Boolean(match&&replyChanged(match))
 }
 const canConfirmReply=(match:MatchAvailability)=>!busy&&!pending&&match.status!=='Completed'&&replyChanged(match)
 const focus=()=>{
  const step=schedulingRep||linkedPractice?dialog.querySelector<HTMLElement>('.cal-body h2[tabindex]'):null
  const heading=step??dialog.querySelector<HTMLElement>('h2, h1')
  heading?.focus({preventScroll:true})
 }
 const dispose=()=>{
  if(disposed)return
  disposed=true
  window.removeEventListener(CALENDAR_WEEKLY_REP_CHANGED,updatePracticeStatus)
  practiceView?.dispose()
  practiceView=null
  teamMatchView?.dispose()
  teamMatchView=null
  competitionView?.dispose()
  competitionView=null
  weeklyRepView?.dispose()
  weeklyRepView=null
  void cancelCoachFile(owner).catch(()=>{})
  calendar=null;finder=null;finderSource=null;query='';draft=null;draftStart=null;pending=null;initialEvent=undefined;initialTournamentMatch=undefined
  dialog.close()
  dialog.remove()
  if(!current())return
  if(!practice&&trigger?.isConnected)trigger.focus({preventScroll:true})
  if(linkedPractice)linkedPractice.onPracticeClose(changed,notice)
  else if(typeof initial==='object'&&!('practiceEventId' in initial))initial.onClose(changed)
 }
 const dirty=()=>!!draft&&panel!=='agenda'||Boolean(pending)||hasReplyChanges()||Boolean(practiceView?.isOpen())
 const confirmDiscard=(destination:'agenda'|'close')=>{
  discardDestination=destination
  returnPanel=panel
  panel='leave'
  render()
  dialog.querySelector<HTMLElement>('.cal-panel h2')?.focus()
 }
 const cancelEditor=()=>{
  if(linkedPractice||schedulingRep||!calendar){back();return}
  if(draft&&draftStart&&sameCalendarDraft(draft,draftStart))returnAgenda()
  else confirmDiscard('agenda')
 }
 const keepChange=()=>{
  panel=returnPanel
  render()
  if(panel==='respond'&&selectedMatch())dialog.querySelector<HTMLSelectElement>('[data-cal-reply]')?.focus()
  else if(discardDestination==='agenda')dialog.querySelector<HTMLElement>('.cal-form h2')?.focus()
  else if(schedulingRep||linkedPractice)focus()
 }
 const returnFromDetails=()=>{
  if(hasReplyChanges())confirmDiscard('agenda')
  else returnAgenda()
 }
 const returnToMatch=()=>{
  panel='respond';notice='';render()
  dialog.querySelector<HTMLElement>('[data-cal-match-export-review]')?.focus()
 }
 const back=()=>{
  if(weeklyRepView?.isOpen()){weeklyRepView.back();return true}
  if(practiceView?.isOpen()){practiceView.back();return true}
  if(teamMatchView?.isOpen()){teamMatchView.close();return true}
  if(competitionView?.isOpen())return competitionView.back()
  if(busy&&(panel==='linked-practice'||initialTournamentMatch||initialEvent&&highlight?.followMovedMatch)){dispose();return true}
  if(busy){notice='Finishing this calendar check…';status();return true}
  if(panel==='leave'){keepChange();return true}
  if(panel==='match-export'){returnToMatch();return true}
  if(linkedPractice&&(panel==='linked-practice'||panel==='editor'&&draft&&draftStart&&sameCalendarDraft(draft,draftStart))){dispose();return true}
  if(pending||panel==='editor'||panel==='review'||hasReplyChanges()){confirmDiscard('close');return true}
  if(linkedPractice&&panel==='delete'){panel='editor';render();focus();return true}
  if(tournamentShortcut){dispose();return true}
  if(panel!=='agenda'){returnAgenda();return true}
  dispose();return true
 }
 const status=()=>{const p=dialog.querySelector<HTMLElement>('[data-cal-status]');if(p)p.textContent=notice}
 const focusFromEvent=(focusKey:string)=>({
  focusKey,
  preferFeatured:agendaOpener?.kind==='featured'&&agendaOpener.key===focusKey,
 })
 const finishAgendaRead=({focusKey,focusControl,preferFeatured,reviewReply,message}:RefreshContext)=>{
  busy=false
  if(calendar&&initialTournamentMatch){
   const requested=initialTournamentMatch
   if(calendar.warnings.includes(COMPETITION_DATES_UNAVAILABLE))notice='Tournament dates couldn’t load. Refresh to check this match.'
   else{
    initialTournamentMatch=undefined
    const match=calendar.competitions.find(item=>item.id===requested.id&&item.kind==='tournament'&&item.eventType==='match')
    const event=match&&(isScheduledCompetitionMatch(match)||match.status==='Completed')?findEvents('').find(item=>item.key==='competition:'+match.id):undefined
    if(event){
     const previous=previousMatchSchedule(requested,event)
     changed=changed||Boolean(previous)||match?.status==='Completed'
     rememberAgenda({kind:'row',key:event.key})
     openEvent(event,previous)
     return
    }
    changed=true
    notice='This match moved or is no longer on your calendar. Return to My Event for the latest draw.'
   }
  }
  if(!changed&&calendar&&replyShortcut&&replyShortcut.date>=calendar.range.from&&replyShortcut.date<=calendar.range.to){
   const currentReply=findEvents('').find(item=>item.key===replyShortcut.key)
   changed=!currentReply||!needsMatchReply(currentReply,new Date())
  }
  const target=reviewReply??initialEvent
  if(calendar&&target){
   initialEvent=undefined
   const competitionMatch=target.source==='competition'?calendar.competitions.find(item=>item.id===target.id&&item.eventType==='match'):undefined
   const closedReply=reviewReply&&competitionMatch?.status==='Completed'
   const events=reviewReply?findEvents(''):visible()
   const event=events.find(item=>item.key===target.key&&(competitionMatch||!reviewReply&&item.date===target.date))
   if(event&&(closedReply||isCurrentCalendarOccurrence(event,calendar,new Date()))){
    changed=changed||event.date!==target.date||event.title!==target.title||event.time!==target.time||event.endTime!==target.endTime||
     event.location!==target.location||event.readiness!==target.readiness
    if(reviewReply){
     if(day)day=event.date
    }else rememberAgenda({kind:'row',key:event.key})
    openEvent(event,competitionMatch&&!closedReply?previousMatchSchedule(target,event):'',reviewReply&&!closedReply?message:undefined)
    return
   }
   changed=true
   notice=target.source==='team'&&calendar.practicesUnavailable
    ?'This practice couldn’t be checked. Refresh to try again.'
    :notice&&notice!==message?notice:'This event moved or is no longer available. Review your latest dates below.'
  }
  render()
  if(focusKey&&focusAgendaEvent(focusKey,preferFeatured))return
  const control=focusControl?dialog.querySelector<HTMLElement>(failedRefresh?'[data-cal-refresh]':focusControl):null
  if(control)control.focus({preventScroll:focusControl!=='[data-cal-filter]'||Boolean(failedRefresh)})
  else focus()
 }
 const followMovedMatch=async(target:CalendarOccurrence,value:NativeCalendar)=>{
  const today=localCalendarDate()
  const nearby={from:calendarWindow(today,'week').from,to:calendarWindow(shiftCalendarDay(today,14),'week').to}
  notice='Checking nearby weeks for this match…';status()
  const schedule=value.range.from<=nearby.from&&value.range.to>=nearby.to
   ?value
   :await loadCalendarSources(client,owner,active,nearby)
  if(!active())return value
  if(schedule.warnings.includes(COMPETITION_DATES_UNAVAILABLE))throw Error(COMPETITION_DATES_UNAVAILABLE)
  const match=schedule.competitions.find(item=>item.id===target.id&&item.eventType==='match'&&item.status!=='Completed'&&item.date>=today)
  if(!match){
   notice='This event moved or is no longer available. Check another week or switch to Month to see more dates.'
   return value
  }
  mode='week'
  anchor=match.date
  notice=''
  const week=range()
  const inWeek=({date}:{date:string})=>date>=week.from&&date<=week.to
  return {...schedule,range:week,competitions:schedule.competitions.filter(inWeek),
   coach:schedule.coach.filter(inWeek),practices:schedule.practices?.filter(inWeek),
   personal:schedule.personal.filter(item=>item.date<=week.to&&(item.date>=week.from||item.recurrenceRule)),
  }
 }
 const refresh=async(context:RefreshContext={})=>{
  if(!active())return
  const {message='',reviewReply}=context
  busy=true;failedRefresh=null;calendar=null;notice=message||'Loading your tennis dates…';render()
  const expected=range()
  try{
   let value=await loadCalendarSources(client,owner,active,expected)
   if(!active())return
   notice=message
   const target=reviewReply??initialEvent
   if((reviewReply||highlight?.followMovedMatch)&&target?.source==='competition'&&!value.competitions.some(item=>item.id===target.id)){
    try{value=await followMovedMatch(target,value)}
    catch{notice='Couldn’t check other weeks. Browse more dates in Week or Month.'}
    if(!active())return
   }
   calendar=value;shown=100;panel='agenda'
  }
  catch{if(active()){calendar=null;failedRefresh=context;notice=(message?message+' ':'')+'Your calendar couldn’t load. Check your connection and retry.'}}
  finally{if(active())finishAgendaRead(context)}
 }
 const unlinkPractice=(id:string)=>{
  if(id===scheduledPracticeId)scheduledPracticeId=''
  if(weeklyReps.delete(id))saveCalendarWeeklyRep(owner,id,null)
 }
 const missingLinkedPractice=(id:string)=>{
  unlinkPractice(id)
  changed=true;pending=null;draft=null;draftStart=null;selected=null;baseline='';panel='linked-practice'
  notice='This practice is no longer linked to this rep.'
 }
 const readLinkedPractice=async()=>{
  if(!linkedPractice||busy||!active())return
  const id=linkedPractice.practiceEventId
  busy=true;practiceLookupFailed=false;notice='Checking your saved practice…';render();focus()
  try{
   const result=await calendarRequest(client,owner,active,{item:id})
   if(!active())return
   const saved=readCalendarItem(result.item)
   if(saved&&saved.id!==id)throw Error()
   if(!saved||saved.kind!=='practice'||saved.recurrenceRule){missingLinkedPractice(id);return}
   selected=personalCalendarOccurrence(saved)
   busy=false;setDraft(personalDraft(saved),saved.updatedAt);focus()
  }catch{
   if(active()){practiceLookupFailed=true;notice='Couldn’t check this practice. Try again.'}
  }finally{
   if(active()&&busy){busy=false;render();focus()}
  }
 }
 const confirmed=async(context:RefreshContext,{saved,loaded}:{saved?:PlayerCalendarItem|null;loaded?:NativeCalendar}={})=>{
  changed=true
  if(schedulingRep&&saved&&practice?.openDrill){
   scheduledPracticeId=saved.id
   if(practice.weeklyRep){
    weeklyReps.set(saved.id,practice.weeklyRep)
    saveCalendarWeeklyRep(owner,saved.id,practice.weeklyRep)
   }
  }
  const unlinkedId=pending?.action==='delete'?pending.id:saved&&(saved.kind!=='practice'||saved.recurrenceRule)?saved.id:''
  if(unlinkedId)unlinkPractice(unlinkedId)
  if(linkedPractice){notice=context.message??'';dispose();return}
  pending=null
  draft=null
  draftStart=null
  baseline=''
  selected=null
  schedulingRep=false
  panel='agenda'
  if(saved){
   anchor=saved.date
   day=''
   filter='all'
   query=''
  }
  if(loaded){
   calendar=loaded
   failedRefresh=null
   notice=context.message??''
   shown=100
   finishAgendaRead(context)
  }else{
   await refresh(saved?{...context,focusKey:personalOccurrenceKey(saved.id,saved.date)}:context)
  }
 }
 const availabilityContext=(intent:Extract<CalendarIntent,{action:'respond'}>,warning=''):RefreshContext=>{
  const message=warning||(intent.response==='available'?'Saved your “I can play” reply.':'Saved your “I can’t play” reply.')
  return {message,...focusFromEvent('competition:'+intent.eventId),focusControl:filter==='needs-reply'?'[data-cal-filter]':'[data-cal-refresh]'}
 }
 const perform=async(intent:CalendarIntent)=>{
  if(!active()||busy||pending)return
  busy=true;pending=intent;notice='Saving your calendar change…';render()
  try{
   const result=await calendarRequest(client,owner,active,{},intent);if(!active())return
   if(intent.action==='respond'){
    if(result.eventId!==intent.eventId||result.response!==intent.response||typeof result.updatedAt!=='string')throw Error()
    await confirmed(availabilityContext(intent,typeof result.warning==='string'?result.warning:''))
   }
   else{
    const saved=readCalendarItem(result.item)
    if(intent.action==='delete'?saved!==null:!saved||!sameCalendarDraft(personalDraft(saved),intent.item))throw Error()
    await confirmed({message:intent.action==='delete'?'Personal event deleted.':'Personal event saved.'},{saved})
   }
  }catch(error){
   if(!active())return
   if(error instanceof CalendarRequestFault&&error.status===409&&intent.action==='respond'&&selected&&selectedMatch()?.eventType==='match'){
    const reviewReply=selected
    pending=null;selected=null;reply='';changed=true;panel='agenda'
    await refresh({reviewReply,message:'The match or a saved reply changed. Review the latest details before confirming.',focusControl:'[data-cal-refresh]'})
    return
   }
   panel='recovery';notice='We couldn’t confirm the result. Check the saved entry before trying again.'
  }
  finally{if(active()&&busy){busy=false;render();focus()}}
 }
 const recover=async()=>{
  if(!pending||busy||!active())return
  const intent=pending;busy=true;notice='Checking the saved result…';render()
  try{
   if(intent.action==='respond'){
    const reviewReply=selectedMatch()?.eventType==='match'?selected??undefined:undefined
    let value=await loadCalendarSources(client,owner,active,range())
    if(!active())return
    if(reviewReply&&!value.competitions.some(item=>item.id===intent.eventId)){
     value=await followMovedMatch(reviewReply,value)
     if(!active())return
    }else if(value.warnings.includes(COMPETITION_DATES_UNAVAILABLE))throw Error(COMPETITION_DATES_UNAVAILABLE)
    const e=value.competitions.find(e=>e.id===intent.eventId)
    if(e&&e.responseStatus===intent.response&&!e.responseIsStale&&Object.entries(intent.snapshot).every(([k,v])=>e[k as keyof typeof intent.snapshot]===v)){
     await confirmed(availabilityContext(intent),{loaded:value})
     return
    }
    calendar=value;pending=null;panel='agenda';selected=null;reply=''
    if(reviewReply){
     changed=true
     const message='Review the latest match and your saved reply.'
     if(e)notice=message
     finishAgendaRead({reviewReply,message})
     return
    }
    notice='The current reply differs or this date moved. Open the date to review its latest schedule.'
   }else{
    const id=intent.action==='delete'?intent.id:intent.item.id,result=await calendarRequest(client,owner,active,{item:id}),saved=readCalendarItem(result.item);if(!active())return
   if(linkedPractice&&saved&&saved.id!==id)throw Error()
    if(intent.action==='delete'&&!saved||intent.action!=='delete'&&saved&&sameCalendarDraft(personalDraft(saved),intent.item)){
     await confirmed({message:intent.action==='delete'?'Deletion confirmed.':'Your personal event is saved.'},{saved})
     return
    }
    pending=null
   if(linkedPractice&&(!saved||saved.kind!=='practice'||saved.recurrenceRule)){missingLinkedPractice(id);return}
   if(linkedPractice&&saved)selected=personalCalendarOccurrence(saved)
    if(saved){draft=personalDraft(saved);draftStart=draft;baseline=saved.updatedAt;schedulingRep=false;panel='editor';notice='The saved entry differs. Review this latest version before making a change.'}
    else if(intent.action!=='delete'){draft=intent.action==='update'?{...intent.item,id:'player-calendar-'+crypto.randomUUID()}:intent.item;baseline='';panel='editor';notice=intent.action==='update'?'That event is no longer saved. Review a new personal copy.':'No saved entry was found. Review this event before saving it.'}
    else{panel='agenda';notice='Refresh to check your calendar.'}
   }
  }catch{if(active())notice='The saved result is still unavailable. Keep this screen open and check again when connected.'}
  finally{if(active()&&busy){busy=false;render();focus()}}
 }
 const setDraft=(item?:CalendarDraft,stamp='',practiceTitle='')=>{
  draft=item||{id:'player-calendar-'+crypto.randomUUID(),title:practiceTitle.trim().slice(0,160).trim(),date:day||anchor,time:'',location:'',kind:'practice',recurrenceRule:'',availabilityStatus:'',venueDirectoryId:'',venuePreferenceId:''}
  draftStart=draft
  baseline=stamp;schedulingRep=Boolean(practiceTitle);panel='editor';notice='';render()
  if(schedulingRep)focus()
  else dialog.querySelector<HTMLInputElement>('[name="title"]')?.focus()
 }
 const field=(name:string,title:string,value:string,type='text',max=160)=>`<label>${title}<input name="${name}" type="${type}" value="${html(value)}" ${type==='date'?'min="1900-01-01" max="2199-12-31"':''} ${type==='text'?'maxlength="'+max+'"':''}></label>`
 const details=(event:CalendarOccurrence|CalendarDraft,missingTime:string,showVenueSearch=false,venueTime='')=>{
  const time=venueTime||formatCaptainPracticeTimeRange(event.time.slice(0,5),'endTime' in event?event.endTime?.slice(0,5):undefined)
  return `<div class="cal-event-summary">
   <h3>${html(event.title)}</h3>
   ${'detail' in event&&event.detail?`<p>${html(event.detail)}</p>`:''}
   <dl>
    <div><dt>Date</dt><dd><time datetime="${html(event.date)}">${html(label(event.date))}</time></dd></div>
    <div><dt>Time</dt><dd>${html(time||missingTime)}</dd></div>
    <div><dt>Location</dt><dd>${html(event.location||'Location not set')}</dd></div>
   </dl>
   ${showVenueSearch?`<button type="button" class="secondary cal-venue-link" data-cal-venue>${'source' in event&&event.source==='team'?'Find in Apple Maps':'Find venue in Apple Maps'} <span aria-hidden="true">↗</span></button><p class="cal-venue-status" role="status"></p>`:''}
  </div>`
 }
 const availabilityControls=(match:MatchAvailability,readiness:string)=>{
  if(match.status==='Completed')return '<p>Availability replies are closed.</p>'
  const tone=match.responseIsStale?'changed':savedReply(match)==='available'?'available':'neutral'
  const replyStatus=match.responseIsStale?(earlierSchedule?'Reply again for the updated schedule.':'The schedule changed. Review this date before replying.'):readiness
  const statusLine=`<p class="cal-event-readiness" data-tone="${tone}">${html(replyStatus)}</p>`
  const instructions=savedReply(match)?'Choose a different reply if your plans change.':'Choose a reply for the date, time and location shown.'
  return statusLine+`<label>Your reply<select data-cal-reply aria-describedby="cal-reply-help" ${busy?'disabled':''}>
   <option value="" disabled ${reply===''?'selected':''}>Choose your reply</option>
   <option value="available" ${reply==='available'?'selected':''}>I can play</option>
   <option value="unavailable" ${reply==='unavailable'?'selected':''}>I can’t play</option>
  </select></label><p id="cal-reply-help">${instructions}</p>
  <button type="button" data-cal-respond ${canConfirmReply(match)?'':'disabled'}>Confirm availability reply</button>`
 }
 const competitionDatesUnavailable=()=>(filter==='competition'||filter==='needs-reply')&&calendar?.warnings.includes(COMPETITION_DATES_UNAVAILABLE)
 const agendaCount=(list=visible())=>{
  if(!calendar)return busy?'Loading…':'Unavailable'
  if(competitionDatesUnavailable()||filter==='team'&&calendar.practicesUnavailable)return 'Unavailable'
  if(filter==='needs-reply')return `${list.length} ${list.length===1?'match needs':'matches need'} a reply`
  return list.length+' '+(query.trim()?'matching ':'')+(list.length===1?'date':'dates')
 }
 const agendaHighlight=(list:CalendarOccurrence[],now=new Date())=>{
  const today=localCalendarDate(now)
  const snapshot=calendar
  const event=snapshot?list.find(event=>isCurrentCalendarOccurrence(event,snapshot,now)):undefined
  let eyebrow='Play. Plan. Improve.'
  if(event)eyebrow=isPracticeInProgress(event,now)?'Scheduled now':event.date===today?'Today':'Next in this view'
  const top=`<div class="cal-hero-top"><small class="stat-eyebrow">${eyebrow}</small><span aria-hidden="true">${websiteUi.icons.leagues}</span></div>`
  if(!event)return top+'<h2>Your tennis calendar</h2><p>Personal plans and shared dates.</p>'
  const time=event.time?event.time.slice(0,5)+(event.endTime?' – '+event.endTime:''):''
  const dateAndTime=[event.date===today?'':label(event.date),time].filter(Boolean).join(' · ')
  const replyStatus=event.matchNeedsReply?`<p id="cal-highlight-reply" data-cal-reply-needed>${html(event.readiness)}</p>`:''
  const details=`<button type="button" class="secondary" data-cal-open-event="${html(event.key)}" aria-describedby="cal-highlight-title${replyStatus?' cal-highlight-reply':''}">Open event</button>`
  const scheduled=Boolean(openRep&&canOpenPractice(event))
  const actions=scheduled?`<div class="cal-featured-practice">${practiceButton(event,'cal-highlight-title')}${details}</div>`:details
  return top+`<h2 id="cal-highlight-title">${html(event.title)}</h2>${dateAndTime?'<p>'+html(dateAndTime)+'</p>':''}${event.location?'<p>'+html(event.location)+'</p>':''}${replyStatus}${scheduled?practiceStatus(event.id):''}${actions}`
 }
 const agendaRows=(list=visible())=>{
  if(!calendar)return '<p>'+(!busy?'Your dates are unavailable. Retry to check the calendar.':'Loading dates…')+'</p>'
  if(competitionDatesUnavailable())return '<div class="cal-empty"><h3>Competition dates are unavailable.</h3><p>Refresh to check your league and tournament dates.</p></div>'
  if(!list.length&&filter==='needs-reply'&&!query.trim())return '<div class="cal-empty"><h3>No matches need a reply here.</h3><p>Check another date or switch to All types to see more of your calendar.</p></div>'
  if(!list.length&&filter==='competition'&&!query.trim())return '<div class="cal-empty"><h3>No competition dates here.</h3><p>Check another week or month for your league and tournament dates.</p></div>'
  if(!list.length)return filter==='team'&&calendar.practicesUnavailable?'<div class="cal-empty"><h3>Team practices are unavailable.</h3><p>Refresh to check your current invitations.</p></div>':query.trim()?'<div class="cal-empty"><h3>No matching dates loaded.</h3><p>Try another name or venue, clear search, or choose another week or month.</p></div>':'<div class="cal-empty"><h3>No dates in this view.</h3><p>Try all dates, another type or add a personal plan.</p></div>'
  let last=''
  const now=new Date()
  return list.slice(0,shown).map(e=>{
   const heading=e.date!==last?'<h3 class="cal-date">'+html(label(e.date))+'</h3>':''
   last=e.date
   const time=e.time?e.time.slice(0,5):e.source==='team'?'TBD':'All day'
   const type=e.source==='competition'?e.kind:e.source==='coach'?'Coach':e.source==='team'?(e.kind==='match'?'Team match':'Team practice · '+(calendar?.practices?.find(p=>p.id===e.id)?.scope.teamName||'')):'Personal'
   const readiness=e.readiness?`<span${needsMatchReply(e,now)?' data-cal-reply-needed':''}>${html(e.readiness)}</span>`:''
   const scheduled=canOpenPractice(e)
   const titleId='cal-scheduled-rep-'+html(e.id)
   const row=`<button type="button" class="cal-event ${e.source}" data-cal-event="${html(e.key)}"><span class="cal-event-time">${html(time)}</span><span class="cal-event-copy"><small>${html(type)}${e.recurring?' · Repeats':''}</small><strong${scheduled?` id="${titleId}"`:''}>${html(e.title)}</strong>${e.location?'<span>'+html(e.location)+'</span>':''}${readiness}${scheduled?practiceStatus(e.id):''}</span><span aria-hidden="true">›</span></button>`
   return heading+(scheduled?`<div class="cal-scheduled-rep">${row}${practiceButton(e,titleId)}</div>`:row)
  }).join('')+(list.length>shown?'<button class="secondary" data-cal-more>Show more dates</button>':'')
 }
 const dateLabel=(date:string,count:number)=>{
  const formatted=label(date)
  if(!calendar)return formatted+(busy?', loading events':', events unavailable')
  if(competitionDatesUnavailable())return formatted+', competition dates unavailable'
  if(filter==='team'&&calendar.practicesUnavailable)return formatted+', team practices unavailable'
  const matching=query.trim()||filter!=='all'?'matching ':''
  const loaded=filter==='all'&&calendar.practicesUnavailable?' loaded':''
  return `${formatted}, ${count} ${matching}${count===1?'event':'events'}${loaded}`
 }
 const agenda=()=>{
  const window=range(),events=matchingEvents(),byDate=groupByDate(events),dates:string[]=[]
  for(let d=window.from;d<=window.to;d=shiftCalendarDay(d,1))dates.push(d)
  const lead=mode==='month'?(new Date(window.from+'T12:00:00Z').getUTCDay()+6)%7:0
  const now=new Date()
  const list=visible(events),local=localCalendarDate(now),period=mode==='month'?new Date(window.from+'T12:00:00').toLocaleDateString(undefined,{month:'long',year:'numeric'}):label(window.from)+' – '+label(window.to)
  const days=dates.map(date=>{
   const matches=byDate.get(date)??[]
   return `<button data-cal-day="${date}" aria-label="${html(dateLabel(date,matches.length))}" aria-pressed="${day===date}" ${date===local?'aria-current="date"':''} ${busy?'disabled':''}><span>${Number(date.slice(8))}</span><span class="cal-dots" aria-hidden="true">${dateDots(matches)}</span></button>`
  }).join('')
  return `<section class="cal-hero"><div data-cal-highlight>${agendaHighlight(list,now)}</div></section><div class="cal-toolbar"><div class="cal-switch" role="group" aria-label="Calendar view">${(['week','month'] as const).map(m=>'<button data-cal-mode="'+m+'" aria-pressed="'+(mode===m)+'" '+(busy?'disabled':'')+'>'+m[0].toUpperCase()+m.slice(1)+'</button>').join('')}</div><button class="secondary" data-cal-today ${busy?'disabled':''}>Today</button></div><div class="cal-period"><button class="secondary" data-cal-step="-1" aria-label="Previous ${mode}" ${busy?'disabled':''}>‹</button><h3>${html(period)}</h3><button class="secondary" data-cal-step="1" aria-label="Next ${mode}" ${busy?'disabled':''}>›</button></div><div class="cal-grid" aria-label="Choose a date">${['M','T','W','T','F','S','S'].map(d=>'<span class="cal-weekday" aria-hidden="true">'+d+'</span>').join('')}${'<span></span>'.repeat(lead)}${days}</div><div class="cal-legend"><span>● Personal</span><span>● Competition</span><span>● Coach</span><span>● ${firstPartyBuild?'Team match':'Team practice'}</span></div><div class="cal-toolbar cal-filter-toolbar"><button class="secondary" data-cal-all aria-pressed="${!day}" ${busy?'disabled':''}>All dates</button><label class="cal-type"><span>Show</span><select data-cal-filter ${busy?'disabled':''}>${calendarFilterOptions}</select></label></div><div class="cal-search"><label for="cal-search">Find a date</label><div class="cal-search-field"><input id="cal-search" data-cal-query type="search" maxlength="160" autocomplete="off" placeholder="Match, practice, lesson or venue" aria-describedby="cal-search-help" value="${html(query)}" ${busy?'disabled':''}><button type="button" class="secondary" data-cal-clear aria-label="Clear calendar search" ${query?'':'hidden'} ${busy?'disabled':''}>Clear</button></div><p class="cal-search-help" id="cal-search-help">Search names, opponents and venues in this ${mode}.</p></div>${calendar?.warnings.map(w=>'<p class="cal-warning" role="alert">'+html(w)+'</p>').join('')||''}<div class="cal-agenda-title"><h2 tabindex="-1">${day?html(label(day)):'Your agenda'}</h2><span data-cal-count role="status" aria-live="polite" aria-atomic="true">${agendaCount(list)}</span></div><div data-cal-results>${agendaRows(list)}</div><p class="cal-footnote">Competition dates come from your approved entries. ${firstPartyBuild?'':'Team practices appear when you’re invited and have current team access. '}Personal availability notes don’t send an RSVP.</p>`
 }
 const content=()=>{
  if(panel==='agenda')return agenda()
  if(panel==='leave'&&returnPanel==='respond'&&selected?.source==='competition'&&!pending)return `<section class="cal-panel"><h2 tabindex="-1">Leave this availability reply?</h2><p>Your unsaved choice will be discarded.</p><button data-cal-stay>Keep reply</button><button class="secondary" data-cal-discard>${discardDestination==='agenda'?'Discard reply':'Discard and close'}</button></section>`
  if(panel==='leave'&&discardDestination==='agenda')return '<section class="cal-panel"><h2 tabindex="-1">Discard changes?</h2><p>Your changes to this personal event will be discarded.</p><button data-cal-stay>Keep editing</button><button class="secondary" data-cal-discard>Discard changes</button></section>'
  if(panel==='leave')return `<section class="cal-panel"><h2 tabindex="-1">Leave this calendar change?</h2><p>${pending?'The saved result is still unconfirmed. Your calendar will need a fresh check when you return.':'Your unsaved changes will be discarded.'}</p><button data-cal-stay>Keep reviewing</button><button class="secondary" data-cal-discard>Discard and close</button></section>`
  if(panel==='recovery')return '<section class="cal-panel"><h2 tabindex="-1">Check the saved result</h2><p>The connection ended before we could confirm your change. Check your saved calendar before trying again.</p><button data-cal-recover '+(busy?'disabled':'')+'>Check saved entry</button></section>'
  if(panel==='linked-practice')return `<section class="cal-panel"><h2 tabindex="-1">Saved practice</h2>${practiceLookupFailed?'<button type="button" data-cal-practice-retry>Retry practice lookup</button>':''}</section>`
  if(panel==='editor'&&draft)return `<form class="cal-form">
   <h2 tabindex="-1">${schedulingRep?'Schedule practice':linkedPractice?'Edit practice date':baseline?'Edit personal event':'Add personal event'}</h2>
   ${field('title','Title',draft.title)}
   <div class="cal-form-pair">${field('date','Date',draft.date,'date')}${field('time',schedulingRep?'Time':'Time (optional)',draft.time,'time')}</div>
   ${schedulingRep?'<p>Save a private practice on your calendar. Leave the time blank for an all-day entry.</p>':`
    ${field('location','Location (optional)',draft.location)}
    <label>Type<select name="kind">${['practice','match','lesson','reminder','availability'].map(k=>'<option value="'+k+'" '+(draft!.kind===k?'selected':'')+'>'+k[0].toUpperCase()+k.slice(1)+'</option>').join('')}</select></label>
    <label>Repeat<select name="recurrenceRule">${Object.entries(repeatNames).map(([k,v])=>'<option value="'+k+'" '+(draft!.recurrenceRule===k?'selected':'')+'>'+v+'</option>').join('')}</select></label>
    <label data-cal-availability ${draft.kind==='availability'?'':'hidden'}>Personal availability<select name="availabilityStatus"><option value="available" ${draft.availabilityStatus==='available'?'selected':''}>Available</option><option value="unavailable" ${draft.availabilityStatus==='unavailable'?'selected':''}>Unavailable</option></select></label>
    <p>${draft.recurrenceRule?'Edits apply to the whole repeating series. Monthly dates skip months without that day.':'Leave time empty for an all-day entry.'} Personal events don’t book a court, send a team message or reply to a competition.</p>`}
   <button type="submit">${schedulingRep?'Review practice':'Review event'}</button>
   ${baseline&&selected?'<button type="button" class="secondary" data-cal-delete-review>'+(selected.recurring?'Delete repeating series':'Delete event')+'</button>':''}
   <button type="button" class="secondary" data-cal-cancel>Cancel</button>
  </form>`
  if(panel==='review'&&draft)return `<section class="cal-panel cal-event-panel"><h2 tabindex="-1">${schedulingRep?'Review practice':'Review personal event'}</h2>${details(draft,'All day')}<p>${html(draft.kind)} · ${html(repeatNames[draft.recurrenceRule])}</p>${draft.kind==='availability'?'<p>Personal note: '+html(draft.availabilityStatus)+'. No competition reply is sent.</p>':''}${draft.recurrenceRule?'<p>This saves the whole repeating series.</p>':''}<button data-cal-save ${busy?'disabled':''}>${schedulingRep?'Save private practice':baseline?'Save changes':'Save personal event'}</button><button class="secondary" data-cal-edit ${busy?'disabled':''}>Keep editing</button></section>`
  if(panel==='delete'&&selected)return `<section class="cal-panel cal-event-panel"><h2 tabindex="-1">Delete ${selected.recurring?'repeating series':'personal event'}?</h2>${details(selected,'All day')}<p>${selected.recurring?'Every occurrence from this personal series will be removed.':'This removes this personal event from your saved calendar.'}</p><button data-cal-delete ${busy?'disabled':''}>Delete ${selected.recurring?'whole series':'event'}</button><button class="secondary" data-cal-agenda ${busy?'disabled':''}>Keep event</button></section>`
  if(panel==='respond'&&selected?.source==='team'){
   const team=selectedTeamMatch()
   if(team)return `<section class="cal-panel cal-event-panel"><h2 tabindex="-1">Team match</h2>${details(selected,'Time to be confirmed',Boolean(venueHref()),nextMatchTime(team.match))}<button type="button" data-cal-team-match ${busy?'disabled':''}>Open match & availability</button><button class="secondary" data-cal-agenda ${busy?'disabled':''}>Back to calendar</button></section>`
   const closed=selected.teamStatus==='cancelled'||selected.teamStatus==='completed'
   return `<section class="cal-panel cal-event-panel"><h2 tabindex="-1">Team practice</h2>${details(selected,'Time to be confirmed')}<p class="cal-event-readiness">${html(selected.readiness)}</p><p>${closed?'See the saved practice details and your reply.':'Open the practice to check the latest details and your place, then review your RSVP.'}</p><button data-cal-practice ${busy?'disabled':''}>${closed?'View practice':'Open practice & RSVP'}</button><button class="secondary" data-cal-agenda ${busy?'disabled':''}>Back to calendar</button></section>`
  }
  if(panel==='respond'&&selected){
   const match=selectedMatch()
   const eventButton=!tournamentShortcut&&calendarTournamentEntry(match)?'<button type="button" class="secondary" data-cal-my-event>Open My Event</button>':''
   const competitionButton=match?.publishedView&&!(tournamentShortcut&&match.kind==='tournament')?`<button type="button" class="secondary" data-cal-competition>${match.kind==='league'?'View league schedule':'View tournament draw'}</button>`:''
   const scorecardButton=openScorecard&&calendarScorecardSeed(match)?'<button type="button" class="secondary" data-cal-scorecard>Open scorecard in My Lab</button>':''
   const exportButton=exportableMatch()?'<button type="button" class="secondary" data-cal-match-export-review>Export this match</button>':''
   const update=earlierSchedule?`<p id="cal-match-update" class="cal-event-readiness" data-tone="changed"><strong>Match schedule updated</strong><br>Previously ${html(earlierSchedule)}</p>`:''
   const description=[notice?'cal-status':'',update?'cal-match-update':''].filter(Boolean).join(' ')
   const heading=match?.status==='Completed'?'Match details':selected.source==='competition'?'Your availability':'Shared Coach date'
   return `<section class="cal-panel cal-event-panel"><h2 tabindex="-1"${description?` aria-describedby="${description}"`:''}>${heading}</h2>${update}${details(selected,'Time to be confirmed',Boolean(venueHref()))}${match?availabilityControls(match,selected.readiness):'<p>Shared Coach dates are managed with your coach. Open Coach & training to review your plan.</p>'}${eventButton}${competitionButton}${scorecardButton}${exportButton}<button class="secondary" data-cal-agenda ${busy?'disabled':''}>Back to calendar</button></section>`
  }
  if(panel==='export'||panel==='match-export'){
   const single=panel==='match-export',list=exportEvents(),selectedZone=exportZone()
   const zones=[...new Set(['America/Chicago',Intl.DateTimeFormat().resolvedOptions().timeZone,'America/New_York','America/Denver','America/Los_Angeles','Pacific/Honolulu','America/Anchorage'])]
   return `<section class="cal-panel${single?' cal-event-panel':''}"><h2 tabindex="-1">${single?'Export this match':'Export these dates'}</h2>
    ${single&&selected?details(selected,'Time to be confirmed'):`<p>${list.length} ${list.length===1?'date':'dates'} · ${day?html(label(day)):html(label(range().from)+' – '+label(range().to))} · ${calendarFilters[filter]}</p>${query.trim()?'<p>Search: '+html(query)+'</p>':''}`}
    <label${single?' class="cal-type"':''}><span>${single?'Venue time zone':'Times are in'}</span><select data-cal-zone ${busy?'disabled':''}>
     ${single?'<option value="" disabled>Choose a time zone</option>':''}
     ${zones.map(z=>`<option value="${html(z)}" ${z===selectedZone?'selected':''}>${html(z.replaceAll('_',' '))}</option>`).join('')}
    </select></label>
    ${single?'<p>The file reserves 90 minutes for this match. Later schedule changes won’t sync.</p>':`<p>${firstPartyBuild?'Team matches use their venue time zone. Choose a zone for your other dates.':'Choose the zone where these events take place.'} ${firstPartyBuild?'Timed events':'Team practices use their recorded end time when available. Other timed events'} use 90-minute slots; Coach lessons use 60 minutes. Dates without a time export as all day.</p><p>${firstPartyBuild?'':'Cancelled team practices and invalid time ranges are excluded. '}This is a one-time calendar file for the dates, type and search shown. Repeating entries export only occurrences in this view. Later changes won’t sync.</p>`}
    ${!single&&calendar?.warnings.length?'<p class="cal-warning">Some sources are unavailable. This file includes only the dates that loaded.</p>':''}
    <button data-cal-export ${busy||!list.length||!selectedZone?'disabled':''}>Share calendar file</button>
    <button class="secondary" ${single?'data-cal-match-back':'data-cal-agenda'} ${busy?'disabled':''}>${single?'Back to match':'Back to calendar'}</button>
   </section>`
  }
  return ''
 }
 const paintAgenda=()=>{
  if(!active()||panel!=='agenda')return
  const events=matchingEvents(),list=visible(events),byDate=groupByDate(events)
  dialog.querySelectorAll<HTMLButtonElement>('[data-cal-day]').forEach(button=>{
   const date=button.dataset.calDay!,matches=byDate.get(date)??[]
   const name=dateLabel(date,matches.length),dots=button.querySelector('.cal-dots')!
   if(button.getAttribute('aria-label')!==name)button.setAttribute('aria-label',name)
   const markup=dateDots(matches)
   if(dots.innerHTML!==markup)dots.innerHTML=markup
  })
  const rows=dialog.querySelector<HTMLElement>('[data-cal-results]'),count=dialog.querySelector<HTMLElement>('[data-cal-count]'),clear=dialog.querySelector<HTMLButtonElement>('[data-cal-clear]'),exportButton=dialog.querySelector<HTMLButtonElement>('[data-cal-export-review]')
  const highlight=dialog.querySelector<HTMLElement>('[data-cal-highlight]')
  if(highlight)highlight.innerHTML=agendaHighlight(list)
  if(rows)rows.innerHTML=agendaRows(list)
  if(count)count.textContent=agendaCount(list)
  if(clear)clear.hidden=!query
  if(exportButton)exportButton.disabled=busy||!calendar||!exportableCalendarOccurrences(list).length
 }
 const selectAgendaDay=(date:string)=>{
  day=date;shown=100
  dialog.querySelectorAll<HTMLButtonElement>('[data-cal-day],[data-cal-all]').forEach(button=>{
   button.setAttribute('aria-pressed',String((button.dataset.calDay??'')===day))
  })
  const heading=dialog.querySelector('.cal-agenda-title h2')
  if(heading)heading.textContent=day?label(day):'Your agenda'
  paintAgenda()
 }
 const focusAgendaEvent=(key:string,preferFeatured=false)=>{
  if(preferFeatured){
   const button=dialog.querySelector<HTMLButtonElement>('[data-cal-open-event]')
   if(button?.dataset.calOpenEvent===key){
    button.focus({preventScroll:true})
    button.scrollIntoView({block:'nearest'})
    return true
   }
  }
  const position=visible().findIndex(event=>event.key===key)
  if(position<0)return false
  if(position>=shown){shown=Math.ceil((position+1)/100)*100;paintAgenda()}
  const row=Array.from(dialog.querySelectorAll<HTMLButtonElement>('[data-cal-event]')).find(button=>button.dataset.calEvent===key)
  if(!row)return false
  row.focus({preventScroll:true})
  const target=row.closest('.cal-scheduled-rep')??row
  target.scrollIntoView({block:'nearest'})
  return true
 }
 const rememberAgenda=(opener:AgendaOpener)=>{
  agendaOpener=opener
  agendaScroll=dialog.querySelector('.cal-body')?.scrollTop||0
 }
 const openEvent=(event:CalendarOccurrence,previous='',message='')=>{
  if(!calendar)return
  if(event.source==='personal'){
   const saved=calendar.personal.find(item=>item.id===event.id)
   if(!saved)return
   draft=personalDraft(saved)
   draftStart=draft
   baseline=saved.updatedAt
   panel='editor'
  }else{
   reply=savedReply(calendar.competitions.find(item=>item.id===event.id))
   panel='respond'
  }
  selected=event
  earlierSchedule=previous
  notice=message
  render()
  dialog.querySelector<HTMLElement>('.cal-body h2')?.focus()
 }
 const openAgendaEvent=(key:string,kind:'row'|'featured')=>{
  const event=visible().find(item=>item.key===key)
  if(!event)return
  rememberAgenda({kind,key})
  openEvent(event)
 }
 const openPracticeDrill=(button:HTMLButtonElement)=>{
  if(weeklyRepView?.isOpen())return
  const saved=visible().find(e=>e.key===button.dataset.calOpenRep)
  if(!saved||!canOpenPractice(saved))return
  if(saved.id===scheduledPracticeId&&practice?.openDrill){dispose();if(current())practice.openDrill();return}
  const rep=weeklyReps.get(saved.id)
  if(rep&&openRep)weeklyRepView=openRep(rep,button,()=>active()&&button.isConnected,repDone(saved.id))
 }
 const updatePracticeStatus=(event:Event)=>{
  const change=(event as CustomEvent<CalendarWeeklyRepChange>).detail
  if(!change||change.owner!==owner||change.calendarChanged||!active())return
  weeklyReps=readCalendarWeeklyReps(owner)
  // Keep the launch button mounted while the saved week is open above Calendar.
  dialog.querySelectorAll<HTMLElement>('[data-cal-rep-status]').forEach(badge=>{
   badge.hidden=!repDone(badge.dataset.calRepStatus!)
  })
  dialog.querySelectorAll<HTMLButtonElement>('[data-cal-rep-id]').forEach(button=>{
   const done=repDone(button.dataset.calRepId!)
   button.toggleAttribute('data-rep-done',done)
   button.querySelector<HTMLElement>('[data-cal-rep-label]')!.textContent=practiceAction(done)
  })
 }
 const bindAgenda=()=>{
  const input=dialog.querySelector<HTMLInputElement>('[data-cal-query]'),rows=dialog.querySelector<HTMLElement>('[data-cal-results]'),clear=dialog.querySelector<HTMLButtonElement>('[data-cal-clear]')
  if(!input||!rows)return
  const highlight=dialog.querySelector<HTMLElement>('[data-cal-highlight]')
  if(highlight)highlight.onclick=event=>{
   if(!active()||busy||panel!=='agenda')return
   const button=event.target instanceof Element?event.target.closest<HTMLButtonElement>('[data-cal-open-event],[data-cal-open-rep]'):null
   if(button?.dataset.calOpenRep)openPracticeDrill(button)
   else if(button?.dataset.calOpenEvent)openAgendaEvent(button.dataset.calOpenEvent,'featured')
  }
  const reset=()=>{if(!active()||busy||panel!=='agenda'||!input.isConnected)return;query='';input.value='';shown=100;paintAgenda();input.focus({preventScroll:true})}
  input.oninput=()=>{if(!active()||busy||panel!=='agenda'||!input.isConnected)return;query=input.value.slice(0,160);if(input.value!==query)input.value=query;shown=100;paintAgenda()}
  input.onkeydown=event=>{if(event.key==='Escape'&&input.value){event.preventDefault();event.stopPropagation();reset()}}
  if(clear)clear.onclick=reset
  rows.onclick=event=>{
   if(!active()||busy||panel!=='agenda')return
   const button=event.target instanceof Element?event.target.closest<HTMLButtonElement>('[data-cal-event],[data-cal-more],[data-cal-open-rep]'):null
   if(!button||!rows.contains(button))return
   if(button.dataset.calOpenRep){openPracticeDrill(button);return}
   if(button.hasAttribute('data-cal-more')){const first=visible()[shown];if(first)focusAgendaEvent(first.key);return}
   if(button.dataset.calEvent)openAgendaEvent(button.dataset.calEvent,'row')
  }
 }
 const returnAgenda=()=>{
  draft=null;draftStart=null;baseline='';selected=null;panel='agenda';notice='';render()
  const body=dialog.querySelector('.cal-body');if(body)body.scrollTop=agendaScroll
  const origin=agendaOpener
  if((origin?.kind==='featured'||origin?.kind==='row')&&focusAgendaEvent(origin.key,origin.kind==='featured'))return
  const footerOpener=origin?.kind==='new'?'[data-cal-new]':origin?.kind==='export'?'[data-cal-export-review]':null
  const opener=footerOpener?dialog.querySelector<HTMLButtonElement>(footerOpener):null
  ;(opener||dialog.querySelector<HTMLInputElement>('[data-cal-query]'))?.focus({preventScroll:true})
 }
 const render=()=>{
  if(!active())return
  const scroll=dialog.querySelector('.cal-body')?.scrollTop||0
  dialog.innerHTML=`<header class="cal-heading"><div><small class="stat-eyebrow">Your tennis</small><h1 tabindex="-1">Calendar</h1></div><button class="secondary" data-cal-close${tournamentShortcut?' aria-label="Back to My Event"':''}>${tournamentShortcut?'My Event':'Close'}</button></header><div class="cal-body"><p id="cal-status" data-cal-status role="${failedRefresh||pending?'alert':'status'}">${html(notice)}</p>${content()}</div>${panel==='agenda'?'<footer class="cal-actions"><button data-cal-new '+(busy||!calendar?'disabled':'')+'>＋ Add event</button><button class="secondary" data-cal-export-review '+(busy||!exportableCalendarOccurrences(visible()).length?'disabled':'')+'>Export</button><button class="secondary" data-cal-refresh '+(busy?'disabled':'')+'>'+ (failedRefresh?'Retry':'Refresh')+'</button></footer>':''}`
  dialog.querySelector('.cal-body')!.scrollTop=scroll
  const on=(selector:string,fn:(button:HTMLButtonElement)=>void)=>dialog.querySelectorAll<HTMLButtonElement>(selector).forEach(button=>button.onclick=()=>{if(active()&&!busy)fn(button)})
  dialog.querySelector('[data-cal-close]')!.addEventListener('click',back)
  on('[data-cal-cancel]',cancelEditor)
  on('[data-cal-stay]',keepChange)
  on('[data-cal-discard]',()=>{if(discardDestination==='agenda')returnAgenda();else dispose()})
  on('[data-cal-refresh]',()=>void refresh(failedRefresh??{focusControl:'[data-cal-refresh]'}));on('[data-cal-new]',()=>{rememberAgenda({kind:'new'});setDraft()});on('[data-cal-recover]',()=>void recover())
  on('[data-cal-practice-retry]',()=>void readLinkedPractice())
  on('[data-cal-today]',()=>{anchor=localCalendarDate();day=anchor;void refresh({focusControl:'[data-cal-today]'})})
  on('[data-cal-mode]',b=>{
   const next=b.dataset.calMode as typeof mode
   if(next===mode)return
   const nextAnchor=day||anchor
   try{calendarWindow(nextAnchor,next)}catch{return}
   anchor=nextAnchor;mode=next;void refresh({focusControl:`[data-cal-mode="${mode}"]`})
  })
  on('[data-cal-step]',b=>{
   const direction=Number(b.dataset.calStep),next=shiftCalendarPeriod(anchor,mode,direction)
   try{calendarWindow(next,mode)}catch{return}
   anchor=next;day='';void refresh({focusControl:`[data-cal-step="${direction}"]`})
  })
  on('[data-cal-day]',b=>{const date=b.dataset.calDay!;selectAgendaDay(day===date?'':date)})
  on('[data-cal-all]',()=>selectAgendaDay(''))
  const select=dialog.querySelector<HTMLSelectElement>('[data-cal-filter]');if(select){select.value=filter;select.onchange=()=>{filter=select.value as CalendarFilter;shown=100;paintAgenda()}}
  bindAgenda()
  on('[data-cal-practice]',()=>{
   const p=calendar?.practices?.find(p=>p.id===selected?.id);if(!p||practiceView?.isOpen())return
   const context=focusFromEvent('team-practice:'+p.id)
   practiceView=openPlayerPractices(client,owner,p.scope,active,restore=>{practiceView=null;if(!active()||!restore)return;selected=null;panel='agenda';void refresh(context)},'','Back to calendar',p.id)
  })
  on('[data-cal-team-match]',button=>{
   const team=selectedTeamMatch()
   if(!team||teamMatchView?.isOpen())return
   teamMatchView=openTeamNextMatch(client,owner,{...team.scope,id:team.roomId,manualFixture:true},active,updated=>{
    teamMatchView=null
    if(!active())return
    if(updated){
     const context=focusFromEvent('team-match:'+team.roomId)
     panel='agenda';selected=null;void refresh(context)
    }else if(button.isConnected)button.focus({preventScroll:true})
   },()=>false,{calendarSchedule:{revision:team.revision,nextMatch:team.match}})
  })
  on('[data-cal-agenda]',()=>{if(linkedPractice&&panel==='delete')back();else returnFromDetails()})
  on('[data-cal-my-event]',button=>{
   const entry=calendarTournamentEntry(selectedMatch())
   if(!entry||tournamentShortcut||competitionView?.isOpen())return
   competitionView=openTournamentEntry(client,owner,active,entry.parent,entry.division,()=>{competitionView=null},undefined,button,{
    allowCalendar:false,backLabel:'Back to calendar',existingEntry:true,
   })
  })
  on('[data-cal-competition]',button=>{
   const match=selectedMatch(),target=match?.publishedView
   if(!match||!target||competitionView?.isOpen())return
   const prefix=`${match.kind}:${match.competitionId}:`
   const matchId=match.eventType==='match'&&match.id.startsWith(prefix)?match.id.slice(prefix.length):undefined
   competitionView=match.kind==='league'
    ?openCompetitions(client,owner,active,'discover',undefined,undefined,button,target.id,{matchId})
    :openTournaments(client,owner,active,()=>{competitionView=null},undefined,button,'Back to calendar',target.id,{divisionId:target.divisionId,matchId})
  })
  on('[data-cal-scorecard]',()=>{
   const seed=calendarScorecardSeed(selectedMatch())
   if(!seed||!openScorecard)return
   if(pending||hasReplyChanges()){notice='Save or clear your availability reply before opening the scorecard.';status();return}
   dispose()
   if(current())openScorecard(seed)
  })
  const form=dialog.querySelector<HTMLFormElement>('form')
  if(form&&draft){
   const sync=()=>{
    const data=new FormData(form),location=String(data.get('location')??draft!.location),kind=String(data.get('kind')??draft!.kind) as CalendarDraft['kind']
    draft={...draft!,title:String(data.get('title')||''),date:String(data.get('date')||''),time:String(data.get('time')||''),location,kind,recurrenceRule:String(data.get('recurrenceRule')??draft!.recurrenceRule) as CalendarDraft['recurrenceRule'],availabilityStatus:kind==='availability'?String(data.get('availabilityStatus')||'available') as CalendarDraft['availabilityStatus']:'',...(location!==draft!.location?{venueDirectoryId:'',venuePreferenceId:''}:{})}
    const availability=form.querySelector<HTMLElement>('[data-cal-availability]')
    if(availability)availability.hidden=kind!=='availability'
   }
   form.oninput=sync;form.onchange=sync;form.onsubmit=e=>{e.preventDefault();sync();try{draft=calendarDraft(draft);panel='review';notice='';render();focus()}catch(error){notice=error instanceof Error?error.message:'Review this event.';status()}}
  }
  on('[data-cal-edit]',()=>{panel='editor';render();if(schedulingRep||linkedPractice)focus()});on('[data-cal-delete-review]',()=>{panel='delete';render();focus()})
  on('[data-cal-save]',()=>{if(draft)void perform({action:baseline?'update':'create',item:draft,expectedUpdatedAt:baseline})})
  on('[data-cal-delete]',()=>{if(selected)void perform({action:'delete',id:selected.id,expectedUpdatedAt:baseline})})
  const replySelect=dialog.querySelector<HTMLSelectElement>('[data-cal-reply]')
  const confirmReply=dialog.querySelector<HTMLButtonElement>('[data-cal-respond]')
  const match=selectedMatch()
  if(replySelect&&confirmReply&&match)replySelect.onchange=()=>{
   if(!active()||busy||pending||!replySelect.isConnected)return
   const choice=replySelect.value
   reply=choice==='available'||choice==='unavailable'?choice:''
   confirmReply.disabled=!canConfirmReply(match)
  }
  on('[data-cal-respond]',button=>{
   if(panel!=='respond'||!button.isConnected||!match||!reply||!canConfirmReply(match))return
   const {id,title,date,time,location,responseUpdatedAt}=match
   void perform({action:'respond',eventId:id,response:reply,snapshot:{title,date,time,location},expectedResponseUpdatedAt:responseUpdatedAt||'',requestId:crypto.randomUUID()})
  })
  on('[data-cal-export-review]',()=>{rememberAgenda({kind:'export'});panel='export';notice='';render();focus()})
  on('[data-cal-venue]',async button=>{
   const url=venueHref()
   if(!url||button.disabled)return
   const message=dialog.querySelector<HTMLElement>('.cal-venue-status')!
   const team=selectedTeamMatch()
   const matchButton=team&&dialog.querySelector<HTMLButtonElement>('[data-cal-team-match]')
   const stillOpen=()=>active()&&button.isConnected
   let checkingVenue=Boolean(team)
   button.disabled=true
   if(matchButton)matchButton.disabled=true
   try{
    if(team){
     message.textContent='Checking the latest venue…'
     const latest=await teamNextMatchRequest(client,owner,stillOpen,{...team.scope,id:team.roomId,manualFixture:true})
     if(!stillOpen())return
     if(latest.revision!==team.revision||latest.nextMatch?.facility!==team.match.facility){
      const context=focusFromEvent('team-match:'+team.roomId)
      panel='agenda';selected=null
      await refresh({...context,message:'The team schedule changed. Open the match to check the latest venue.'})
      return
     }
    }
    checkingVenue=false
    message.textContent=''
    await Browser.open({url})
   }catch{
    if(stillOpen())message.textContent=checkingVenue?'Couldn’t check the latest venue. Try again.':'Couldn’t open Apple Maps. Try again.'
   }finally{
    if(stillOpen()){
     button.disabled=false
     if(matchButton)matchButton.disabled=false
    }
   }
  })
  on('[data-cal-match-export-review]',()=>{
   if(!exportableMatch())return
   matchExportZone='';panel='match-export';notice='';render()
   dialog.querySelector<HTMLElement>('.cal-body h2')?.focus()
  })
  on('[data-cal-match-back]',returnToMatch)
  const zoneSelect=dialog.querySelector<HTMLSelectElement>('[data-cal-zone]')
  const exportButton=dialog.querySelector<HTMLButtonElement>('[data-cal-export]')
  if(zoneSelect&&exportButton){
   zoneSelect.value=exportZone()
   zoneSelect.onchange=()=>{
    if(panel==='match-export')matchExportZone=zoneSelect.value
    else zone=zoneSelect.value
    exportButton.disabled=!exportZone()||!exportEvents().length
   }
  }
  on('[data-cal-export]',()=>{
   const events=exportEvents(),timeZone=exportZone()
   if(!events.length||!timeZone)return
   const single=panel==='match-export'
   const filename=single?'TenAceIQ-match.ics':`TenAceIQ-${range().from}-${range().to}.ics`
   busy=true;notice='Preparing calendar file…';render()
   void (async()=>{
    try{
     const ics=single?calendarMatchExport(events[0],timeZone):calendarExport(events,timeZone)
     if(!ics){notice='This match time is invalid in that time zone. Check the venue time zone and match details.';return}
     const blob=new Blob([ics],{type:'text/calendar'})
     await exportCoachFile(owner,active,blob,filename)
     if(active())notice='Calendar file prepared. Add it to your preferred calendar to finish.'
    }catch{if(active())notice='Calendar export wasn’t completed. You can try sharing again.'}
    finally{if(active()){busy=false;render()}}
   })()
  })
 }
 window.addEventListener(CALENDAR_WEEKLY_REP_CHANGED,updatePracticeStatus)
 dialog.addEventListener('cancel',e=>{e.preventDefault();back()});document.body.append(dialog);dialog.showModal()
 if(practice)setDraft(undefined,'',practice.practiceTitle)
 else if(linkedPractice)void readLinkedPractice()
 else void refresh()
 return {dispose,isOpen:()=>!disposed&&dialog.open,back,hasDraft:dirty}
}
