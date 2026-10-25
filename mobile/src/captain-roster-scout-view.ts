import type {SupabaseClient} from '@supabase/supabase-js'
import type {TeamScope} from './team-room-data'
import {loadRosterScout,type RosterPlayer} from './captain-roster-scout-data'
import {comparisonCard,type ComparedPlayer} from './comparison-data'
import {encountersHtml} from './recent-encounters'
import {ratingsHtml} from './player-ratings-view'
import {resultsHtml,type MatchFilter} from './results-view'
import {html} from './match-details'
import type {RatingView} from '../../lib/player-rating-display'
export function rosterDisplayPlayers(data:ComparedPlayer[]){return data.map((p,i)=>({...p,player:{...p.player,name:data.filter(other=>other.player.name===p.player.name).length>1?`${p.player.name} · Record ${i+1}`:p.player.name}}))}
export function rosterScoutHtml(source:ComparedPlayer[],view:RatingView,selected:number){const data=rosterDisplayPlayers(source),p=data[selected],filter:MatchFilter=view==='overall'?'All':view==='singles'?'Singles':'Doubles';return `<div class="match-filters" role="group" aria-label="Roster rating view">${(['overall','singles','doubles'] as const).map(v=>`<button type="button" class="secondary" data-roster-view="${v}" aria-pressed="${view===v}">${v[0].toUpperCase()+v.slice(1)}</button>`).join('')}</div><p class="rating-context">Public player records. TIQ ratings are estimates, not official USTA ratings. This comparison does not predict a winner or recommend a lineup. Results may include other teams and leagues.</p>${data.map((p,i)=>comparisonCard(p,view,i)).join('')}${data.length===2?encountersHtml(data,view):''}<section><h3>${html(p.player.name)} · Recent matches</h3>${ratingsHtml(p.ratings)}${resultsHtml(p.matches,p.player.id,filter,'this player’s')}</section>`}
export function openRosterScout(client:SupabaseClient,owner:string,scope:TeamScope,chosen:RosterPlayer[],current:()=>boolean){
 const previous=document.activeElement instanceof HTMLElement?document.activeElement:null,dialog=document.createElement('dialog');dialog.className='captain-lineup-dialog roster-scout-dialog';dialog.setAttribute('aria-label','Roster scouting')
 let disposed=false,version=0,data:ComparedPlayer[]|null=null,view:RatingView='overall',selected=0,checkedAt=''
 const active=()=>!disposed&&current(),close=()=>{if(disposed)return;disposed=true;version++;data=null;dialog.remove();if(current()&&previous?.isConnected)previous.focus({preventScroll:true})}
 const render=(notice='')=>{if(!active())return;dialog.innerHTML=`<h2 tabindex="-1">Roster scouting</h2><p>${html(scope.teamName)} · ${html(scope.leagueName)} · ${html(scope.flight)}</p>${data?`<p class="rating-context">Checked ${html(checkedAt)}. Refresh to check current roster access and public records.</p><div data-roster-content>${rosterScoutHtml(data,view,selected)}</div>`:''}<p role="status">${html(notice)}</p><button type="button" class="secondary" data-refresh>Refresh player records</button><button type="button" class="secondary" data-close>Back to roster</button>`
 dialog.querySelector<HTMLButtonElement>('[data-close]')!.onclick=close;dialog.querySelector<HTMLButtonElement>('[data-refresh]')!.onclick=()=>{void load()}
 dialog.querySelectorAll<HTMLButtonElement>('[data-roster-view]').forEach(b=>{b.onclick=()=>{view=b.dataset.rosterView as RatingView;render();dialog.querySelector<HTMLElement>(`[data-roster-view="${view}"]`)?.focus({preventScroll:true})}})
 dialog.querySelectorAll<HTMLButtonElement>('[data-comparison-player]').forEach(b=>{b.textContent='View recent matches · '+rosterDisplayPlayers(data!)[Number(b.dataset.comparisonPlayer)].player.name;b.onclick=()=>{selected=Number(b.dataset.comparisonPlayer);render();dialog.querySelector('section:last-of-type')?.scrollIntoView({block:'start'})}})
 dialog.querySelectorAll<HTMLButtonElement>('[data-match-filter]').forEach(b=>{b.onclick=()=>{view=b.dataset.matchFilter==='All'?'overall':b.dataset.matchFilter==='Singles'?'singles':'doubles';render()}})
 // Results remain a bounded inline score review; no nested history or external handoff.
 dialog.querySelectorAll<HTMLButtonElement>('.match-open,[data-encounter]').forEach(b=>b.remove())
 }
 const load=async()=>{if(!active())return;const attempt=++version;data=null;render('Checking Captain access, connected player records, ratings and recent matches…');dialog.querySelector<HTMLButtonElement>('[data-refresh]')!.disabled=true;try{const result=await loadRosterScout(client,owner,()=>active()&&attempt===version,scope,chosen);if(active()&&attempt===version){data=result;checkedAt=new Date().toLocaleString();render()}}catch{if(active()&&attempt===version){data=null;render('Roster scouting unavailable. Your roster, connected record or access may have changed. Refresh Captain tools if this continues.')}}finally{if(active()&&attempt===version)dialog.querySelector<HTMLElement>('h2')?.focus()}}
 dialog.oncancel=e=>{e.preventDefault();close()};document.body.append(dialog);render();dialog.showModal();void load();return {dispose:close}
}
