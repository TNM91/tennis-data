import {html} from './match-details'

export function competitionScheduleClock(timeZone:string) {
 const parts=new Intl.DateTimeFormat('en-US',{
  timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',
 }).formatToParts(new Date())
 const value=(type:Intl.DateTimeFormatPartTypes)=>parts.find(part=>part.type===type)?.value
 return {day:`${value('year')}-${value('month')}-${value('day')}`,time:`${value('hour')}:${value('minute')}`}
}

export function competitionScheduleJumpHtml(id:string,matchup:string) {
 return id?`<button type="button" class="secondary competition-schedule-jump" data-competition-schedule-jump="${html(id)}">
  <span>View in schedule<span class="sr-only"> for ${html(matchup)}</span></span><span class="app-tool-arrow" aria-hidden="true">›</span>
 </button>`:''
}

export function bindCompetitionScheduleJumps(host:HTMLElement,open:(id:string)=>void) {
 host.querySelectorAll<HTMLButtonElement>('[data-competition-schedule-jump]').forEach(button=>{
  button.onclick=()=>open(button.dataset.competitionScheduleJump!)
 })
}

export function competitionScheduleJumpButton(host:HTMLElement,id:string) {
 return host.querySelector<HTMLButtonElement>(`[data-competition-schedule-jump="${CSS.escape(id)}"]`)
}

export function focusCompetitionMatch(host:HTMLElement,id:string,onBack:()=>void,backLabel='Back to overview') {
 const key=CSS.escape(id)
 const match=host.querySelector<HTMLElement>(`[data-competition-schedule-match="${key}"],[data-competition-draw-match="${key}"]`)
 const heading=match?.querySelector<HTMLElement>('.competition-opponents')
 if(!match||!heading)return false
 const back=document.createElement('button')
 back.type='button'
 back.className='secondary competition-schedule-return'
 back.textContent=backLabel
 back.onclick=onBack
 match.append(back)
 heading.tabIndex=-1
 heading.focus({preventScroll:true})
 match.scrollIntoView({block:'start'})
 return true
}

export function focusCalendarCompetitionMatch(host:HTMLElement,id:string,heading:HTMLElement|null,onBack:()=>void) {
 if(focusCompetitionMatch(host,id,onBack,'Back to calendar')||!heading)return
 const notice=document.createElement('p')
 notice.className='rating-context'
 notice.textContent='The match from Calendar isn’t in this published view.'
 notice.tabIndex=-1
 heading.after(notice)
 notice.focus()
}

export function competitionMatchGroupsHtml<T>(rows:T[],groupBy:(row:T)=>string,labelFor:(key:string)=>string,renderMatch:(row:T)=>string) {
 const groups=new Map<string,T[]>()
 for(const row of rows){
  const key=groupBy(row),group=groups.get(key)||[]
  group.push(row)
  groups.set(key,group)
 }
 return `<div class="competition-match-groups">${[...groups].map(([key,group])=>`<section class="competition-match-group">
  <div class="competition-match-group-heading"><h4>${html(labelFor(key))}</h4><small>${group.length} ${group.length===1?'match':'matches'}</small></div>
  ${group.map(renderMatch).join('')}
 </section>`).join('')}</div>`
}

export function competitionScheduleHtml(date:string,time:string,location:string) {
 if(!date&&!time&&!location)return ''
 return `<div class="fixture-schedule">
  ${date?`<p class="fixture-schedule-date">${html(date)}</p>`:''}
  ${time?`<p class="fixture-schedule-time">${html(time)}</p>`:''}
  ${location?`<p class="fixture-location">${html(location)}</p>`:''}
 </div>`
}

export function competitionOpponentsHtml(a:string,b:string,heading:'h3'|'h4'|'h5'='h4') {
 return `<${heading} class="competition-opponents"><span class="competition-contender">${html(a)}</span> <span class="fixture-versus">vs</span> <span class="competition-contender">${html(b)}</span></${heading}>`
}

export function competitionOutcomeHtml(label:string,winner:string,score?:string) {
 return `<dl class="competition-outcome">
  <div><dt>${html(label)}</dt><dd${winner?' data-recorded-winner':''}>${html(winner||'Not recorded')}</dd></div>
  ${score===undefined?'':`<div class="competition-outcome-score"><dt>Score</dt><dd>${html(score||'Not recorded')}</dd></div>`}
 </dl>`
}
