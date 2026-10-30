import type {SupabaseClient} from '@supabase/supabase-js'
import type {ScenarioSend} from './captain-scenarios-data'
import type {TournamentSnapshot,TournamentSummary,TournamentDetail,TournamentMatch} from '../../lib/native-tournaments-contract'
import {formatTournamentEventDate,formatTournamentEventTime} from '../../lib/tournament-event-presentation'
import {loadTournaments} from './tournaments-data'
import {html} from './match-details'
import {emptyTournamentMatchFilters,filterTournamentMatches,tournamentMatchFiltersHtml,tournamentViewMatches,type TournamentMatchFilters} from './tournament-match-filters'
type View='home'|'draw'|'schedule'|'results'|'standings'
const status=(t:TournamentSummary)=>t.status==='open'&&t.registrationClosed?'Registration closed':({open:'Registration open',scheduled:'Scheduled',completed:'Completed'})[t.status]
export function tournamentCardsHtml(tournaments:TournamentSummary[],division=false){
 return tournaments.length?'<div class="competition-cards">'+tournaments.map((t,i)=>'<article class="competition-card"><div class="competition-card-meta"><span>'+html(t.isEvent?'Tournament event':t.formatLabel)+'</span><span>'+html(status(t))+'</span></div><h3>'+html(t.name)+'</h3><p>'+html(formatTournamentEventDate(t.date,true))+'</p><p>'+html(t.location||'Venue to be confirmed')+'</p><button type="button" class="secondary" data-tournament-'+(division?'division':'open')+'="'+i+'">'+(division?'Open division':'Open tournament')+'<span class="sr-only"> '+html(t.name)+'</span><span aria-hidden="true">↗</span></button></article>').join('')+'</div>':'<div class="competition-empty"><h3>No public '+(division?'divisions':'tournaments')+' found</h3><p>'+(division?'The organizer has not published a division yet.':'Try another tournament name or clear your search.')+'</p></div>'
}
function matchHtml(m:TournamentMatch){return '<article class="competition-fixture"><p class="competition-date">'+html(m.label)+'</p><h4>'+html(m.a)+' <span>vs</span> '+html(m.b)+'</h4>'+(m.winner?'<p><strong>'+html(m.winner)+' won</strong>'+ (m.score?' · '+html(m.score):'')+'</p>':'<span class="competition-status">Awaiting result</span>')+((m.date||m.time||m.court)?'<p>'+html([m.date?formatTournamentEventDate(m.date,true):'',m.time?formatTournamentEventTime(m.time):'',m.court?'Court '+m.court:''].filter(Boolean).join(' · '))+'</p>':'')+'</article>'}
export function tournamentDetailHtml(d:TournamentDetail,view:View,filters:TournamentMatchFilters=emptyTournamentMatchFilters()){
 const t=d.active||d.root,e=t.details
 if(!d.active)return '<h3 tabindex="-1">Divisions</h3>'+tournamentCardsHtml(d.divisions,true)+(d.moreDivisions?'<p class="rating-context">Showing the first 20 public divisions.</p>':'')
 if(view==='home'&&d.drawNotice)return '<h3 tabindex="-1">'+html(t.formatLabel)+'</h3><p>'+html(d.drawNotice)+'</p>'
 if(view==='home')return '<h3 tabindex="-1">'+html(t.formatLabel)+'</h3><div class="competition-metrics">'+[[d.entrants,'Entrants'],[d.matches.length,'Matches'],[d.matches.filter(m=>m.winner).length,'Results']].map(([n,label])=>'<div><strong>'+n+'</strong><span>'+label+'</span></div>').join('')+'</div><p>'+html(e.formatSummary||'Follow the published draw, scheduled courts and recorded results.')+'</p><p>'+html(t.registrationClosed?'Registration has closed.':'Contact the organizer for registration.')+'</p>'+(e.registrationClosesOn?'<p>Registration deadline: '+html(formatTournamentEventDate(e.registrationClosesOn,true))+'</p>':'')+(e.venueName?'<p>'+html(e.venueName)+'</p>':'')+(e.venueAddress?'<p>'+html(e.venueAddress)+'</p>':'')+(e.directorName?'<p>Tournament director: '+html(e.directorName)+'</p>':'')
 if(d.drawNotice)return '<h3 tabindex="-1">Draw details</h3><p>'+html(d.drawNotice)+'</p>'
 if(view==='standings')return '<h3 tabindex="-1">Standings</h3><p>Recorded match wins and ordinary set games. Match-tiebreak points are excluded.</p>'+(d.standings.length?'<ol class="tournament-standings">'+d.standings.map(s=>'<li><div><strong>'+html(s.name)+'</strong>'+(s.group?'<span>'+html(s.group)+'</span>':'')+'</div><p>'+s.wins+' W · '+s.losses+' L · '+s.winPct+'%<br>'+s.gamesWon+'–'+s.gamesLost+' games · '+(s.gameDiff>0?'+':'')+s.gameDiff+' differential</p></li>').join('')+'</ol>':'<p>No standings are available for this draw format.</p>')
 const matches=filterTournamentMatches(d.matches,view,filters),total=tournamentViewMatches(d.matches,view).length
 return '<h3 tabindex="-1">'+({draw:'Draw',schedule:'Schedule',results:'Results'})[view]+'</h3>'+(view==='schedule'?'<p>Published court assignments · '+html(e.timeZone||'Time zone not published')+'. Live court calls are available at the tournament desk.</p>':'')+(total?tournamentMatchFiltersHtml(d.matches,view,filters)+'<p class="tournament-filter-status" tabindex="-1" role="status" data-tournament-filter-status>'+matches.length+' of '+total+' '+(total===1?'match':'matches')+' · selected division</p>':'')+(matches.length?matches.map(matchHtml).join(''):'<p>'+(total?'No matches fit these filters. Clear filters to see this division.':view==='results'?'No results have been recorded.':view==='schedule'?'Court assignments have not been published.':'The draw has not been published.')+'</p>')

}
export function openTournaments(client:SupabaseClient,owner:string,current:()=>boolean,onClose:()=>void,send?:ScenarioSend,trigger?:HTMLElement){
 const previous=trigger||(document.activeElement instanceof HTMLElement?document.activeElement:null),dialog=document.createElement('dialog')
 dialog.className='captain-lineup-dialog competitions-dialog tournaments-dialog';dialog.setAttribute('aria-label','Tournaments')
 let disposed=false,version=0,busy=false,query='',selected='',division='',view:View='home',snapshot:TournamentSnapshot|null=null,notice='',filters=emptyTournamentMatchFilters()
 const active=()=>!disposed&&current()
 const dispose=()=>{if(disposed)return;disposed=true;version++;snapshot=null;document.removeEventListener('visibilitychange',hidden);dialog.remove();onClose();if(current()&&previous?.isConnected)previous.focus({preventScroll:true})}
 const hidden=()=>{if(document.visibilityState==='hidden')dispose()}
 const focus=()=>dialog.querySelector<HTMLElement>('[data-tournament-content] h3,h2')?.focus({preventScroll:true})
 const back=()=>{if(division){division='';view='home';filters=emptyTournamentMatchFilters();void load()}else if(selected){selected='';view='home';filters=emptyTournamentMatchFilters();void load()}else dispose();return true}
 const render=()=>{
  if(!active())return
  const d=snapshot?.detail,t=d?.active||d?.root
  dialog.innerHTML='<header class="competition-header"><button type="button" class="secondary" data-tournament-back>'+html(division?'← Event':selected?'← Tournaments':'← Competitions')+'</button><button type="button" class="secondary" data-tournament-refresh aria-label="Refresh tournaments" '+(busy?'disabled':'')+'>Refresh</button></header><div class="competition-hero"><small>'+html(t?(t.isEvent?'TiQ tournament event':t.entrantType==='teams'?'TiQ team tournament':'TiQ player tournament'):'TiQ tournaments')+'</small><h2 tabindex="-1">'+html(t?.name||'Tournaments')+'</h2><p>'+html(t?[formatTournamentEventDate(t.date,true),t.location,status(t)].filter(Boolean).join(' · '):'Find your draw. Know your court. Follow every result.')+'</p></div>'+
   (!selected?'<form class="competition-search"><label for="tournament-search">Find a tournament</label><div><input id="tournament-search" type="search" name="q" maxlength="80" placeholder="Tournament name" value="'+html(query)+'" '+(busy?'disabled':'')+'><button type="submit" '+(busy?'disabled':'')+'>Search</button></div></form>'+(snapshot?tournamentCardsHtml(snapshot.tournaments)+(snapshot.more?'<p>Showing up to 20 recently updated tournaments. Search by name to narrow the list.</p>':''):''):
   d?(d.active?'<nav class="competition-tabs" aria-label="Tournament views">'+(['home','draw','schedule','results',...(d.standings.length?['standings']:[])] as View[]).map(v=>'<button type="button" class="secondary" data-tournament-view="'+v+'" aria-pressed="'+(view===v)+'">'+({home:'Overview',draw:'Draw',schedule:'Schedule',results:'Results',standings:'Standings'})[v]+'</button>').join('')+'</nav>':'')+'<div data-tournament-content>'+tournamentDetailHtml(d,view,filters)+'</div>':'')+
   '<p role="'+(notice&&!busy?'alert':'status')+'" tabindex="-1" data-tournament-notice>'+html(notice)+'</p>'+(snapshot?'<p class="competition-checked">Checked '+html(new Date(snapshot.checkedAt).toLocaleString())+' · refresh for changes.</p>':'')
  dialog.querySelector('[data-tournament-back]')?.addEventListener('click',back)
  dialog.querySelector('[data-tournament-refresh]')?.addEventListener('click',()=>{void load()})
  dialog.querySelector<HTMLFormElement>('.competition-search')?.addEventListener('submit',e=>{e.preventDefault();query=String(new FormData(e.currentTarget as HTMLFormElement).get('q')||'').trim();void load()})
  dialog.querySelectorAll<HTMLButtonElement>('[data-tournament-open]').forEach(b=>{b.onclick=()=>{const t=snapshot?.tournaments[Number(b.dataset.tournamentOpen)];if(t){selected=t.id;view='home';filters=emptyTournamentMatchFilters();void load()}}})
  dialog.querySelectorAll<HTMLButtonElement>('[data-tournament-division]').forEach(b=>{b.onclick=()=>{const t=snapshot?.detail?.divisions[Number(b.dataset.tournamentDivision)];if(t){division=t.id;view='home';filters=emptyTournamentMatchFilters();void load()}}})
  const filterFocus=()=>dialog.querySelector<HTMLElement>('[data-tournament-filter-status]')?.focus({preventScroll:true})
  dialog.querySelector<HTMLFormElement>('.tournament-match-filters')?.addEventListener('submit',e=>{e.preventDefault();if(!active()||busy||!snapshot?.detail?.active)return;const form=new FormData(e.currentTarget as HTMLFormElement);filters={query:String(form.get('player')||'').slice(0,160).trim(),day:view==='schedule'?String(form.get('day')||''):filters.day,court:view==='schedule'?String(form.get('court')||''):filters.court};render();filterFocus()})
  dialog.querySelector('[data-tournament-clear-filters]')?.addEventListener('click',()=>{if(!active())return;filters=emptyTournamentMatchFilters();render();filterFocus()})
  dialog.querySelectorAll<HTMLButtonElement>('[data-tournament-view]').forEach(b=>{b.onclick=()=>{view=b.dataset.tournamentView as View;render();focus()}})
 }
 const load=async()=>{if(!active())return;const attempt=++version;busy=true;snapshot=null;notice='Loading published tournaments…';render()
  try{const result=await loadTournaments(client,owner,()=>active()&&version===attempt,query,selected,division,send);if(active()&&version===attempt){snapshot=result;notice=''}}
  catch{if(active()&&version===attempt)notice='Couldn’t load these tournaments. Refresh to try again.'}
  finally{if(active()&&version===attempt){busy=false;render();focus();if(notice)dialog.querySelector<HTMLElement>('[data-tournament-notice]')?.focus()}}
 }
 dialog.oncancel=e=>{e.preventDefault();back()};document.addEventListener('visibilitychange',hidden);document.body.append(dialog);dialog.showModal();void load()
 return {dispose,isOpen:()=>!disposed,back}
}
