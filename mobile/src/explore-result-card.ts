import {html} from './match-details'

export function exploreResultCard(kind:'player'|'team'|'league'|'ranking',index:number,{
 title,context,actionName=title,rating,note,
}:{title:string;context:string;actionName?:string;rating?:string;note?:string}){
 const descriptionId=`explore-${kind}-context-${index}`
 const destination=kind==='ranking'?'player':kind
 return `<li><button type="button" class="secondary explore-result-card" data-explore-result="${index}"
  aria-label="${html(`View ${destination} ${actionName}`)}" aria-describedby="${descriptionId}">
   <span class="explore-result-main">
    <strong>${html(title)}</strong>
    ${rating?`<span class="explore-result-rating" aria-hidden="true">${html(rating)}</span>`:''}
    <span class="explore-result-context" id="${descriptionId}">
     ${html(context)}${rating?`<span class="sr-only"> · Rank ${index+1} · TiQ rating ${html(rating)}.</span>`:''}
     ${note?`<span class="explore-result-note">${html(note)}</span>`:''}
    </span>
   </span>
   <span class="app-tool-arrow" aria-hidden="true">›</span>
 </button></li>`
}
