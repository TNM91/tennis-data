import type {SupabaseClient} from '@supabase/supabase-js'
import {formatCalendarDay,isValidCalendarDate} from '../../lib/calendar-date'
import {publicCompetitionOwner} from '../../lib/native-competitions-contract'
import {todayDateKey} from '../../lib/team-room-match-flow'
import websiteUi from '../generated/website-ui.json'
import {loadCompetitions} from './competitions-data'
import {stLouisCourts} from './explore-court-catalog'
import {openCourtFinder} from './explore-court-finder'
import {courtDirectionsHref,openCourtInvite} from './explore-court-invite'
import {createPrivateCourtStore} from './explore-private-courts'
import {html} from './match-details'
import {Browser} from './native-browser'
import {loadTournaments} from './tournaments-data'

type OpenEvent=(trigger:HTMLElement,id?:string)=>void
export type NearbyExploreOptions={owner:string;onTournaments:OpenEvent}
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
  <div class="explore-nearby-section-heading"><h2 id="explore-courts-title">Public courts</h2><span>St. Louis, MO</span></div>
  <button type="button" class="secondary explore-hit-invite explore-find-courts" data-nearby-find><span aria-hidden="true">${websiteUi.icons.explore}</span>Find courts near me<span class="explore-event-arrow" aria-hidden="true">›</span></button>
  <ul class="explore-court-list">${stLouisCourts.slice(0,3).map(court=>`<li>
   <div><h3>${html(court.name)}</h3><p>${html(court.area)}</p></div>
   <div class="explore-court-links">
    <a data-explore-court-link href="${html(court.source)}" aria-label="Court info for ${html(court.name)}">Court info</a>
    <a data-explore-court-link href="${html(courtDirectionsHref(court))}" aria-label="Directions to ${html(court.name)}">Directions <span aria-hidden="true">↗</span></a>
   </div>
  </li>`).join('')}</ul>
  <button type="button" class="secondary explore-hit-invite" data-nearby-invite><span aria-hidden="true">${websiteUi.icons.teams}</span>Invite to hit<span class="explore-event-arrow" aria-hidden="true">›</span></button>
  <p class="explore-nearby-message" data-explore-court-status role="status" hidden></p>
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
 const privateCourts=createPrivateCourtStore(signedInOwner)
 const picker=overview.querySelector<HTMLSelectElement>('#explore-area')!
 const upcoming=overview.querySelector<HTMLElement>('[data-explore-event-list]')!
 const eventStatus=overview.querySelector<HTMLElement>('[data-explore-event-status]')!
 const followups=overview.querySelector<HTMLElement>('[data-explore-followups]')!
 const courtStatus=overview.querySelector<HTMLElement>('[data-explore-court-status]')!
 let events:ExploreEvent[]=[]
 let loading=true
 let failed=false
 let invite:ReturnType<typeof openCourtInvite>|undefined
 let finder:ReturnType<typeof openCourtFinder>|undefined
 let openingInvite=false

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
  else if(target.matches('[data-nearby-find]')){
   if(!finder?.isOpen()&&!openingInvite)finder=openCourtFinder(target,current,privateCourts,signedInOwner)
  }else if(target.matches('[data-nearby-invite]')&&!invite?.isOpen()&&!openingInvite){
   openingInvite=true
   void privateCourts.list().catch(()=>[]).then(saved=>{
    if(current())invite=openCourtInvite([...stLouisCourts,...saved],target,current,signedInOwner)
   }).finally(()=>{openingInvite=false})
  }
  else if(target.matches('[data-nearby-widen]')){
   picker.value='all';picker.focus({preventScroll:true});changeArea()
  }else if(target.matches('[data-nearby-retry]')){
   picker.focus({preventScroll:true});void load()
  }else if(target instanceof HTMLAnchorElement&&target.hasAttribute('data-explore-court-link')){
   event.preventDefault()
   courtStatus.hidden=true
   void Browser.open({url:target.href}).catch(()=>{
    if(!current())return
    courtStatus.textContent='Couldn’t open the link. Try again.'
    courtStatus.hidden=false
   })
  }
 }
 void load()
 return {dispose:()=>{invite?.dispose();finder?.dispose()},back:()=>{
  if(finder?.isOpen())return finder.back()
  if(!invite?.isOpen())return false
  invite.dispose();return true
 }}
}
