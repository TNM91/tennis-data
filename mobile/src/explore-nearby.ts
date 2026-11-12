import type {SupabaseClient} from '@supabase/supabase-js'
import {formatCalendarDay,isValidCalendarDate} from '../../lib/calendar-date'
import {publicCompetitionOwner} from '../../lib/native-competitions-contract'
import {todayDateKey} from '../../lib/team-room-match-flow'
import websiteUi from '../generated/website-ui.json'
import {personalCalendarOccurrence,type CalendarOccurrence} from './calendar-data'
import {loadCompetitions} from './competitions-data'
import {stLouisCourts} from './explore-court-catalog'
import {openCourtFinder} from './explore-court-finder'
import {openCourtDirections} from './explore-court-directions'
import {openCourtInfo,type LoadCourtFeedback} from './explore-court-info'
import {openCourtInvite,type CourtInviteCalendar} from './explore-court-invite'
import {createPrivateCourtStore} from './explore-private-courts'
import {html} from './match-details'
import {loadLatestCourtFeedback} from './personal-match-data'
import {loadTournaments} from './tournaments-data'

type OpenEvent=(trigger:HTMLElement,id?:string)=>void
export type NearbyExploreOptions={owner:string;onTournaments:OpenEvent;calendar?:{
 changed:()=>void;open:(trigger:HTMLElement,event:CalendarOccurrence)=>void
}}
type ExploreEvent={id:string;kind:'league'|'tournament';name:string;date:string;location:string}

const areaPreference='tiq.explore.play-area'
const stLouisArea=/\b(?:st\.?\s*louis|saint\s+louis)\b|\b(?:ballwin|chesterfield|creve coeur|des peres|kirkwood|maryland heights|webster groves),?\s+(?:mo|missouri)\b/i
const monthFormat=new Intl.DateTimeFormat('en-US',{month:'short',timeZone:'UTC'})

export function nearbyAreaHtml(){
 return `<label class="explore-nearby-area" for="explore-area"><span>Area</span>
  <span class="explore-picker">
   <select id="explore-area"><option value="all">All areas</option><option value="stl">St. Louis area</option></select>
   ${websiteUi.actionIcons.down}
  </span>
 </label>`
}

export function nearbySectionsHtml(guest:boolean){
 return `<section class="explore-nearby-section" aria-labelledby="explore-upcoming-title">
  <h2 id="explore-upcoming-title">Upcoming play</h2>
  <div data-explore-events>
   <div data-explore-event-list></div>
   <p class="explore-nearby-message" data-explore-event-status role="status"></p>
   <div data-explore-followups></div>
  </div>
  <div class="explore-nearby-actions">
   <button class="secondary" type="button" data-nearby-leagues><span aria-hidden="true">${websiteUi.icons.leagues}</span>Browse leagues</button>
   <button class="secondary" type="button" data-nearby-tournaments><span aria-hidden="true">${websiteUi.icons.tournaments}</span>${guest?'Sign in for tournaments':'Browse tournaments'}</button>
  </div>
 </section>
 <section class="explore-nearby-section" aria-labelledby="explore-courts-title">
  <div class="explore-nearby-section-heading"><h2 id="explore-courts-title">Courts</h2><span>St. Louis, MO</span></div>
  <button type="button" class="secondary explore-find-courts" data-nearby-find="all" aria-haspopup="dialog"><span aria-hidden="true">${websiteUi.icons.explore}</span>Find courts near me<span class="explore-event-arrow" aria-hidden="true">›</span></button>
  <div class="explore-nearby-actions explore-court-shortcuts" role="group" aria-label="Court shortcuts">
   <button type="button" class="secondary" data-nearby-find="club" aria-haspopup="dialog"><span aria-hidden="true">${websiteUi.actionIcons.members}</span>Tennis clubs</button>
   <button type="button" class="secondary" data-nearby-invite aria-haspopup="dialog"><span aria-hidden="true">${websiteUi.actionIcons.send}</span>Invite to hit</button>
  </div>
  <h3 class="explore-public-courts-title" id="explore-public-courts-title">Public courts</h3>
  <ul class="explore-court-list" aria-labelledby="explore-public-courts-title">${stLouisCourts.slice(0,3).map(court=>`<li>
   <div><h4>${html(court.name)}</h4><p>${html(court.area)}</p></div>
   <div class="explore-court-links">
    <button class="secondary explore-court-info" type="button" data-nearby-court-info="${html(court.id)}" aria-label="Court info for ${html(court.name)}" aria-haspopup="dialog">Court info</button>
    <button class="secondary explore-court-directions" type="button" data-nearby-directions="${html(court.id)}" aria-label="Directions to ${html(court.name)}" aria-haspopup="dialog">Directions</button>
   </div>
  </li>`).join('')}</ul>
 </section>`
}

