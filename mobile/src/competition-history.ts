import {html} from './match-details'

export function competitionHistoryNavigationHtml(kind:'league'|'tournament',pending:number,results:number){
 const tournament=kind==='tournament'
 return `<nav class="competition-history-jumps" aria-label="${tournament?'Tournament match history':'Season history'}">
  <button type="button" class="secondary" data-competition-history-jump="schedule">${tournament?'Awaiting results':'Schedule'} <span>${pending}</span></button>
  <button type="button" class="secondary" data-competition-history-jump="results">Results <span>${results}</span></button>
 </nav>`
}

export function competitionHistorySectionHtml(section:'schedule'|'results',title:string,count:number,cards:string,empty:string){
 return `<section class="competition-history-section" data-competition-history-section="${section}">
  <h4 tabindex="-1">${html(title)} · ${count}</h4>
  ${cards||`<p>${html(empty)}</p>`}
  <button type="button" class="secondary competition-history-summary" data-competition-history-jump="summary">Back to summary ↑</button>
 </section>`
}

export function bindCompetitionHistory(dialog:HTMLDialogElement,active:()=>boolean,focusSummary:()=>void){
 dialog.querySelectorAll<HTMLButtonElement>('[data-competition-history-jump]').forEach(button=>{
  button.onclick=()=>{
   if(!active())return
   const section=button.dataset.competitionHistoryJump
   if(section==='summary'){
    dialog.scrollTop=0
    focusSummary()
    return
   }
   if(section!=='schedule'&&section!=='results')return
   const heading=dialog.querySelector<HTMLElement>(`[data-competition-history-section="${section}"] > h4`)
   if(!heading)return
   heading.focus({preventScroll:true})
   dialog.scrollTop+=heading.getBoundingClientRect().top-dialog.getBoundingClientRect().top-dialog.clientTop-16
  }
 })
}
