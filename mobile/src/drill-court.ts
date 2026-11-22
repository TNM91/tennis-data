import type {LevelUpCard} from '../../lib/level-up/level-up-types'
import {selectedDrillVersion,type DrillPractice} from './drill-playbook'
import {html} from './match-details'

export function drillGuidePage(card:LevelUpCard,practice:DrillPractice|null,position:number){
 const mode=selectedDrillVersion(card,practice)
 if(!mode||!practice||practice.results.length!==mode.rounds||!mode.steps.length)return null
 const index=Number.isInteger(position)&&position>=0&&position<mode.steps.length?position:0
 return {index,total:mode.steps.length,instruction:mode.steps[index],mode,previous:index>0,next:index<mode.steps.length-1}
}
export function moveDrillGuide(card:LevelUpCard,practice:DrillPractice|null,position:number,direction:-1|1){
 const page=drillGuidePage(card,practice,position)
 return page&&[-1,1].includes(direction)?Math.max(0,Math.min(page.total-1,page.index+direction)):page?.index??0
}
export function drillCourtGuideHtml(card:LevelUpCard,practice:DrillPractice|null,position:number){
 const page=drillGuidePage(card,practice,position)
 if(!page)return ''
 return `<section class="training-court-guide" aria-label="On-court instructions">
  <p class="training-court-dose">${html(page.mode.label)} · ${page.mode.rounds} rounds · ${page.mode.reps} reps</p>
  <div id="training-court-page" role="status" aria-live="polite" aria-atomic="true">
   <strong data-court-position>Instruction ${page.index+1} of ${page.total}</strong>
   <p data-court-instruction>${html(page.instruction)}</p>
  </div>
  <div class="training-court-step-controls">
   <button type="button" class="secondary" data-court-step="-1" data-session-control="court-previous" aria-label="Previous instruction" aria-controls="training-court-page" aria-disabled="${!page.previous}">Previous</button>
   <button type="button" class="secondary" data-court-step="1" data-session-control="court-next" aria-label="Next instruction" aria-controls="training-court-page" aria-disabled="${!page.next}">Next</button>
  </div>
  <p class="training-court-cue"><strong>On-court cue</strong> ${html(card.cue)}</p>
 </section>`
}
