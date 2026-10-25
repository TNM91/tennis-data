import type {SupabaseClient} from '@supabase/supabase-js'
import type {TeamScope} from './team-room-data'
import type {CaptainData,CaptainMatch} from './captain-data'
import {loadMatchCenter,type MatchCenter} from './captain-match-center-data'
import {captainHomeMatch,captainHomeFocus,captainHomeFocusHtml} from './captain-home-data'
import {matchDate} from './recent-results'
import {html} from './match-details'
export function openCaptainHome(host:HTMLElement,client:SupabaseClient,owner:string,scope:TeamScope,snapshot:CaptainData,current:()=>boolean,onOpen:(match:CaptainMatch,next:boolean)=>void){
 let disposed=false,revision=0,busy=false,id=snapshot.matches[0]?.id||'',data:MatchCenter|null=null,notice='Readiness has not been checked for this visit.'
 const active=()=>!disposed&&current()&&host.isConnected
 const render=()=>{
  if(!active())return
  const match=captainHomeMatch(snapshot,id),focus=data&&match?captainHomeFocus(scope,match,data):null,restore=host.contains(document.activeElement)
  host.innerHTML=`<h2>Your next match decision</h2><p><strong>${html(scope.teamName)}</strong><br>${html(scope.leagueName)} · ${html(scope.flight)}</p>${snapshot.matches.length?`<label for="captain-home-fixture">Choose fixture</label><select id="captain-home-fixture">${snapshot.matches.map(m=>`<option value="${html(m.id)}" ${id===m.id?'selected':''}>${html(matchDate(m.date))} · ${html(m.opponent)}</option>`).join('')}</select>`:'<p>No upcoming fixture is in this loaded schedule.</p>'}${match?`<p>${html(match.time||'Time not set')} · ${html(match.facility||'Facility not set')}</p>`:''}${captainHomeFocusHtml(focus)}<p role="status" tabindex="-1">${html(notice)}</p>${data?`<p class="rating-context">Checked ${html(new Date(data.checkedAt).toLocaleString())}. Counts follow your private plan. Available answers may include player, season, saved or captain-confirmed replies.${data.replies.dayScopedAnswersOmitted?' Day-only answers are excluded for multiple fixtures on this date.':''} Recheck after changes.</p><button type="button" class="secondary" data-home-recheck>Recheck match readiness</button>`:''}`
  host.querySelector<HTMLSelectElement>('select')?.addEventListener('change',event=>{revision++;busy=false;data=null;id=(event.currentTarget as HTMLSelectElement).value;notice='Readiness has not been checked for this fixture.';render();host.querySelector<HTMLSelectElement>('select')?.focus({preventScroll:true})})
  host.querySelectorAll<HTMLButtonElement>('[data-focus-primary],[data-focus-issue],[data-home-recheck]').forEach(b=>{b.disabled=busy||!match})
  const check=async()=>{
   if(!active()||busy||!match)return;const request=++revision;busy=true;data=null;notice='Checking this fixture’s plan, replies and publishing…';render()
   try{const result=await loadMatchCenter(client,owner,()=>active()&&request===revision,{...scope},match);if(!active()||request!==revision)return;captainHomeFocus(scope,match,result);data=result;notice='Readiness checked. Open a task to recheck current details before making changes.'}
   catch{if(active()&&request===revision)notice='Readiness unavailable or this fixture changed. Refresh Captain tools or check again.'}
   finally{if(active()&&request===revision){busy=false;render()}}
  }
  const open=(next:boolean)=>{if(!active()||busy||!match||!data)return;revision++;data=null;notice='Recheck readiness after returning from the match task.';render();onOpen(match,next)}
  host.querySelector<HTMLButtonElement>('[data-focus-primary]')!.onclick=()=>{if(data)open(true);else void check()}
  host.querySelectorAll<HTMLButtonElement>('[data-focus-issue]').forEach(b=>{b.onclick=()=>open(false)})
  host.querySelector<HTMLButtonElement>('[data-home-recheck]')?.addEventListener('click',()=>{void check()})
  if(restore)host.querySelector<HTMLElement>(busy?'[role="status"]':'[data-focus-primary]')?.focus({preventScroll:true})
 }
 render();return {dispose:()=>{disposed=true;revision++;data=null}}
}
