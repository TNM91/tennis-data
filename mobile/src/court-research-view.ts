import type {SupabaseClient} from '@supabase/supabase-js'
import type {TeamScope} from './team-room-data'
import {fixtureOpponent,type TeamFixture} from '../../lib/team-fixtures-contract'
import type {ReviewedCourt} from './post-match-data'
import {loadCourtResearch,type CourtResearch} from './court-research-data'
import {rosterScoutHtml,rosterDisplayPlayers} from './captain-roster-scout-view'
import {partnershipHtml,type PartnershipFilter} from './doubles-partnership-view'
import {html} from './match-details'
import {matchDate} from './recent-results'
import type {RatingView} from '../../lib/player-rating-display'
export function openCourtResearch(client:SupabaseClient,owner:string,scope:TeamScope,fixture:TeamFixture,court:ReviewedCourt,ids:string[],pair:boolean,readContext:(current:()=>boolean)=>Promise<{fixture:TeamFixture;today:string}>,current:()=>boolean){
 const previous=document.activeElement instanceof HTMLElement?document.activeElement:null,dialog=document.createElement('dialog');dialog.className='captain-lineup-dialog roster-scout-dialog';dialog.setAttribute('aria-label','Court research');let disposed=false,version=0,busy=false,data:CourtResearch|null=null,view:RatingView=pair?'doubles':'overall',selected=0,filter:PartnershipFilter='all',notice=''
 const active=()=>!disposed&&current(),close=()=>{if(disposed)return;disposed=true;version++;data=null;dialog.remove();if(current()&&previous?.isConnected)previous.focus({preventScroll:true})}
 const render=()=>{if(!active())return;dialog.innerHTML=`<h2 tabindex="-1">Court research</h2><p>${html(scope.teamName)} · ${html(scope.leagueName)} · ${html(scope.flight)}</p><p>Court ${html(court.court.line)} · ${html(matchDate(fixture.date))} · vs ${html(fixtureOpponent(fixture,scope))}</p>${data?`<p class="rating-context">Current roster records and latest connected results. This recorded court may fall outside the latest-ten sample. Checked ${html(new Date(data.checkedAt).toLocaleString())}.</p>${data.partnership?partnershipHtml(data.partnership,filter):''}${rosterScoutHtml(data.players,view,selected)}`:''}<p role="status">${html(notice)}</p><button type="button" class="secondary" data-refresh ${busy?'disabled':''}>Refresh court research</button><button type="button" class="secondary" data-close>Back to court results</button>`
 dialog.querySelector<HTMLButtonElement>('[data-close]')!.onclick=close;dialog.querySelector<HTMLButtonElement>('[data-refresh]')!.onclick=()=>{void load()}
 dialog.querySelectorAll<HTMLButtonElement>('[data-roster-view]').forEach(b=>{b.onclick=()=>{view=b.dataset.rosterView as RatingView;render();dialog.querySelector<HTMLElement>(`[data-roster-view="${view}"]`)?.focus({preventScroll:true})}})
 dialog.querySelectorAll<HTMLButtonElement>('[data-match-filter]').forEach(b=>{b.onclick=()=>{view=b.dataset.matchFilter==='All'?'overall':b.dataset.matchFilter==='Singles'?'singles':'doubles';render();dialog.querySelector<HTMLElement>(`[data-roster-view="${view}"]`)?.focus({preventScroll:true})}})
 dialog.querySelectorAll<HTMLButtonElement>('[data-comparison-player]').forEach(b=>{b.textContent='View recent matches · '+rosterDisplayPlayers(data!.players)[Number(b.dataset.comparisonPlayer)].player.name;b.onclick=()=>{selected=Number(b.dataset.comparisonPlayer);render();dialog.querySelector('section:last-of-type')?.scrollIntoView({block:'start'})}})
 dialog.querySelectorAll<HTMLButtonElement>('[data-partnership-filter]').forEach(b=>{b.onclick=()=>{filter=b.dataset.partnershipFilter as PartnershipFilter;render();dialog.querySelector<HTMLElement>(`[data-partnership-filter="${filter}"]`)?.focus({preventScroll:true})}});dialog.querySelectorAll<HTMLButtonElement>('.match-open,[data-encounter]').forEach(b=>b.remove())
 }
 const load=async()=>{if(!active()||busy)return;const attempt=++version;busy=true;data=null;notice='Checking Captain access, the recorded court and current roster links…';render();try{const result=await loadCourtResearch(client,owner,scope,fixture,court,ids,pair,()=>active()&&attempt===version,readContext);if(active()&&attempt===version){data=result;notice=''}}catch{if(active()&&attempt===version){data=null;notice='Court research unavailable. Captain access, this recorded court or a current roster link could not be confirmed. Go back and refresh court results before trying again.'}}finally{if(active()&&attempt===version){busy=false;render();dialog.querySelector<HTMLElement>('h2')?.focus()}}}
 dialog.oncancel=e=>{e.preventDefault();close()};document.body.append(dialog);render();dialog.showModal();void load();return {dispose:close}
}
