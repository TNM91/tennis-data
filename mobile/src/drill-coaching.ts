import type {LevelUpCard} from '../../lib/level-up/level-up-types'
import {selectedDrillVersion,type DrillPractice} from './drill-playbook'
import {html} from './match-details'

export function drillCoachingHtml(card:LevelUpCard,practice:DrillPractice|null,session=false,open=false){
 const mode=selectedDrillVersion(card,practice),book=card.playbook
 if(!book||!mode||!practice||practice.results.length!==mode.rounds||!card.qualityChecks?.length||!card.commonMiss)return ''
 return `<details class="training-inbox-fold training-coaching" ${session?'data-session-coaching':'data-drill-fold="coaching"'} ${open?'open':''}>
  <summary ${session?'data-session-control="coaching"':''}>Quick coaching</summary>
  <p class="training-coaching-focus"><strong>${html(mode.label)}</strong> ${html(mode.focus)}</p>
  <h3>Check your next rep</h3>
  <ul>${card.qualityChecks.map(check=>`<li>${html(check)}</li>`).join('')}</ul>
  <div class="training-coaching-correction"><p><strong>Watch for</strong> ${html(card.commonMiss.miss)}</p><p><strong>Try next</strong> ${html(card.commonMiss.fix)}</p></div>
  <p><strong>Make it easier</strong> ${html(book.easier)}</p>
 </details>`
}
