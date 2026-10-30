import type {ScenarioSend} from './captain-scenarios-data'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {CompetitionSnapshot,CompetitionScope} from '../../lib/native-competitions-contract'
import type {OfficeDetail} from '../../lib/native-league-office-contract'
import {loadCompetitions} from './competitions-data'
import {openTournaments} from './tournaments-view'
import {openLeagueEntry} from './league-entry-view'
import {officeSectionHtml} from './league-office-view'
import {bindLeagueMatchFinder,emptyLeagueFinder,emptyLeagueMatchFilters,leagueFixtureHtml,leagueMatchViewHtml,type LeagueMatchFilters} from './league-match-finder'
import {html} from './match-details'
import {bindLeaguePlayerActions,leaguePlayerOpenHtml,openLeaguePlayerEvidence,restoreLeaguePlayerFocus} from './league-player-evidence'
import {bindLeagueTeamActions,leagueTeamOpenHtml,openLeagueTeamEvidence,restoreLeagueTeamFocus} from './league-team-evidence'
type View='home'|'fixtures'|'results'|'standings'|'participants'
const stateLabel=(v:string)=>(({draft:'Draft',registration_open:'Registration open',active:'In season',completed:'Completed',archived:'Past season'} as Record<string,string>)[v]||v.replaceAll('_',' '))
export function competitionCardsHtml(snapshot:CompetitionSnapshot){
 return snapshot.leagues.length?'<div class="competition-cards">'+snapshot.leagues.map((l,i)=>{
  const related=snapshot.connections.filter(c=>c.leagueId===l.id),labels=related.map(c=>c.kind==='organizer'?'Season you created':(c.kind==='team'?'Team entry':'Player entry')+' · '+(c.status==='active'?'Approved':'Awaiting approval'))
  return '<article class="competition-card"><div class="competition-card-meta"><span>'+html(l.format==='team'?'Team league':'Player league')+'</span><span>'+html(stateLabel(l.status))+'</span></div><h3>'+html(l.name)+'</h3><p>'+html([l.season,l.flight,l.location].filter(Boolean).join(' · ')||'Season details pending')+'</p>'+(labels.length?'<p class="competition-entry">'+labels.map(html).join('<br>')+'</p>':'')+'<button type="button" class="secondary" data-competition-league="'+i+'">Open league<span class="sr-only"> '+html(l.name)+'</span><span aria-hidden="true">↗</span></button></article>'
 }).join('')+'</div>':'<div class="competition-empty"><h3>'+(snapshot.scope==='mine'?'No connected public leagues yet':'No public leagues found')+'</h3><p>'+(snapshot.scope==='mine'?'Your submitted entries and leagues matched to your linked player will appear here. Browse leagues to see public seasons.':'Try another league name or clear the search.')+'</p>'+(snapshot.scope==='mine'?'<button type="button" data-competition-discover>Browse leagues</button>':'')+'</div>'
}
export function competitionSeasonHtml(d:OfficeDetail,view:View,today?:string,filters:LeagueMatchFilters=emptyLeagueMatchFilters()){
 const dates=[...d.fixtures].sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time)||a.id.localeCompare(b.id))
 const localToday=today||new Intl.DateTimeFormat('en-CA',{timeZone:d.league.timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
 if(view==='home'){
  const upcoming=dates.filter(f=>f.date>=localToday&&!['cancelled','completed'].includes(f.status)).slice(0,2)
  return '<div class="competition-metrics" aria-label="Loaded season records">'+[[d.participants.length+(d.moreParticipants?'+':''),d.league.format==='team'?'Teams':'Players'],[d.fixtures.length+(d.moreFixtures?'+':''),'Dates'],[d.results.length+(d.moreResults?'+':''),'Results']].map(([v,label])=>'<div><strong>'+v+'</strong><span>'+label+'</span></div>').join('')+'</div><h3 tabindex="-1">Coming up</h3>'+(upcoming.length?upcoming.map(leagueFixtureHtml).join(''):'<p>No upcoming dates in the loaded schedule.</p>')+(d.moreFixtures?'<p class="rating-context">This is a limited schedule sample. Open Schedule to review the loaded dates.</p>':'')+'<p class="rating-context">Times use '+html(d.league.timeZone)+'. Proposals and cancellations keep their recorded status.</p>'
 }
 if(view==='fixtures'||view==='results')return leagueMatchViewHtml(d,view,filters)
 if(view==='participants')return '<h3 tabindex="-1">'+(d.league.format==='team'?'Teams':'Players')+'</h3><p>Approved entries'+(d.moreParticipants?' · showing the first 100':'')+'. Pending and declined entries are not listed.</p>'+(d.participants.length?'<ul class="competition-participants">'+d.participants.map(p=>'<li>'+html(p.name)+(d.league.format==='team'?leagueTeamOpenHtml(d,p.name,'participants'):leaguePlayerOpenHtml(d,p.name))+'</li>').join('')+'</ul>':'<p>No approved entries are listed yet.</p>')
 return officeSectionHtml(d,view).replace('Recorded court results use this league’s website scoring and standings rules. Unplayed events do not count as wins, losses or ties.','Match records and court wins follow this league’s scoring rules. Unplayed matches do not count.')
}
export function openCompetitions(client:SupabaseClient,owner:string,current:()=>boolean,initial:CompetitionScope='mine',onChats?:()=>void,send?:ScenarioSend,trigger?:HTMLElement){
 const previous=trigger||(document.activeElement instanceof HTMLElement?document.activeElement:null),dialog=document.createElement('dialog')
 dialog.className='captain-lineup-dialog competitions-dialog';dialog.setAttribute('aria-label','Competitions')
 let disposed=false,version=0,busy=false,scope=initial,query='',selected='',view:View='home',snapshot:CompetitionSnapshot|null=null,notice=''
 let filters=emptyLeagueFinder()
 let teamEvidence:ReturnType<typeof openLeagueTeamEvidence>|null=null
 let entry:ReturnType<typeof openLeagueEntry>|null=null
 let tournaments:ReturnType<typeof openTournaments>|null=null
 const active=()=>!disposed&&current()
 const dispose=()=>{if(disposed)return;disposed=true;version++;teamEvidence?.dispose();teamEvidence=null;tournaments?.dispose();tournaments=null;entry?.dispose();entry=null;snapshot=null;document.removeEventListener('visibilitychange',hidden);dialog.remove();if(current()&&previous?.isConnected)previous.focus({preventScroll:true})}
 const hidden=()=>{if(document.visibilityState==='hidden')dispose()}
 const focus=()=>dialog.querySelector<HTMLElement>(selected?'[data-competition-content] h3':'h2')?.focus({preventScroll:true})
 const back=()=>{if(!active()){dispose();return true}if(teamEvidence?.isOpen())return teamEvidence.back();if(tournaments?.isOpen())return tournaments.back();if(entry?.isOpen())return entry.back();if(selected){selected='';view='home';void load()}else dispose();return true}
 const render=()=>{
  if(!active())return
  const d=snapshot?.detail
  dialog.innerHTML='<header class="competition-header"><button type="button" class="secondary" data-competition-back>'+(selected?'← Competitions':'Close')+'</button><button type="button" class="secondary" data-competition-refresh '+(busy?'disabled':'')+'>Refresh</button></header>'+
   (selected?d?'<div class="competition-hero"><small>'+html(d.league.format==='team'?'TiQ team league':'TiQ player league')+'</small><h2 tabindex="-1">'+html(d.league.name)+'</h2><p>'+html([d.league.season,d.league.flight,stateLabel(d.league.status)].filter(Boolean).join(' · '))+'</p><p>'+html(d.league.location||'Location to be confirmed')+'</p></div><nav class="competition-tabs" aria-label="League views">'+(['home','fixtures','results',...(d.league.format==='team'?['standings']:[]),'participants'] as View[]).map(v=>'<button type="button" class="secondary" data-competition-view="'+v+'" aria-pressed="'+(v===view)+'">'+({home:'Overview',fixtures:'Schedule',results:'Results',standings:'Standings',participants:d.league.format==='team'?'Teams':'Players'})[v]+'</button>').join('')+'</nav><button type="button" class="secondary competition-entry-open" data-competition-entry>Entry &amp; registration</button><div data-competition-content>'+competitionSeasonHtml(d,view,undefined,view==='fixtures'||view==='results'?filters[view]:undefined)+'</div>'+(onChats?'<button type="button" class="secondary competition-chat" data-competition-chats>Open your team chats →</button>':''):'<h2 tabindex="-1">League</h2>':
   '<button type="button" class="secondary competition-entry-open" data-competition-tournaments>Browse tournaments →</button><div class="competition-hero"><small>TiQ leagues</small><h2 tabindex="-1">Competitions</h2><p>Your season. Your opponents. Your next match.</p></div><div class="competition-switch" role="group" aria-label="Competition list"><button type="button" class="secondary" data-competition-scope="mine" aria-pressed="'+(scope==='mine')+'" '+(busy?'disabled':'')+'>Your entries</button><button type="button" class="secondary" data-competition-scope="discover" aria-pressed="'+(scope==='discover')+'" '+(busy?'disabled':'')+'>Browse leagues</button></div><form class="competition-search"><label for="competition-search">Find a TiQ league</label><div><input type="search" id="competition-search" name="q" maxlength="80" value="'+html(query)+'" placeholder="League name" '+(busy?'disabled':'')+'><button type="submit" '+(busy?'disabled':'')+'>Search</button></div></form>'+
   (scope==='mine'?'<details class="competition-list-help"><summary>Which leagues appear here?</summary><p>Public seasons you created, your submitted entries and entries matched to your linked player. Private organizer seasons remain in League Office.</p></details>':'<p class="rating-context">Discover public TiQ team and player leagues. Imported USTA league summaries remain in Explore → Leagues.</p>')+
   (snapshot?competitionCardsHtml(snapshot)+(snapshot.moreLeagues?'<p class="rating-context">Showing up to 20 recently updated leagues. Search a league name to narrow the list.</p>':'')+(snapshot.moreConnections?'<p class="rating-context">Your connected-entry sample is limited; some older entries may be missing.</p>':''):'')
  )+'<p role="'+(notice&&!busy?'alert':'status')+'" tabindex="-1" data-competition-notice>'+html(notice)+'</p>'+(snapshot?'<p class="competition-checked">Checked '+html(new Date(snapshot.checkedAt).toLocaleString())+' · refresh for changes.</p>':'')
  dialog.querySelector('[data-competition-tournaments]')?.addEventListener('click',()=>{if(tournaments?.isOpen())return;tournaments=openTournaments(client,owner,active,()=>{tournaments=null},send)})
  dialog.querySelector('[data-competition-back]')?.addEventListener('click',back)
  dialog.querySelector('[data-competition-refresh]')?.addEventListener('click',()=>{void load()})
  dialog.querySelectorAll<HTMLButtonElement>('[data-competition-scope]').forEach(b=>{b.onclick=()=>{scope=b.dataset.competitionScope as CompetitionScope;void load()}})
  dialog.querySelector('[data-competition-discover]')?.addEventListener('click',()=>{scope='discover';void load()})
  dialog.querySelector<HTMLFormElement>('form.competition-search')?.addEventListener('submit',e=>{e.preventDefault();query=String(new FormData(e.currentTarget as HTMLFormElement).get('q')||'').trim();void load()})
  dialog.querySelectorAll<HTMLButtonElement>('[data-competition-league]').forEach(b=>{b.onclick=()=>{const l=snapshot?.leagues[Number(b.dataset.competitionLeague)];if(l){selected=l.id;view='home';filters=emptyLeagueFinder();void load()}}})
  dialog.querySelectorAll<HTMLButtonElement>('[data-competition-view]').forEach(b=>{b.onclick=()=>{view=b.dataset.competitionView as View;render();focus()}})
  dialog.querySelector('[data-competition-entry]')?.addEventListener('click',()=>{if(!selected||entry?.isOpen())return;entry=openLeagueEntry(client,owner,active,selected,()=>{entry=null;if(active())void load()},send)})
  if(d)bindLeagueTeamActions(dialog,d,()=>active()&&!busy,team=>{
   if(teamEvidence?.isOpen())return;const scroll=dialog.scrollTop,id=d.league.id,chosenScope=scope,chosenQuery=query
   teamEvidence=openLeagueTeamEvidence(d,team,active,async valid=>{try{const result=await loadCompetitions(client,owner,()=>active()&&valid(),chosenScope,chosenQuery,id,send);if(!valid()||!result.detail)throw Error('League changed');snapshot=result;notice='';return result.detail}catch(error){if(valid()){snapshot=null;notice='Couldn’t refresh this league. Refresh to try again.'}throw error}},()=>{teamEvidence=null;if(active()){render();restoreLeagueTeamFocus(dialog,team,scroll)}},team.source==='standings'?'← Standings':'← Teams')
  })
  if(d)bindLeaguePlayerActions(dialog,d,()=>active()&&!busy,name=>{
   if(teamEvidence?.isOpen())return;const scroll=dialog.scrollTop,id=d.league.id,chosenScope=scope,chosenQuery=query
   teamEvidence=openLeaguePlayerEvidence(d,name,active,async valid=>{try{const result=await loadCompetitions(client,owner,()=>active()&&valid(),chosenScope,chosenQuery,id,send);if(!valid()||!result.detail)throw Error('League changed');snapshot=result;notice='';return result.detail}catch(error){if(valid()){snapshot=null;notice='Couldn’t refresh this league. Refresh to try again.'}throw error}},()=>{teamEvidence=null;if(active()){render();restoreLeaguePlayerFocus(dialog,name,scroll)}},'← Players')
  })
  bindLeagueMatchFinder(dialog,()=>active()&&!busy,next=>{if(view!=='fixtures'&&view!=='results')return;filters[view]=next;render();dialog.querySelector<HTMLElement>('[data-league-filter-summary]')?.focus()})
  dialog.querySelector('[data-competition-chats]')?.addEventListener('click',()=>{dispose();onChats?.()})
 }
 const load=async()=>{
  if(!active())return
  const attempt=++version;busy=true;snapshot=null;notice='Loading your competition records…';render()
  try{const result=await loadCompetitions(client,owner,()=>active()&&version===attempt,scope,query,selected,send);if(active()&&version===attempt){snapshot=result;notice=''}}
  catch{if(active()&&version===attempt)notice='Couldn’t load these competitions. Refresh to try again.'}
  finally{if(active()&&version===attempt){busy=false;render();focus();if(notice)dialog.querySelector<HTMLElement>('[data-competition-notice]')?.focus()}}
 }
 dialog.oncancel=e=>{e.preventDefault();back()};document.addEventListener('visibilitychange',hidden);document.body.append(dialog);dialog.showModal();void load()
 return {dispose,isOpen:()=>!disposed,back}
}
