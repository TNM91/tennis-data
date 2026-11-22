import {LEVEL_UP_CARDS} from '../../lib/level-up/level-up-cards'
import type {LevelUpCard} from '../../lib/level-up/level-up-types'
import type {TrainingSession} from './level-up-data'
import {drillEvidence,newDrillPractice} from './drill-playbook'
import {html} from './match-details'

export const drillHistoryKey=(row:TrainingSession)=>row.cardId||row.focusId
export function drillHistoryChoices(rows:TrainingSession[],selected=''){
 return LEVEL_UP_CARDS.filter(card=>card.id===selected||rows.some(row=>drillHistoryKey(row)===card.id))
  .map(card=>({card,count:rows.filter(row=>drillHistoryKey(row)===card.id).length}))
  .sort((a,b)=>a.card.title.localeCompare(b.card.title))
}
export function selectDrillHistory(rows:TrainingSession[],id:string){return id?rows.filter(row=>drillHistoryKey(row)===id):rows}

// Decode only the exact count block written by drillSessionNote. Keep unknown
// or inconsistent text in the original note rather than guessing its meaning.
export function readDrillEvidence(card:LevelUpCard,row:TrainingSession){
 if(drillHistoryKey(row)!==card.id||!card.playbook)return null
 const paragraphs=row.note.split('\n\n')
 const line=paragraphs[0].startsWith('Practice target: ')?paragraphs[1]:paragraphs[0]
 if(!line)return null
 const mode=card.playbook.versions.find(mode=>line.startsWith(`${mode.label} · ${card.playbook!.countLabel}: `))
 if(!mode)return null
 const practice=newDrillPractice(card,mode.id)!,prefix=`${mode.label} · ${card.playbook.countLabel}: `
 const counts=line.slice(prefix.length).split('. Total ')[0].split('; ')
 let clean=0,previous=0
 for(const token of counts){
  const match=/^R([1-9]\d*) (0|[1-9]\d*)\/([1-9]\d*)$/.exec(token)
  if(!match)return null
  const round=Number(match[1]),count=Number(match[2]),reps=Number(match[3])
  if(!Number.isSafeInteger(round)||!Number.isSafeInteger(count)||round<=previous||round>mode.rounds||count>mode.reps||reps!==mode.reps)return null
  practice.results[round-1]=String(count);clean+=count;previous=round
 }
 if(drillEvidence(card,practice)!==line)return null
 const attempts=counts.length*mode.reps
 return {version:mode.id,label:mode.label,clean,attempts,recorded:counts.length,rounds:mode.rounds,percent:Math.round(clean/attempts*100)}
}
export function recentDrillResults(rows:TrainingSession[],card:LevelUpCard){
 const sessions=selectDrillHistory(rows,card.id).slice().sort((a,b)=>Date.parse(b.completedAt)-Date.parse(a.completedAt))
 const latest=sessions[0],reference=latest&&readDrillEvidence(card,latest)
 if(!reference)return []
 return sessions.flatMap(row=>{const result=readDrillEvidence(card,row);return result&&result.version===reference.version&&row.context===latest.context?[{row,result}]:[]}).slice(0,3)
}
const contexts:Record<string,string>={alone:'Solo',partner:'With a partner',singles:'Singles',doubles:'Doubles',coach:'With a coach'}
export function drillHistoryControlsHtml(rows:TrainingSession[],selected:string){
 const choices=drillHistoryChoices(rows,selected)
 if(!choices.length)return ''
 return `<div class="training-history-filter"><label for="training-history-drill">Drill</label>
  <select id="training-history-drill" data-history-drill data-progress-control="history-drill" aria-describedby="training-history-filter-help">
   <option value="" ${selected?'':'selected'}>All drills</option>
   ${choices.map(({card,count})=>`<option value="${html(card.id)}" ${selected===card.id?'selected':''}>${html(card.title)} (${count})</option>`).join('')}
  </select><p id="training-history-filter-help">Choose a drill to compare your logged round results.</p>${selected&&rows.length===80?'<p>Filtered from your latest 80 saved sessions across all drills.</p>':''}</div>`
}
export function drillComparisonHtml(rows:TrainingSession[],selected:string){
 const card=LEVEL_UP_CARDS.find(card=>card.id===selected)
 if(!card||!selectDrillHistory(rows,selected).length)return ''
 const results=recentDrillResults(rows,card)
 return `<section class="training-drill-comparison" aria-label="Recent round results">
  <h2>Recent round results</h2>
  ${results.length?`<p>${html(results[0].result.label)} · ${html(contexts[results[0].row.context]??results[0].row.context)}</p>
   <ol role="list">${results.map(({row,result},index)=>`<li>
    <div class="training-round-result-head"><strong>${result.clean} / ${result.attempts} ${html(card.playbook!.countLabel.toLowerCase())}</strong><span>${result.percent}%</span></div>
    <svg class="training-round-result-track" viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true" focusable="false"><rect width="100" height="6" rx="3"/><rect class="training-round-result-fill" width="${result.percent}" height="6" rx="3"/></svg>
    <p>${index===0?'Latest · ':''}<time datetime="${html(row.completedAt)}">${html(new Date(row.completedAt).toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}))}</time> · ${result.recorded} of ${result.rounds} rounds logged</p>
   </li>`).join('')}</ol>
   <p>Up to three loaded sessions with the same version and training context. Conditions may differ; these counts do not change your TiQ rating.</p>`
  :`<p>${card.playbook?'Round results are not available for the latest session.':'This drill uses notes and self-rated proof.'} Your saved notes are below.</p>`}
 </section>`
}
