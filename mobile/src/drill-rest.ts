import {html} from './match-details'
import type {DrillRoundShortcut} from './drill-playbook'

export const REST_DURATIONS=[30,45,60,90,120] as const
export type RestSnapshot={duration:number;remaining:number;phase:'idle'|'running'|'paused'|'complete'}

// Keep sub-second elapsed time when pausing; a rest countdown never records a rep.
export class RestCountdown {
 private duration=60
 private remainingMs=60000
 private startedAt:number|null=null
 private started=false
 constructor(private now:()=>number=()=>Date.now()){}
 private update(){
  if(this.startedAt===null)return
  const now=Math.max(this.startedAt,this.now())
  this.remainingMs=Math.max(0,this.remainingMs-(now-this.startedAt))
  this.startedAt=this.remainingMs>0?now:null
 }
 snapshot():RestSnapshot{
  this.update()
  return {duration:this.duration,remaining:Math.ceil(this.remainingMs/1000),phase:!this.started?'idle':this.remainingMs===0?'complete':this.startedAt!==null?'running':'paused'}
 }
 start(){this.update();if(this.startedAt===null&&this.remainingMs>0){this.started=true;this.startedAt=this.now()}}
 pause(){this.update();this.startedAt=null}
 reset(){this.remainingMs=this.duration*1000;this.startedAt=null;this.started=false}
 setDuration(seconds:number){
  if(!REST_DURATIONS.some(value=>value===seconds))return false
  this.duration=seconds;this.reset();return true
 }
}
const restTime=(seconds:number)=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`
const restState=(state:RestSnapshot)=>({idle:'Ready when you are',running:'Resting',paused:'Paused',complete:'Rest finished'})[state.phase]
const restAction=(state:RestSnapshot)=>({idle:'Start rest',running:'Pause rest',paused:'Resume rest',complete:'Start rest again'})[state.phase]
const restNotice=(state:RestSnapshot)=>({idle:'Optional rest countdown.',running:'Rest countdown running.',paused:'Rest countdown paused.',complete:'Rest finished.'})[state.phase]
const restIndicator=(state:RestSnapshot)=>state.phase==='idle'?'':`<svg viewBox="0 0 12 12" width="12" height="12" fill="none">${state.phase==='running'?'<circle cx="6" cy="6" r="3" fill="currentColor"/>':state.phase==='paused'?'<path d="M4 2v8M8 2v8" stroke="currentColor" stroke-width="2"/>':'<path d="m2 6 3 3 5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'}</svg>`
export function restTabHtml(state:RestSnapshot,selected=false){
 return `<button type="button" class="secondary" data-court-pane="rest" data-session-control="court-rest" aria-controls="training-court-rest" aria-describedby="training-rest-status" aria-pressed="${selected}">Rest<span class="training-rest-indicator" data-rest-indicator data-rest-phase="${state.phase}" aria-hidden="true" ${state.phase==='idle'?'hidden':''}>${restIndicator(state)}</span></button>
 <span id="training-rest-status" class="training-rest-live-status" data-rest-live-state role="status" aria-live="polite" aria-atomic="true">${restNotice(state)}</span>`
}
export function restCountdownHtml(state:RestSnapshot,locked=false,shortcut:DrillRoundShortcut|null=null){
 const ready=state.phase==='complete'&&Boolean(shortcut)
 return `<section class="training-rest" aria-label="Between rounds">
  <small class="stat-eyebrow">Between rounds</small>
  <p data-rest-state>${restState(state)}</p>
  <button type="button" data-rest-round data-session-control="rest-round" ${ready?'':'hidden'} ${locked?'disabled':''}>${html(shortcut?.label??'Review rounds')}</button>
  <p role="timer" aria-label="Rest remaining" aria-live="off" data-rest-clock>${restTime(state.remaining)}</p>
  <svg class="training-rest-track" viewBox="0 0 100 4" preserveAspectRatio="none" aria-hidden="true"><rect width="100" height="4" rx="2"/><rect data-rest-fill width="${state.remaining/state.duration*100}" height="4" rx="2"/></svg>
  <label for="training-rest-duration">Rest duration</label>
  <div class="training-rest-select"><select id="training-rest-duration" data-rest-duration data-session-control="rest-duration" aria-describedby="training-rest-help" ${locked||state.phase==='running'?'disabled':''}>${REST_DURATIONS.map(seconds=>`<option value="${seconds}" ${seconds===state.duration?'selected':''}>${seconds} seconds</option>`).join('')}</select></div>
  <div class="training-rest-actions">
   <button type="button" ${ready?'class="secondary" ':''}data-rest-action="toggle" data-session-control="rest-toggle" ${locked?'disabled':''}>${restAction(state)}</button>
   <button type="button" class="secondary" data-rest-action="reset" data-session-control="rest-reset" ${locked||state.phase==='idle'?'disabled':''}>Reset rest</button>
  </div>
  <p id="training-rest-help">Visual countdown. Follow your drill’s rest guidance and take longer if needed. Pauses when you leave the app.</p>
 </section>`
}
export function paintRestCountdown(root:HTMLElement,state:RestSnapshot,locked=false,shortcut:DrillRoundShortcut|null=null){
 const live=root.querySelector('[data-rest-live-state]'),indicator=root.querySelector<HTMLElement>('[data-rest-indicator]')
 if(live&&live.textContent!==restNotice(state))live.textContent=restNotice(state)
 if(indicator&&indicator.dataset.restPhase!==state.phase){indicator.dataset.restPhase=state.phase;indicator.hidden=state.phase==='idle';indicator.innerHTML=restIndicator(state)}
 const clock=root.querySelector('[data-rest-clock]')
 if(!clock)return
 const status=root.querySelector('[data-rest-state]'),toggle=root.querySelector<HTMLButtonElement>('[data-rest-action="toggle"]'),reset=root.querySelector<HTMLButtonElement>('[data-rest-action="reset"]'),duration=root.querySelector<HTMLSelectElement>('[data-rest-duration]')
 if(clock&&clock.textContent!==restTime(state.remaining))clock.textContent=restTime(state.remaining)
 if(status&&status.textContent!==restState(state))status.textContent=restState(state)
 const ready=state.phase==='complete'&&Boolean(shortcut),round=root.querySelector<HTMLButtonElement>('[data-rest-round]')
 if(round){const label=shortcut?.label??'Review rounds';if(round.textContent!==label)round.textContent=label;round.hidden=!ready;round.disabled=locked}
 if(toggle){if(toggle.textContent!==restAction(state))toggle.textContent=restAction(state);toggle.disabled=locked;toggle.classList.toggle('secondary',ready)}
 if(reset)reset.disabled=locked||state.phase==='idle'
 if(duration){duration.disabled=locked||state.phase==='running';duration.value=String(state.duration)}
 root.querySelector('[data-rest-fill]')?.setAttribute('width',String(state.remaining/state.duration*100))
}
