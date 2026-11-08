import type {SupabaseClient} from '@supabase/supabase-js'
import type {ScenarioSend} from './captain-scenarios-data'
import type {TournamentSnapshot,TournamentSummary,TournamentDetail,TournamentMatch,TournamentStanding} from '../../lib/native-tournaments-contract'
import {formatTournamentEventDate,formatTournamentEventTime} from '../../lib/tournament-event-presentation'
import {loadTournaments} from './tournaments-data'
import {bindCompetitionSearch,competitionDirectoryHtml} from './competition-directory'
import {competitionEntryActionHtml} from './competition-entry-action'
import {bindCompetitionHistory,competitionHistoryNavigationHtml,competitionHistorySectionHtml} from './competition-history'
import {competitionMatchGroupsHtml,competitionOpponentsHtml,competitionOutcomeHtml,competitionScheduleHtml} from './competition-match-card'
import {openTournamentEntry} from './tournament-entry-view'
import {html} from './match-details'
import {bindTournamentStandingsFinder,emptyTournamentStandingFilters,tournamentStandingsHtml,type TournamentStandingFilters} from './tournament-standings-finder'
import {restoreLeagueEvidenceFocus as restoreListFocus} from './league-evidence-dialog'
import {emptyTournamentMatchFilters,filterTournamentMatches,tournamentMatchFiltersHtml,tournamentViewMatches,tournamentEntrantMatches,tournamentCourtLabel,tournamentDrawRoundLabel,tournamentScheduleDay,type TournamentMatchFilters,type TournamentMatchView} from './tournament-match-filters'
type View='home'|'draw'|'schedule'|'results'|'standings'
type Entrant=Pick<TournamentStanding,'name'|'group'>
const status=(t:TournamentSummary)=>t.status==='open'&&t.registrationClosed?'Registration closed':({open:'Registration open',scheduled:'Scheduled',completed:'Completed'})[t.status]
export function tournamentCardsHtml(tournaments:TournamentSummary[],division=false){
 return tournaments.length?'<div class="competition-cards">'+tournaments.map((t,i)=>'<article class="competition-card"><div class="competition-card-meta"><span>'+html(t.isEvent?'Tournament event':t.formatLabel)+'</span><span class="competition-state" data-state="'+(t.registrationClosed?'closed':html(t.status))+'">'+html(status(t))+'</span></div><h3>'+html(t.name)+'</h3><div class="competition-card-details"><p>'+html(formatTournamentEventDate(t.date,true))+'</p><p>'+html(t.location||'Venue to be confirmed')+'</p></div><button type="button" class="secondary" data-tournament-'+(division?'division':'open')+'="'+i+'">'+(division?'Open division':'Open tournament')+'<span class="sr-only"> '+html(t.name)+'</span><span class="app-tool-arrow" aria-hidden="true">›</span></button></article>').join('')+'</div>':'<div class="competition-empty"><h3>No public '+(division?'divisions':'tournaments')+' found</h3><p>'+(division?'The organizer has not published a division yet.':'Try another tournament name or clear your search.')+'</p></div>'
}
function matchHtml(m:TournamentMatch,view:TournamentMatchView='results') {
 const court=tournamentCourtLabel(m.court)
 const outcome=m.winner?competitionOutcomeHtml('Winner',m.winner,m.score||undefined):''
 if(view==='schedule')return `<article class="competition-fixture tournament-match-card competition-schedule-match">
  ${competitionScheduleHtml('',formatTournamentEventTime(m.time),court||'Court not published')}
  <div class="fixture-heading">
   <p class="competition-date">${html(tournamentDrawRoundLabel(m))}</p>
   ${m.winner?'':'<span class="competition-status">Awaiting result</span>'}
  </div>
  ${competitionOpponentsHtml(m.a,m.b,'h5')}${outcome}
 </article>`
 const schedule=competitionScheduleHtml(m.date?formatTournamentEventDate(m.date,true):'',m.time?formatTournamentEventTime(m.time):'',court||(view==='draw'?'Court not published':''))
 if(view==='draw')return `<article class="competition-fixture tournament-match-card tournament-draw-match">
  ${competitionOpponentsHtml(m.a,m.b,'h5')}${schedule}${outcome}
 </article>`
 return `<article class="competition-fixture tournament-match-card">
  <div class="fixture-heading">
   <p class="competition-date">${html(m.label)}</p>
   ${m.winner?'':'<span class="competition-status">Awaiting result</span>'}
  </div>
  ${schedule}
  ${outcome}
  ${competitionOpponentsHtml(m.a,m.b)}
 </article>`
}
export function tournamentEntrantDetailHtml(d:TournamentDetail,entrant:Entrant){
 const s=d.active&&!d.drawNotice?d.standings.find(s=>s.name===entrant.name&&s.group===entrant.group):null
 if(!s)return '<h3 tabindex="-1">Entry unavailable</h3><p>This standings entry is no longer published. Return to standings to see the current draw.</p>'
 const rows=tournamentEntrantMatches(d.matches,s.name),pending=rows.filter(m=>!m.winner),results=rows.filter(m=>m.winner)
 const schedule=competitionHistorySectionHtml('schedule','Awaiting results',pending.length,pending.map(match=>matchHtml(match)).join(''),'No outstanding matches are published for this entrant.')
 const recorded=competitionHistorySectionHtml('results','Recorded results',results.length,results.map(match=>matchHtml(match)).join(''),'No results have been recorded for this entrant.')
 return '<div class="tournament-entrant-heading"><small>'+html(s.group?'Standings · '+s.group:'Standings record')+'</small><h3 tabindex="-1">'+html(s.name)+'</h3><div class="competition-metrics">'+[[s.wins+'–'+s.losses,'Record'],[s.played?s.winPct+'%':'—','Win rate'],[(s.gameDiff>0?'+':'')+s.gameDiff,'Game difference']].map(([value,label])=>'<div><strong>'+value+'</strong><span>'+label+'</span></div>').join('')+'</div><p>'+s.gamesWon+'–'+s.gamesLost+' ordinary set games. Match-tiebreak points are excluded.</p></div>'+competitionHistoryNavigationHtml('tournament',pending.length,results.length)+'<p class="league-finder-context">'+html(s.group?'Group record above. Published matches below include later rounds in this division.':'Published matches in this division.')+'</p><p class="tournament-entrant-timezone">Published times · '+html(d.active?.details.timeZone||'Time zone not published')+'</p>'+schedule+recorded
}
export function tournamentDetailHtml(d:TournamentDetail,view:View,filters:TournamentMatchFilters=emptyTournamentMatchFilters(),standingFilters:TournamentStandingFilters=emptyTournamentStandingFilters()){
 const t=d.active||d.root,e=t.details
 if(!d.active)return '<h3 tabindex="-1">Divisions</h3>'+tournamentCardsHtml(d.divisions,true)+(d.moreDivisions?'<p class="rating-context">Showing the first 20 public divisions.</p>':'')
 if(view==='home'&&d.drawNotice)return '<h3 tabindex="-1">'+html(t.formatLabel)+'</h3><p>'+html(d.drawNotice)+'</p>'
 if(view==='home')return '<h3 tabindex="-1">'+html(t.formatLabel)+'</h3><div class="competition-metrics">'+[[d.entrants,'Entrants'],[d.matches.length,'Matches'],[d.matches.filter(m=>m.winner).length,'Results']].map(([n,label])=>'<div><strong>'+n+'</strong><span>'+label+'</span></div>').join('')+'</div><p>'+html(e.formatSummary||'Follow the published draw, scheduled courts and recorded results.')+'</p>'+(t.registrationClosed?'<p>Registration has closed.</p>':'')+(e.registrationClosesOn?'<p>Registration deadline: '+html(formatTournamentEventDate(e.registrationClosesOn,true))+'</p>':'')+(e.venueName?'<p>'+html(e.venueName)+'</p>':'')+(e.venueAddress?'<p>'+html(e.venueAddress)+'</p>':'')+(e.directorName?'<p>Tournament director: '+html(e.directorName)+'</p>':'')
 if(d.drawNotice)return '<h3 tabindex="-1">Draw details</h3><p>'+html(d.drawNotice)+'</p>'
 if(view==='standings')return tournamentStandingsHtml(d,standingFilters)
 const matches=filterTournamentMatches(d.matches,view,filters),total=tournamentViewMatches(d.matches,view).length
 const cards=view==='results'?matches.map(match=>matchHtml(match)).join(''):competitionMatchGroupsHtml(matches,
  view==='schedule'?tournamentScheduleDay:tournamentDrawRoundLabel,
  view==='schedule'?formatTournamentEventDate:label=>label,
  match=>matchHtml(match,view),
 )
 return '<h3 tabindex="-1">'+({draw:'Draw',schedule:'Schedule',results:'Results'})[view]+'</h3>'+(view==='schedule'?'<p class="league-finder-context">Published court assignments · '+html(e.timeZone||'Time zone not published')+'. Check the desk for live court calls.</p>':'')+(total?tournamentMatchFiltersHtml(d.matches,view,filters)+'<p class="tournament-filter-status" tabindex="-1" role="status" data-tournament-filter-status>'+matches.length+' of '+total+' '+(total===1?'match':'matches')+' · selected division</p>':'')+(matches.length?cards:'<p>'+(total?'No matches fit these filters. Clear filters to see this division.':view==='results'?'No results have been recorded.':view==='schedule'?'Court assignments have not been published.':'The draw has not been published.')+'</p>')

}
export function openTournaments(client:SupabaseClient,owner:string,current:()=>boolean,onClose:()=>void,send?:ScenarioSend,trigger?:HTMLElement,backLabel='← Competitions',initialTournament=''){
 const previous=trigger||(document.activeElement instanceof HTMLElement?document.activeElement:null),dialog=document.createElement('dialog')
 dialog.className='captain-lineup-dialog competitions-dialog tournaments-dialog';dialog.setAttribute('aria-label','Tournaments')
 let child:ReturnType<typeof openTournamentEntry>|null=null
 let disposed=false,version=0,busy=false,query='',selected=/^[a-zA-Z0-9_-]{1,80}$/.test(initialTournament)?initialTournament:'',division='',view:View='home',snapshot:TournamentSnapshot|null=null,notice='',filters=emptyTournamentMatchFilters(),entrant:Entrant|null=null,standingsScroll=0,standingFilters=emptyTournamentStandingFilters()
 let tournamentListScroll:number|null=null,divisionListScroll=0
 const active=()=>!disposed&&current()
 const dispose=()=>{if(disposed)return;disposed=true;version++;child?.dispose();child=null;snapshot=null;document.removeEventListener('visibilitychange',hidden);dialog.remove();onClose();if(current()&&previous?.isConnected)previous.focus({preventScroll:true})}
 const hidden=()=>{if(document.visibilityState==='hidden')dispose()}
 const focus=()=>(dialog.querySelector<HTMLElement>('[data-tournament-content] h3')||dialog.querySelector<HTMLElement>('h2'))?.focus({preventScroll:true})
 const returnToStandings=()=>{const previousEntrant=entrant;entrant=null;view='standings';render();const i=snapshot?.detail?.standings.findIndex(s=>s.name===previousEntrant?.name&&s.group===previousEntrant?.group)??-1,target=dialog.querySelector<HTMLElement>('[data-tournament-entrant="'+i+'"]')||dialog.querySelector<HTMLElement>('[data-tournament-content] h3');restoreListFocus(dialog,target,standingsScroll)}
 const back=()=>{
  if(!active()){dispose();return true}
  if(child?.isOpen())return child.back()
  if(entrant){returnToStandings();return true}
  if(!selected){dispose();return true}
  const returning=division?{id:division,scroll:divisionListScroll}:tournamentListScroll===null?undefined:{id:selected,scroll:tournamentListScroll}
  if(division)division=''
  else{selected='';tournamentListScroll=null}
  view='home';filters=emptyTournamentMatchFilters();standingFilters=emptyTournamentStandingFilters()
  void load(returning)
  return true
 }
 const render=()=>{
  if(!active())return
  const d=snapshot?.detail,t=d?.active||d?.root
  const compactDetail=!!selected&&view!=='home'&&!entrant
  const toolbar=`<header class="competition-header${compactDetail?' competition-header-compact':''}">
   <button type="button" class="secondary" data-tournament-back>${html(entrant?'← Standings':division?'← Event':selected?'← Tournaments':backLabel)}</button>
   ${compactDetail&&d?.active?competitionEntryActionHtml('tournament',true):''}
   <button type="button" class="secondary" data-tournament-refresh aria-label="Refresh tournaments" ${busy?'disabled':''}>Refresh</button>
  </header>`
  dialog.innerHTML=toolbar+(entrant?'<p class="tournament-entrant-context">'+html(t?.name||'Tournament')+'</p>':selected?'<div class="competition-hero'+(compactDetail?' competition-hero-compact':'')+'"><small>'+html(t?(t.isEvent?'TiQ tournament event':t.entrantType==='teams'?'TiQ team tournament':'TiQ player tournament'):'TiQ tournaments')+'</small><h2 tabindex="-1">'+html(t?.name||'Tournaments')+'</h2>'+(t?'<p>'+html([formatTournamentEventDate(t.date,true),t.location,status(t)].filter(Boolean).join(' · '))+'</p>':'')+'</div>':'')+
   (!selected?competitionDirectoryHtml('tournament',query,busy)+(snapshot?tournamentCardsHtml(snapshot.tournaments)+(snapshot.more?'<p>Showing up to 20 recently updated tournaments. Search by name to narrow the list.</p>':''):''):
   d?(d.active&&!entrant?'<nav class="competition-tabs" aria-label="Tournament views">'+(['home','draw','schedule','results',...(d.standings.length?['standings']:[])] as View[]).map(v=>'<button type="button" class="secondary" data-tournament-view="'+v+'" aria-pressed="'+(view===v)+'">'+({home:'Overview',draw:'Draw',schedule:'Schedule',results:'Results',standings:'Standings'})[v]+'</button>').join('')+'</nav>'+(compactDetail?'':competitionEntryActionHtml('tournament')):'')+'<div data-tournament-content>'+(entrant?tournamentEntrantDetailHtml(d,entrant):tournamentDetailHtml(d,view,filters,standingFilters))+'</div>':'')+
   '<p role="'+(notice&&!busy?'alert':'status')+'" tabindex="-1" data-tournament-notice>'+html(notice)+'</p>'+(snapshot?'<p class="competition-checked">Checked '+html(new Date(snapshot.checkedAt).toLocaleString())+' · refresh for changes.</p>':'')
  dialog.querySelector('[data-tournament-entry]')?.addEventListener('click',e=>{if(!active()||busy||entrant||!snapshot?.detail?.active||child?.isOpen())return;const detail=snapshot.detail;child=openTournamentEntry(client,owner,active,detail.root.isEvent?detail.root.id:'',detail.active!.id,()=>{child=null},send,e.currentTarget instanceof HTMLElement?e.currentTarget:undefined)})
  dialog.querySelector('[data-tournament-back]')?.addEventListener('click',back)
  dialog.querySelector('[data-tournament-refresh]')?.addEventListener('click',()=>{void load()})
  bindCompetitionSearch(dialog,value=>{query=value;void load()})
  dialog.querySelectorAll<HTMLButtonElement>('[data-tournament-open]').forEach(b=>{b.onclick=()=>{
   const tournament=snapshot?.tournaments[Number(b.dataset.tournamentOpen)]
   if(!tournament)return
   tournamentListScroll=dialog.scrollTop
   selected=tournament.id;view='home';filters=emptyTournamentMatchFilters();standingFilters=emptyTournamentStandingFilters()
   dialog.scrollTop=0
   void load()
  }})
  dialog.querySelectorAll<HTMLButtonElement>('[data-tournament-division]').forEach(b=>{b.onclick=()=>{
   const entry=snapshot?.detail?.divisions[Number(b.dataset.tournamentDivision)]
   if(!entry)return
   divisionListScroll=dialog.scrollTop
   division=entry.id;view='home';filters=emptyTournamentMatchFilters();standingFilters=emptyTournamentStandingFilters()
   dialog.scrollTop=0
   void load()
  }})
  dialog.querySelectorAll<HTMLButtonElement>('[data-tournament-entrant]').forEach(b=>{b.onclick=()=>{if(!active()||busy)return;const s=snapshot?.detail?.standings[Number(b.dataset.tournamentEntrant)];if(!s||snapshot?.detail?.drawNotice)return;standingsScroll=dialog.scrollTop;entrant={name:s.name,group:s.group};render();dialog.scrollTop=0;focus()}})
  bindTournamentStandingsFinder(dialog,()=>active()&&!busy&&!entrant&&view==='standings'&&!!snapshot?.detail?.active,next=>{standingFilters=next;render();dialog.querySelector<HTMLElement>('[data-tournament-standings-status]')?.focus()})
  bindCompetitionHistory(dialog,()=>active()&&!busy&&!!entrant,focus)
  const applyMatchFilters=(form?:FormData)=>{
   if(!active()||busy||!snapshot?.detail?.active)return
   filters={...filters,query:String(form?.get('player')||'').slice(0,160).trim()}
   if(view==='schedule'){
    filters.day=String(form?.get('day')||'')
    filters.court=String(form?.get('court')||'')
   }
   if(view==='draw')filters.round=String(form?.get('round')||'').slice(0,500)
   render()
   dialog.querySelector<HTMLElement>('[data-tournament-filter-status]')?.focus({preventScroll:true})
  }
  dialog.querySelector<HTMLFormElement>('.tournament-match-filters')?.addEventListener('submit',e=>{e.preventDefault();applyMatchFilters(new FormData(e.currentTarget as HTMLFormElement))})
  dialog.querySelector('[data-tournament-clear-filters]')?.addEventListener('click',()=>applyMatchFilters())
  dialog.querySelectorAll<HTMLButtonElement>('[data-tournament-view]').forEach(b=>{b.onclick=()=>{view=b.dataset.tournamentView as View;render();focus()}})
 }
 const load=async(returning?:{id:string;scroll:number})=>{if(!active())return;const attempt=++version;busy=true;snapshot=null;notice='Loading published tournaments…';render()
  try{const result=await loadTournaments(client,owner,()=>active()&&version===attempt,query,selected,division,send);if(active()&&version===attempt){snapshot=result;notice=''}}
  catch{if(active()&&version===attempt)notice='Couldn’t load these tournaments. Refresh to try again.'}
  finally{if(active()&&version===attempt){
   busy=false;render()
   const cards=selected?snapshot?.detail?.divisions:snapshot?.tournaments
   const index=returning?cards?.findIndex(card=>card.id===returning.id)??-1:-1
   const action=selected?'data-tournament-division':'data-tournament-open'
   const opener=index>=0?dialog.querySelector<HTMLElement>('['+action+'="'+index+'"]'):null
   if(notice)dialog.querySelector<HTMLElement>('[data-tournament-notice]')?.focus()
   else if(opener&&returning)restoreListFocus(dialog,opener,returning.scroll)
   else focus()
  }}
 }
 dialog.oncancel=e=>{e.preventDefault();back()};document.addEventListener('visibilitychange',hidden);document.body.append(dialog);dialog.showModal();void load()
 return {dispose,isOpen:()=>!disposed,back}
}
