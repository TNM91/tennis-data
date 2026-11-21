import type {SupabaseClient} from '@supabase/supabase-js'
import {formatCalendarDay} from '../../lib/calendar-date'
import type {GrowthSnapshot} from '../../lib/tiq-growth'
import {tiqSkills} from '../../lib/tiq-assessment-skills'
import type {CoachSend} from './coach-workspace-data'
import {growthDay} from './coach-growth-overview'
import {html} from './match-details'
import {loadGrowth, pendingGrowth} from './tiq-growth-data'

type HomeState = {phase:'loading'|'unavailable'} | {phase:'ready';snapshot:GrowthSnapshot;pendingId:string|null;pendingUnavailable:boolean}

export function growthHomeHtml(state:HomeState,today:string) {
  if(state.phase!=='ready')return `<section class="lab-practice-focus" aria-label="Your practice focus"><h2>Your practice focus</h2><p role="status">${state.phase==='loading'?'Loading your saved plan…':'Your practice plan couldn’t load.'}</p>${state.phase==='unavailable'?'<div class="lab-practice-actions"><button type="button" class="secondary" data-plan-retry>Retry plan</button><button type="button" class="secondary" data-plan-open>Open plans</button></div>':''}</section>`
  const activePlan=state.snapshot.plans.find(row=>row.state==='active')
  const plan=state.pendingId&&state.pendingId!==activePlan?.id?undefined:activePlan
  if(!plan&&!state.pendingId&&!state.pendingUnavailable)return ''
  const needsRecovery=Boolean(state.pendingId)||state.pendingUnavailable
  const due=plan&&(plan.completed>=plan.sessions||plan.reviewDate<=today)
  return `<section class="lab-practice-focus" aria-label="Your practice focus"><header><div><small class="stat-eyebrow">Private practice plan</small><h2>${plan?html(tiqSkills.find(skill=>skill.id===plan.skill)!.skill):'Your practice focus'}</h2></div><button type="button" class="secondary lab-practice-refresh" data-plan-retry aria-label="Refresh plan focus">Refresh</button></header>
    ${plan?`<p class="lab-practice-target">${html(plan.target)}</p><p>${needsRecovery?'Last confirmed · ':''}${plan.completed} / ${plan.sessions} practices · Review <time datetime="${html(plan.reviewDate)}" aria-label="${html(formatCalendarDay(plan.reviewDate))}">${html(new Intl.DateTimeFormat(undefined,{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'}).format(new Date(plan.reviewDate+'T12:00:00Z')))}</time></p><progress max="${plan.sessions}" value="${Math.min(plan.completed,plan.sessions)}" aria-label="Planned practices completed"></progress>${due?'<p class="lab-practice-review">Review ready</p>':''}`:''}
    ${needsRecovery?`<p role="status">${state.pendingUnavailable?'Device retry details couldn’t load. Open your plan to recover before editing.':'A plan update needs confirmation. Open it to check the saved result.'}</p>`:''}
    <div class="lab-practice-actions"><button type="button" class="secondary" data-plan-open>${needsRecovery?'Confirm plan update':due?'Review practice plan':'Resume practice plan'}</button></div></section>`
}

export function mountGrowthHome(host:HTMLElement,client:SupabaseClient,owner:string,current:()=>boolean,
  open:(trigger:HTMLElement,id?:string)=>void,send?:CoachSend) {
  let state:HomeState={phase:'loading'},generation=0
  const active=()=>current()&&host.isConnected
  function paint(){
    if(!active())return
    host.innerHTML=growthHomeHtml(state,growthDay());host.hidden=!host.innerHTML
    const opening=host.querySelector<HTMLButtonElement>('[data-plan-open]')
    if(opening)opening.onclick=()=>{if(active()&&!document.querySelector('dialog[open]'))open(opening,state.phase==='ready'?state.pendingId??state.snapshot.plans.find(row=>row.state==='active')?.id:undefined)}
    host.querySelector<HTMLButtonElement>('[data-plan-retry]')?.addEventListener('click',()=>{void refresh()})
  }
  function update(snapshot:GrowthSnapshot|null,pendingId:string|null=null,pendingUnavailable=false){
    if(!active())return
    generation++
    state=snapshot?.owner===owner?{phase:'ready',snapshot,pendingId,pendingUnavailable}:{phase:'unavailable'}
    paint()
  }
  async function refresh(){
    if(!active())return
    const visit=++generation;state={phase:'loading'};paint()
    try{
      const [snapshot,recovery]=await Promise.all([loadGrowth(client,owner,active,null,send),pendingGrowth(owner).then(pending=>({id:pending?.id??null,unavailable:false})).catch(()=>({id:null,unavailable:true}))])
      if(active()&&visit===generation)update(snapshot,recovery.id,recovery.unavailable)
    }catch{if(active()&&visit===generation)update(null)}
  }
  paint();void refresh()
  return {update}
}
