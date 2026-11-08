import {html} from './match-details'

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
