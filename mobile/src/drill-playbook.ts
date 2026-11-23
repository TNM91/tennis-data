import type {LevelUpCard} from '../../lib/level-up/level-up-types'
import type {DrillVersionId} from '../../lib/level-up/drill-playbooks'
import {html} from './match-details'

export type DrillPractice={cardId:string;version:DrillVersionId;results:string[]}
export class DrillResultError extends Error{constructor(message:string,readonly field:string){super(message)}}
export function newDrillPractice(card:LevelUpCard,version:DrillVersionId='control'):DrillPractice|null{
 const mode=card.playbook?.versions.find(mode=>mode.id===version)
 return mode?{cardId:card.id,version:mode.id,results:Array<string>(mode.rounds).fill('')}:null
}
export function selectedDrillVersion(card:LevelUpCard,practice:DrillPractice|null){
 return practice?.cardId===card.id?card.playbook?.versions.find(mode=>mode.id===practice.version):undefined
}
export function drillRestGuidance(card:LevelUpCard,practice:DrillPractice|null){
 return selectedDrillVersion(card,practice)?card.playbook?.rest??null:null
}
export function drillRestSummaryHtml(card:LevelUpCard,practice:DrillPractice|null){
 const plan=drillRestGuidance(card,practice)
 return plan?`<span class="training-rest-summary">Drill rest: ${html(plan.guidance)}</span>`:''
}
export function drillDoseSummaryHtml(card:LevelUpCard,practice:DrillPractice|null,view:'setup'|'session'='setup'){
 const mode=selectedDrillVersion(card,practice)
 return mode?`<p class="${view==='session'?'training-session-track training-session-dose':'training-playbook-dose'}">${mode.rounds} rounds · ${mode.reps} reps per round${drillRestSummaryHtml(card,practice)}</p>`:''
}
export function drillRoundTotals(card:LevelUpCard,practice:DrillPractice){
 const mode=selectedDrillVersion(card,practice)
 if(!mode||practice.results.length!==mode.rounds)throw new DrillResultError('Review the current drill before saving.','note')
 let clean=0,recorded=0
 const rounds=practice.results.map((raw,index)=>{
  if(raw==='')return null
  if(!/^(?:0|[1-9]\d*)$/.test(raw)||Number(raw)>mode.reps)throw new DrillResultError(`Use a whole number from 0 to ${mode.reps} for round ${index+1}.`,'drill-round-'+index)
  recorded++;clean+=Number(raw);return {round:index+1,count:Number(raw)}
 })
 return {mode,clean,recorded,attempts:recorded*mode.reps,rounds}
}
export type DrillRoundShortcut={index:number;label:string}
export function drillRoundShortcut(card:LevelUpCard,practice:DrillPractice|null):DrillRoundShortcut|null{
 const mode=selectedDrillVersion(card,practice)
 if(!mode||!practice||mode.rounds<1||practice.results.length!==mode.rounds)return null
 try{drillRoundTotals(card,practice)}catch(error){
  const match=error instanceof DrillResultError?error.field.match(/^drill-round-(\d+)$/):null
  const index=match?Number(match[1]):-1
  return index>=0&&index<mode.rounds?{index,label:`Review round ${index+1}`}:null
 }
 const index=practice.results.indexOf('')
 return index>=0?{index,label:`Open round ${index+1}`}:{index:0,label:'Review rounds'}
}
export function drillTally(card:LevelUpCard,practice:DrillPractice){
 const total=drillRoundTotals(card,practice)
 return total.recorded?`${total.recorded} of ${total.mode.rounds} rounds recorded · ${total.clean}/${total.attempts} ${card.playbook!.countLabel.toLowerCase()}`:'No round results entered.'
}
export function drillEvidence(card:LevelUpCard,practice:DrillPractice|null){
 if(!practice)return ''
 const total=drillRoundTotals(card,practice)
 if(!total.recorded)return ''
 return `${total.mode.label} · ${card.playbook!.countLabel}: ${total.rounds.flatMap(round=>round?[`R${round.round} ${round.count}/${total.mode.reps}`]:[]).join('; ')}. Total ${total.clean}/${total.attempts}.`
}
export function drillSessionNote(card:LevelUpCard,practice:DrillPractice|null,note:string,target='',context=''){
 if(practice&&context==='alone'){
  const total=drillRoundTotals(card,practice)
  if(total.mode.requiresPartner&&total.recorded)throw new DrillResultError('These round results need a partner. Choose With a partner, or clear the rounds to save a solo note.','context')
 }
 const evidence=drillEvidence(card,practice)
 const result=[target,evidence,note.trim()].filter(Boolean).join('\n\n')
 if(result.length>700)throw new DrillResultError('Your results and note exceed 700 characters. Shorten your note; your round counts will stay.','note')
 return result
}
export function drillSetupHtml(card:LevelUpCard,practice:DrillPractice|null,choose=false){
 const book=card.playbook,mode=selectedDrillVersion(card,practice)
 if(!book||!mode)return ''
 return `<section class="training-playbook" aria-label="Drill setup">
  ${choose?`<label for="training-drill-version">Practice version</label><select id="training-drill-version" data-drill-version aria-describedby="training-version-help">${book.versions.map(version=>`<option value="${html(version.id)}" ${mode.id===version.id?'selected':''}>${html(version.label)}</option>`).join('')}</select>`:`<strong>${html(mode.label)}</strong>`}
  ${drillDoseSummaryHtml(card,practice)}
  <p id="training-version-help">${html(mode.focus)}${mode.requiresPartner?' A partner is needed for this version.':''}</p>
  <h3>Set up</h3><ul>${book.setup.map(step=>`<li>${html(step)}</li>`).join('')}</ul>
  <details class="training-inbox-fold" data-drill-fold="adapt"><summary>Adjust the challenge</summary><p><strong>Make it easier</strong> ${html(book.easier)}</p><p><strong>When to progress</strong> ${html(book.advance)}</p></details>
 </section>`
}
export function drillResultsHtml(card:LevelUpCard,practice:DrillPractice|null,locked:boolean){
 const book=card.playbook,mode=selectedDrillVersion(card,practice)
 if(!book||!mode||!practice)return ''
 let tally='Check the round counts below.';try{tally=drillTally(card,practice)}catch{/* Preserve invalid raw input for correction. */}
 return `<fieldset class="training-rounds" ${locked?'disabled':''} aria-describedby="training-round-help">
  <legend>Round results <span>(optional)</span></legend>
  <p><strong>${html(mode.label)} · ${html(book.countLabel)}</strong></p><p id="training-round-help">Finish all ${mode.reps} attempts before logging a round. Leave unfinished rounds blank.</p>
  <details class="training-inbox-fold" data-inbox-fold="drill-count-rule-${html(card.id)}"><summary>What counts?</summary><p>${html(book.countRule)}</p></details>
  <div class="training-round-grid">${practice.results.map((value,index)=>`<label for="training-drill-round-${index}">Round ${index+1}<span><input id="training-drill-round-${index}" name="drill-round-${index}" data-drill-result="${index}" type="number" inputmode="numeric" min="0" max="${mode.reps}" step="1" value="${html(value)}" aria-describedby="training-round-help"/><span aria-hidden="true">/ ${mode.reps}</span></span></label>`).join('')}</div>
  <output data-drill-tally aria-label="Drill round totals" aria-live="polite" aria-atomic="true">${html(tally)}</output>
  <p class="training-rounds-help">Entered counts and the practice version save with your private note. Blank rounds stay unrecorded. These counts do not change your TiQ rating.</p>
 </fieldset>`
}
