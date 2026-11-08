import {html} from './match-details'

type Standing = {
 kind:'league'|'tournament'
 position:number
 name:string
 group?:string
 record:string
 stats:string
 actionAttributes?:string
}

export function competitionStandingHtml({kind,position,name,group,record,stats,actionAttributes}:Standing) {
 const id=`${kind}-standing-${position}`
 const content=`<span class="standing-position" id="${id}-position"><span class="sr-only">List position </span>${position}</span>
  <span class="standing-copy">
   <span class="standing-name"><strong>${html(name)}</strong>${group?`<span class="standing-group">${html(group)}</span>`:''}</span>
   <span class="standing-record" id="${id}-record">${html(record)}</span>
   <span class="standing-stats" id="${id}-stats">${html(stats)}</span>
  </span>`
 if(!actionAttributes)return `<li value="${position}"><div class="standing-row">${content}</div></li>`
 const label=html('View matches for '+name+(group?' · '+group:''))
 return `<li value="${position}"><button type="button" class="standing-row secondary" ${actionAttributes} aria-label="${label}" aria-describedby="${id}-position ${id}-record ${id}-stats">
  ${content}<span class="standing-arrow" aria-hidden="true"></span>
 </button></li>`
}
