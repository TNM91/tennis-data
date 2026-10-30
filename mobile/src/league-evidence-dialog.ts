import type {OfficeDetail} from '../../lib/native-league-office-contract'
import {html} from './match-details'
export function leagueEvidenceNavigationHtml(dates:number,results:number){return '<nav class="league-evidence-jumps" aria-label="Season history"><button type="button" class="secondary" data-league-evidence-jump="schedule">Schedule <span>'+dates+'</span></button><button type="button" class="secondary" data-league-evidence-jump="results">Results <span>'+results+'</span></button></nav>'}
export const leagueEvidenceSummaryHtml='<button type="button" class="secondary league-evidence-summary" data-league-evidence-jump="summary">Back to summary ↑</button>'
export function restoreLeagueEvidenceFocus(host:HTMLElement,target:HTMLElement|null,scroll:number){
 host.scrollTop=scroll;if(!target)return;target.focus({preventScroll:true})
 const frame=host.getBoundingClientRect(),rect=target.getBoundingClientRect(),top=frame.top+host.clientTop,bottom=top+host.clientHeight
 if(rect.top<top||rect.height>bottom-top)host.scrollTop+=rect.top-top-16
 else if(rect.bottom>bottom)host.scrollTop+=rect.bottom-bottom+16
}
type Presentation={label:string;noun:'team'|'player';format:'team'|'individual';content:(detail:OfficeDetail)=>string}
export function openLeagueEvidenceDialog(initial:OfficeDetail,current:()=>boolean,refresh:(valid:()=>boolean)=>Promise<OfficeDetail>,onClose:()=>void,backLabel:string,presentation:Presentation){
 const dialog=document.createElement('dialog');dialog.className='captain-lineup-dialog competitions-dialog league-team-dialog';dialog.setAttribute('aria-label',presentation.label)
 const leagueId=initial.league.id;let detail:OfficeDetail|null=initial,disposed=false,busy=false,version=0,notice=''
 const active=()=>!disposed&&current(),dispose=()=>{if(disposed)return;disposed=true;version++;detail=null;document.removeEventListener('visibilitychange',hidden);dialog.remove();if(current())onClose()},hidden=()=>{if(document.visibilityState==='hidden')dispose()}
 const focus=()=>dialog.querySelector<HTMLElement>('[data-league-evidence-content] h3,[data-league-evidence-notice]')?.focus({preventScroll:true})
 const jump=(section:string)=>{
  if(!active()||busy)return
  if(section==='summary'){dialog.scrollTop=0;focus();return}
  if(section!=='schedule'&&section!=='results')return
  const heading=dialog.querySelector<HTMLElement>('[data-league-evidence-section="'+section+'"] h4');if(!heading)return
  heading.focus({preventScroll:true});dialog.scrollTop+=heading.getBoundingClientRect().top-dialog.getBoundingClientRect().top-dialog.clientTop-16
 }
 const render=()=>{if(!active())return;dialog.innerHTML='<header class="competition-header"><button type="button" class="secondary" data-league-evidence-back>'+html(backLabel)+'</button><button type="button" class="secondary" data-league-evidence-refresh '+(busy?'disabled':'')+'>Refresh '+presentation.noun+'</button></header>'+(detail?'<p class="league-team-context">'+html(detail.league.name)+'</p><div data-league-evidence-content>'+presentation.content(detail)+'</div>':'')+'<p data-league-evidence-notice tabindex="-1" role="'+(notice&&!busy?'alert':'status')+'">'+html(notice)+'</p>';dialog.querySelector('[data-league-evidence-back]')?.addEventListener('click',dispose);dialog.querySelector('[data-league-evidence-refresh]')?.addEventListener('click',()=>{void load()});dialog.querySelectorAll<HTMLButtonElement>('[data-league-evidence-jump]').forEach(button=>{button.onclick=()=>jump(button.dataset.leagueEvidenceJump||'')})}
 const load=async()=>{if(!active()||busy)return;const attempt=++version,valid=()=>active()&&version===attempt;busy=true;detail=null;notice='Checking '+presentation.noun+' records…';render();try{const result=await refresh(valid);if(valid()){if(result.league.id!==leagueId||result.league.format!==presentation.format)throw Error('League changed');detail=result;notice=''}}catch{if(valid())notice='Couldn’t refresh this '+presentation.noun+'. Try again, or return to the league.'}finally{if(valid()){busy=false;render();dialog.scrollTop=0;focus()}}}
 dialog.oncancel=event=>{event.preventDefault();dispose()};document.addEventListener('visibilitychange',hidden);document.body.append(dialog);dialog.showModal();render();focus();return {dispose,isOpen:()=>!disposed,back:()=>{dispose();return true}}
}