function eventHtml(event:ExploreEvent){
 const month=monthFormat.format(new Date(`${event.date}T12:00:00Z`))
 const kind=event.kind==='league'?'League':'Tournament'
 return `<li><button class="secondary explore-event" type="button" data-explore-kind="${event.kind}" data-explore-id="${html(event.id)}" aria-label="View ${event.kind} ${html(event.name)}" aria-describedby="explore-${event.kind}-${html(event.id)}">
  <time datetime="${event.date}"><span>${month}</span><strong>${Number(event.date.slice(-2))}</strong></time>
  <span class="explore-event-copy"><span>${kind}</span><strong>${html(event.name)}</strong><span>${html(event.location||'Location to be confirmed')}</span></span>
  <span class="explore-event-arrow" aria-hidden="true">›</span>
 </button><span class="sr-only" id="explore-${event.kind}-${html(event.id)}">${html(formatCalendarDay(event.date))}${event.location?' · '+html(event.location):''}</span></li>`
}

export function mountNearbyExplore(overview:HTMLElement,client:SupabaseClient,current:()=>boolean,options:NearbyExploreOptions,onLeagues:OpenEvent){
 const {owner,onTournaments}=options
 const guest=owner===publicCompetitionOwner
 const signedInOwner=guest?undefined:owner
 const loadFeedback:LoadCourtFeedback|undefined=signedInOwner
  ?(courtId,active)=>loadLatestCourtFeedback(client,signedInOwner,courtId,active):undefined
 const privateCourts=createPrivateCourtStore(signedInOwner)
 const picker=overview.querySelector<HTMLSelectElement>('#explore-area')!
 const upcoming=overview.querySelector<HTMLElement>('[data-explore-event-list]')!
 const eventStatus=overview.querySelector<HTMLElement>('[data-explore-event-status]')!
 const followups=overview.querySelector<HTMLElement>('[data-explore-followups]')!
 let events:ExploreEvent[]=[]
 let loading=true
 let failed=false
 let invite:ReturnType<typeof openCourtInvite>|undefined
 let finder:ReturnType<typeof openCourtFinder>|undefined
 let directions:ReturnType<typeof openCourtDirections>|undefined
 let info:ReturnType<typeof openCourtInfo>

 const calendarFor=(trigger:HTMLElement):CourtInviteCalendar|undefined=>{
  const calendar=options.calendar
  if(!signedInOwner||!calendar)return
  return {client,changed:calendar.changed,open:saved=>{
   if(!current())return
   invite?.dispose();finder?.dispose();info?.dispose()
   calendar.open(trigger,personalCalendarOccurrence(saved))
  }}
 }

 try { if(localStorage.getItem(areaPreference)==='stl')picker.value='stl' } catch { /* Storage is optional. */ }

 function render(){
  const local=picker.value==='stl'
  const visible=events.filter(event=>!local||stLouisArea.test(event.location)).slice(0,4)
  const status=loading?'Checking upcoming play…':failed?'Some events couldn’t load.':visible.length?'':local?'No upcoming events listed in the St. Louis area.':'No upcoming events listed.'
  upcoming.innerHTML=visible.length?`<ul class="explore-event-list">${visible.map(eventHtml).join('')}</ul>`:''
  eventStatus.className=status?'explore-nearby-message':'sr-only'
  eventStatus.textContent=status||`${visible.length} upcoming ${visible.length===1?'event':'events'}`
  followups.innerHTML=(!loading&&local&&!visible.length?'<button class="secondary explore-nearby-followup" type="button" data-nearby-widen>Browse all areas</button>':'')+
   (!loading&&failed?'<button class="secondary explore-nearby-followup" type="button" data-nearby-retry>Try again</button>':'')
 }

 function changeArea(){
  try { localStorage.setItem(areaPreference,picker.value) } catch { /* The current selection still works. */ }
  render()
 }

 async function load(){
  loading=true
  render()
  const [leagues,tournaments]=await Promise.allSettled([
   loadCompetitions(client,owner,current,'discover'),
   guest?null:loadTournaments(client,owner,current),
  ])
  if(!current())return
  const today=todayDateKey(new Date(),Intl.DateTimeFormat().resolvedOptions().timeZone)
  events=[
   ...(leagues.status==='fulfilled'?leagues.value.leagues.filter(league=>league.status==='active').map(league=>({id:league.id,kind:'league' as const,name:league.name,date:league.startsOn,location:league.location})):[]),
   ...(tournaments.status==='fulfilled'?tournaments.value?.tournaments.filter(tournament=>tournament.status!=='completed').map(tournament=>({id:tournament.id,kind:'tournament' as const,name:tournament.name,date:tournament.date,location:tournament.location}))??[]:[]),
  ].filter(event=>event.date>=today&&isValidCalendarDate(event.date)).sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name))
  failed=leagues.status==='rejected'||tournaments.status==='rejected'
  loading=false
  render()
 }

 picker.onchange=changeArea
 overview.onclick=event=>{
  const target=event.target instanceof Element?event.target.closest<HTMLElement>('button,a'):null
  if(!target||!current())return
  if(target.matches('[data-nearby-leagues]'))onLeagues(target)
  else if(target.matches('[data-nearby-tournaments]'))onTournaments(target)
  else if(target.dataset.exploreKind==='league')onLeagues(target,target.dataset.exploreId)
  else if(target.dataset.exploreKind==='tournament')onTournaments(target,target.dataset.exploreId)
  else if(target.dataset.nearbyFind){
   if(!finder?.isOpen())finder=openCourtFinder(target,current,privateCourts,{
    owner:signedInOwner,loadFeedback,initialType:target.dataset.nearbyFind==='club'?'club':'all',calendar:calendarFor(target),
   })
  }else if(target.matches('[data-nearby-invite]')&&!invite?.isOpen()){
   invite=openCourtInvite(target,current,signedInOwner,undefined,undefined,calendarFor(target))
  }else if(target.dataset.nearbyCourtInfo&&!info?.isOpen()){
   const court=stLouisCourts.find(venue=>venue.id===target.dataset.nearbyCourtInfo)
   if(court)info=openCourtInfo(court,target,current,{owner:signedInOwner,loadFeedback})
  }else if(target.dataset.nearbyDirections&&!directions?.isOpen()){
   const court=stLouisCourts.find(venue=>venue.id===target.dataset.nearbyDirections)
   if(court)directions=openCourtDirections(court,target,current)
  }else if(target.matches('[data-nearby-widen]')){
   picker.value='all';picker.focus({preventScroll:true});changeArea()
  }else if(target.matches('[data-nearby-retry]')){
   picker.focus({preventScroll:true});void load()
  }
 }
 void load()
 return {dispose:()=>{invite?.dispose();finder?.dispose();directions?.dispose();info?.dispose()},back:()=>{
  if(finder?.isOpen())return finder.back()
  if(info?.isOpen())return info.back()
  if(directions?.isOpen()){directions.dispose();return true}
  if(!invite?.isOpen())return false
  invite.dispose();return true
 }}
}
