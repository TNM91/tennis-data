import {matchResult,matchDate,type RecentMatchRow} from './recent-results'
import {html} from './match-details'
import {statDonutHtml} from './stat-donut'
import type {PersonalMatch} from './personal-match-data'
const formats=['all','singles','doubles'] as const
type FormFormat=typeof formats[number]

/** The latest five decided individual courts from the already loaded sample. */
export function labRecentSample(rows:RecentMatchRow[],playerId:string,filter:FormFormat='all'){
 const seen=new Set<string>()
 return rows.flatMap((row,index)=>{
  const format=(row.match_type||'').trim().toLowerCase()
  if(!row.id||seen.has(row.id)||!['singles','doubles'].includes(format)||!Array.isArray(row.match_players)||!row.match_players.some(player=>player.player_id===playerId))return []
  seen.add(row.id)
  if(filter!=='all'&&format!==filter)return []
  const outcome=matchResult(row,playerId)
  return outcome==='Result pending'?[]:[{row,index,outcome,format}]
 }).slice(0,5)
}
type FormSample={index:number;date:string|null;outcome:'Won'|'Lost';format:string}[]
const linkedSample=(rows:RecentMatchRow[],playerId:string,filter:FormFormat):FormSample=>
 labRecentSample(rows,playerId,filter).map(({row,index,outcome,format})=>({date:row.match_date,index,outcome,format}))

function sampleLabel(count:number,filter:FormFormat,source:string){
 const format=filter==='all'?'':filter+' '
 return count?'Latest '+count+' decided '+format+(count===1?'result':'results')+' in your '+source:'No decided '+format+'results in your '+source+'.'
}

function formSampleHtml(decided:FormSample,filter:FormFormat){
 if(!decided.length)return ''
 const wins=decided.filter(item=>item.outcome==='Won').length,percent=Math.round(wins/decided.length*100)
 const formatLabel=filter==='all'?'individual':filter
 return `<div class="lab-form-marks">${decided.map(({date,index,outcome,format})=>`<button type="button" class="secondary lab-form-mark ${outcome==='Won'?'is-win':'is-loss'}" data-lab-form-index="${index}" aria-label="${outcome} · ${html(matchDate(date))}. Open scorecard"><strong>${outcome==='Won'?'W':'L'}</strong><span>${format==='singles'?'Singles':'Doubles'}</span></button>`).join('')}</div>
 <p class="lab-form-help">Newest first · tap a result for its scorecard</p>
 <div class="lab-form-overview">
  ${statDonutHtml(percent,'Wins in your latest '+decided.length+' decided '+formatLabel+' '+(decided.length===1?'result':'results'))}
  <div class="lab-form-record"><strong>${wins}W · ${decided.length-wins}L</strong><span>Decided win rate</span>
  ${filter==='all'?`<dl>${(['singles','doubles'] as const).map(format=>{
   const sample=decided.filter(item=>item.format===format),won=sample.filter(item=>item.outcome==='Won').length
   const name=format==='singles'?'Singles':'Doubles'
   return `<div><dt>${name}</dt><dd><span>${sample.length?won+'W · '+(sample.length-won)+'L':'No results'}</span>${sample.length?`<meter class="lab-format-meter" min="0" max="${sample.length}" value="${won}" aria-label="${name} wins in your latest ${decided.length} decided results">${won} of ${sample.length}</meter>`:''}</dd></div>`
  }).join('')}</dl>`:''}</div>
 </div>`
}

export function labRecentFormHtml(rows:RecentMatchRow[],playerId:string){
 return formHtml(linkedSample(rows,playerId,'all'),'loaded matches')
}

function formHtml(decided:FormSample,source:string){
 if(!decided.length)return ''
 return `<section class="lab-form-strip" aria-labelledby="lab-form-title">
  <div class="lab-form-heading"><h2 id="lab-form-title">Recent form</h2><span data-lab-form-count>${decided.length} decided</span></div>
  <div class="lab-form-filters" role="group" aria-label="Recent form format">${formats.map(format=>`<button type="button" class="secondary" data-lab-form-filter="${format}" aria-controls="lab-form-sample" aria-pressed="${format==='all'}">${format[0].toUpperCase()+format.slice(1)}</button>`).join('')}</div>
  <p role="status" data-lab-form-status>${sampleLabel(decided.length,'all',source)}</p>
  <div id="lab-form-sample">${formSampleHtml(decided,'all')}</div>
 </section>`
}

export function mountLabRecentForm(host:HTMLElement,rows:RecentMatchRow[],playerId:string,current:()=>boolean,open:(row:RecentMatchRow)=>void){
 mountForm(host,rows,filter=>linkedSample(rows,playerId,filter),'loaded matches',current,row=>open(row))
}

export function mountPersonalRecentForm<T extends Pick<PersonalMatch,'match_date'|'outcome'|'format'>>(host:HTMLElement,rows:T[],current:()=>boolean,open:(row:T,button:HTMLButtonElement)=>void){
 mountForm(host,rows,filter=>rows.flatMap((match,index)=>filter==='all'||filter===match.format
  ?[{index,date:match.match_date,outcome:match.outcome,format:match.format}]:[]).slice(0,5),'match log',current,open)
}

function mountForm<T>(host:HTMLElement,rows:T[],readSample:(filter:FormFormat)=>FormSample,source:string,current:()=>boolean,open:(row:T,button:HTMLButtonElement)=>void){
 host.innerHTML=formHtml(readSample('all'),source)
 const sample=host.querySelector<HTMLElement>('#lab-form-sample')
 if(!sample)return
 const buttons=host.querySelectorAll<HTMLButtonElement>('[data-lab-form-filter]')
 const count=host.querySelector<HTMLElement>('[data-lab-form-count]')!
 const status=host.querySelector<HTMLElement>('[data-lab-form-status]')!
 const active=()=>sample.isConnected&&current()
 buttons.forEach((button,index)=>{
  button.onclick=()=>{
   if(!active()||button.getAttribute('aria-pressed')==='true')return
   const filter=formats[index],decided=readSample(filter)
   for(const option of buttons)option.setAttribute('aria-pressed',String(option===button))
   count.textContent=decided.length+' decided'
   status.textContent=sampleLabel(decided.length,filter,source)
   sample.innerHTML=formSampleHtml(decided,filter)
  }
 })
 sample.onclick=event=>{
  if(!active())return
  const button=event.target instanceof Element?event.target.closest<HTMLButtonElement>('[data-lab-form-index]'):null
  if(!button||!sample.contains(button))return
  const row=rows[Number(button.dataset.labFormIndex)]
  if(row){button.focus({preventScroll:true});open(row,button)}
 }
}
