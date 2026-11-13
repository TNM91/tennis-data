import type {ScenarioSend} from './captain-scenarios-data'
import type {SupabaseClient} from '@supabase/supabase-js'
import {publicCompetitionOwner,type CompetitionSnapshot,type CompetitionScope} from '../../lib/native-competitions-contract'
import type {OfficeDetail} from '../../lib/native-league-office-contract'
import {loadCompetitions} from './competitions-data'
import {bindCompetitionSearch,competitionDirectoryHtml,focusCompetitionSearchResults} from './competition-directory'
import {competitionEntryActionHtml} from './competition-entry-action'
import {openTournaments} from './tournaments-view'
import {entryStatusLabel,openLeagueEntry} from './league-entry-view'
import {openLeagueDecisions} from './league-decisions-view'
import {openLeagueSchedule} from './league-schedule-view'
import {openLeagueScores} from './league-score-view'
import {bindLeagueMatchFinder,emptyLeagueFinder,emptyLeagueMatchFilters,filterLeagueFixtures,leagueFixtureDay,leagueFixtureHtml,leagueMatchViewHtml,type LeagueMatchFilters} from './league-match-finder'
import {bindCompetitionScheduleJumps,competitionScheduleClock,competitionScheduleJumpButton,focusCalendarCompetitionMatch,focusCompetitionMatch} from './competition-match-card'
import {html} from './match-details'
import {bindLeagueListFinder,emptyLeagueListFinder,emptyLeagueListFilters,leagueParticipantsViewHtml,leagueStandingsViewHtml,type LeagueListFilters} from './league-list-finder'
import {bindLeaguePlayerActions,openLeaguePlayerEvidence,restoreLeaguePlayerFocus} from './league-player-evidence'
import {bindLeagueTeamActions,openLeagueTeamEvidence,restoreLeagueTeamFocus} from './league-team-evidence'
import {restoreLeagueEvidenceFocus as restoreListFocus} from './league-evidence-dialog'
import {firstPartyBuild} from './build-scope'
import {courtAccountId} from '../../lib/native-court-result-contract'
import {openCaptainCourtScores} from './captain-court-view'
import {localCalendarDate} from './calendar-data'
import type {CalendarScorecardSeed} from './personal-match-data'
type View='home'|'fixtures'|'results'|'standings'|'participants'
type ReturnPosition={scroll:number}&({target:'league'|'league-entry';id:string}|{target:'registration'|'entry-requests'})
const stateLabel=(v:string)=>(({draft:'Draft',registration_open:'Registration open',active:'In season',completed:'Completed',archived:'Past season'} as Record<string,string>)[v]||v.replaceAll('_',' '))
export function competitionCardsHtml(snapshot:CompetitionSnapshot){
 return snapshot.leagues.length?'<div class="competition-cards">'+snapshot.leagues.map((l,i)=>{
  const related=snapshot.scope==='mine'?snapshot.connections.filter(c=>c.leagueId===l.id):[]
  const canViewEntry=related.some(c=>c.kind!=='organizer')
  const connections=related.map(c=>c.kind==='organizer'?'<li>Season you created</li>':`<li>
   <span>${c.kind==='team'?'Team entry':'Player entry'}</span>
   <span class="competition-entry-status" data-entry-status="${html(c.status)}">${c.status==='pending'?'Awaiting approval':entryStatusLabel(c.status)}</span>
  </li>`).join('')
  const name=html(l.name)
  return `<article class="competition-card">
   <div class="competition-card-meta"><span>${l.format==='team'?'Team league':'Player league'}</span><span class="competition-state" data-state="${html(l.status)}">${html(stateLabel(l.status))}</span></div>
   <h3>${name}</h3><p class="competition-card-detail">${html([l.season,l.flight,l.location].filter(Boolean).join(' · ')||'Season details pending')}</p>
   ${connections?`<ul class="competition-entry-list" aria-label="Your league connections" role="list">${connections}</ul>`:''}
   <div class="competition-card-actions">
    <button type="button" class="secondary" data-competition-league="${i}">Open league<span class="sr-only"> ${name}</span><span class="app-tool-arrow" aria-hidden="true">›</span></button>
    ${canViewEntry?`<button type="button" class="secondary" data-competition-league-entry="${i}">View entry<span class="sr-only"> for ${name}</span><span class="app-tool-arrow" aria-hidden="true">›</span></button>`:''}
   </div>
  </article>`
 }).join('')+'</div>':'<div class="competition-empty"><h3>'+(snapshot.scope==='mine'?'No connected public leagues yet':'No public leagues found')+'</h3><p>'+(snapshot.scope==='mine'?(firstPartyBuild?'Your submitted entries and published seasons you organize will appear here.':'Your submitted entries and leagues matched to your linked player will appear here. Browse leagues to see public seasons.'):'Public TiQ league seasons will appear here when published.')+'</p>'+(snapshot.scope==='mine'?'<button type="button" data-competition-discover>Browse leagues</button>':'')+'</div>'
}
export function competitionSeasonHtml(d:OfficeDetail,view:View,today?:string,filters:LeagueMatchFilters=emptyLeagueMatchFilters(),listFilters:LeagueListFilters=emptyLeagueListFilters()){
 if(view==='home'){
  const localToday=today||competitionScheduleClock(d.league.timeZone).day
  const upcoming=filterLeagueFixtures(d.fixtures,emptyLeagueMatchFilters())
   .filter(f=>leagueFixtureDay(f)>=localToday&&!['cancelled','completed'].includes(f.status)).slice(0,2)
  return '<div class="competition-metrics" aria-label="Loaded season records">'+[[d.participants.length+(d.moreParticipants?'+':''),d.league.format==='team'?'Teams':'Players'],[d.fixtures.length+(d.moreFixtures?'+':''),'Dates'],[d.results.length+(d.moreResults?'+':''),'Results']].map(([v,label])=>'<div><strong>'+v+'</strong><span>'+label+'</span></div>').join('')+'</div><h3 tabindex="-1">Coming up</h3>'+(upcoming.length?upcoming.map(f=>leagueFixtureHtml(f,'preview')).join(''):'<p>No upcoming dates in the loaded schedule.</p>')+(d.moreFixtures?'<p class="rating-context">This is a limited schedule sample. Open Schedule to review the loaded dates.</p>':'')+'<p class="rating-context">Times use '+html(d.league.timeZone)+'. Proposals and cancellations keep their recorded status.</p>'
 }
 if(view==='fixtures'||view==='results')return leagueMatchViewHtml(d,view,filters,view==='results')
 if(view==='participants')return leagueParticipantsViewHtml(d,listFilters,false)
 return leagueStandingsViewHtml(d,listFilters)
}
export function openCompetitions(client:SupabaseClient,owner:string,current:()=>boolean,initial:CompetitionScope='mine',onChats?:()=>void,send?:ScenarioSend,trigger?:HTMLElement,initialLeague='',calendarEntry?:{matchId?:string;fromUpdates?:true},initialQuery='',openPersonal?:(seed:CalendarScorecardSeed)=>void){
 const previous=trigger||(document.activeElement instanceof HTMLElement?document.activeElement:null),dialog=document.createElement('dialog')
 dialog.className='captain-lineup-dialog competitions-dialog';dialog.setAttribute('aria-label','Competitions')
 const guest=firstPartyBuild&&owner===publicCompetitionOwner
 let disposed=false,version=0,busy=false,scope=initial,query=initialQuery,selected=/^[a-zA-Z0-9_-]{1,80}$/.test(initialLeague)?initialLeague:'',view:View=calendarEntry?'fixtures':'home',snapshot:CompetitionSnapshot|null=null,notice=''
 let calendarMatchId=calendarEntry?.matchId
 let filters=emptyLeagueFinder(),lists=emptyLeagueListFinder()
 let showFullSchedule=false
 let leagueListScroll:number|null=null
 let teamEvidence:ReturnType<typeof openLeagueTeamEvidence>|null=null
 let entry:ReturnType<typeof openLeagueEntry>|null=null
 let decisions:ReturnType<typeof openLeagueDecisions>|null=null
 let scheduler:ReturnType<typeof openLeagueSchedule>|null=null
 let scores:ReturnType<typeof openLeagueScores>|null=null
 let tournaments:ReturnType<typeof openTournaments>|null=null
 let courtDesk:ReturnType<typeof openCaptainCourtScores>|null=null
 const active=()=>!disposed&&current()
 const dispose=()=>{if(disposed)return;disposed=true;version++;scores?.dispose();scores=null;scheduler?.dispose();scheduler=null;courtDesk?.dispose();courtDesk=null;teamEvidence?.dispose();teamEvidence=null;tournaments?.dispose();tournaments=null;entry?.dispose();entry=null;decisions?.dispose();decisions=null;snapshot=null;document.removeEventListener('visibilitychange',hidden);dialog.remove();if(current()&&previous?.isConnected)previous.focus({preventScroll:true})}
 const hidden=()=>{if(document.visibilityState==='hidden')dispose()}
 const focus=()=>((selected?dialog.querySelector<HTMLElement>('[data-competition-content] h3'):null)??dialog.querySelector<HTMLElement>('h2'))?.focus({preventScroll:true})
 const back=()=>{
  if(!active()){dispose();return true}
  if(scores?.isOpen())return scores.back()
  if(scheduler?.isOpen())return scheduler.back()
  if(courtDesk?.isOpen())return courtDesk.back()
  if(teamEvidence?.isOpen())return teamEvidence.back()
  if(tournaments?.isOpen())return tournaments.back()
  if(entry?.isOpen())return entry.back()
  if(decisions?.isOpen())return decisions.back()
  if(calendarEntry){dispose();return true}
  if(selected){
   const returning:ReturnPosition|undefined=leagueListScroll===null?undefined:{target:'league',id:selected,scroll:leagueListScroll}
   selected='';view='home';leagueListScroll=null;showFullSchedule=false
   void load(returning)
  }else dispose()
  return true
 }
 const showEntry=(id:string,returning:ReturnPosition)=>{
  if(guest||!active()||busy||entry?.isOpen())return
  entry=openLeagueEntry(client,owner,active,id,()=>{entry=null;if(active())void load(returning)},send,returning.target==='league-entry'?'entries':'league')
 }
 const render=()=>{
  if(!active())return
  const d=snapshot?.detail
  const noMatches=Boolean(query)&&snapshot?.leagues.length===0
  const compactDetail=!!selected&&view!=='home'
  const entryAvailable=!guest&&!!d
  const canReviewEntries=firstPartyBuild&&!guest&&snapshot?.canReviewEntries===true
  const canSchedule=firstPartyBuild&&!guest&&snapshot?.canScheduleMatches===true
  const canOpenScores=firstPartyBuild&&!guest&&snapshot?.canOpenLeagueScores===true
  const canReviewScores=canOpenScores&&canReviewEntries
  const approved=snapshot?.approvedScores
  const detailsUnderReview=snapshot?.detailsUnderReview===true
  const scheduleDetail=d&&detailsUnderReview?{...d,fixtures:snapshot?.publishedSchedule??[]}:d
  const scheduleAvailable=canSchedule||!!snapshot?.publishedSchedule?.length
  const tabs:View[]=detailsUnderReview
   ? ['home',...(scheduleAvailable?['fixtures' as const]:[]),...(approved||canReviewScores?['results' as const]:[]),...(approved?['standings' as const]:[])]
   : ['home','fixtures','results',...(d?.league.format==='team'?['standings' as const]:[]),'participants']
  const fromLabel=calendarEntry?.fromUpdates?'Back to updates':'Back to calendar'
  const matchFilters=view==='fixtures'||view==='results'?filters[view]:undefined
  const displayedFilters=view==='fixtures'&&showFullSchedule?emptyLeagueMatchFilters():matchFilters
  const toolbar=`<header class="competition-header${compactDetail?' competition-header-compact':''}">
   <button type="button" class="secondary" data-competition-back>${calendarEntry?fromLabel:selected?'← Competitions':'Close'}</button>
   ${entryAvailable&&compactDetail?competitionEntryActionHtml('league',true):''}
   <button type="button" class="secondary" data-competition-refresh ${busy?'disabled':''}>Refresh</button>
  </header>`
  dialog.innerHTML=toolbar+
   (selected?d?'<div class="competition-hero'+(compactDetail?' competition-hero-compact':'')+'"><small>'+html(d.league.format==='team'?'TiQ team league':'TiQ player league')+'</small><h2 tabindex="-1">'+html(d.league.name)+'</h2><p>'+html([d.league.season,d.league.flight,stateLabel(d.league.status)].filter(Boolean).join(' · '))+'</p><p>'+html(d.league.location||'Location to be confirmed')+'</p></div>'+
   (tabs.length>1?'<nav class="competition-tabs" aria-label="League views">'+tabs.map(v=>'<button type="button" class="secondary" data-competition-view="'+v+'" aria-pressed="'+(v===view)+'">'+({home:'Overview',fixtures:'Schedule',results:'Results',standings:'Standings',participants:d.league.format==='team'?'Teams':'Players'})[v]+'</button>').join('')+'</nav>':'')+
   (!entryAvailable||compactDetail?'':competitionEntryActionHtml('league'))+
   (canReviewEntries?'<button type="button" class="secondary competition-entry-open" data-competition-decisions>Review entry requests</button>':'')+
   (canSchedule&&view==='fixtures'?'<div class="league-scheduler-actions"><button type="button" data-competition-schedule-add>Schedule match</button><button type="button" class="secondary" data-competition-schedule-manage>Manage schedule</button></div>':'')+
   (canReviewScores&&view==='results'?'<div class="league-scheduler-actions"><button type="button" data-competition-score-queue>Review scores</button></div>':'')+
   '<div data-competition-content>'+(
    detailsUnderReview&&view==='fixtures'&&scheduleAvailable&&scheduleDetail
     ? '<p class="entry-note">Showing matches published from the app while other league updates are under review.</p>'+competitionSeasonHtml(scheduleDetail,view,undefined,displayedFilters)
     : detailsUnderReview&&approved&&(view==='results'||view==='standings')
     ? '<p class="entry-note">Showing approved app scores while other league updates are under review.</p>'+
       competitionSeasonHtml({...d,...approved,standingsAvailable:true},view,undefined,displayedFilters,view==='standings'?lists.standings:undefined)
     : detailsUnderReview?'<p class="entry-note">League updates are under review. Check back for the roster, schedule and results.</p>'
     : competitionSeasonHtml(d,view,undefined,displayedFilters,view==='participants'||view==='standings'?lists[view]:undefined))+'</div>'+
   (onChats?'<button type="button" class="secondary competition-chat" data-competition-chats>Open your team chats →</button>':''):'<h2 tabindex="-1">League</h2>':
   competitionDirectoryHtml('league',query,busy,{count:snapshot?.leagues.length,resetLabel:scope==='mine'?'Show all entries':undefined,controls:guest?'':`<div class="competition-switch" role="group" aria-label="Competition list">
    <button type="button" class="secondary" data-competition-scope="mine" aria-pressed="${scope==='mine'}" ${busy?'disabled':''}>Your entries</button>
    <button type="button" class="secondary" data-competition-scope="discover" aria-pressed="${scope==='discover'}" ${busy?'disabled':''}>Browse leagues</button>
   </div>`})+
   (snapshot?(noMatches?'':competitionCardsHtml(snapshot))+(snapshot.moreLeagues?'<p class="rating-context">Showing up to 20 recently updated leagues. Search a league name to narrow the list.</p>':'')+(snapshot.moreConnections?'<p class="rating-context">Your connected-entry sample is limited; some older entries may be missing.</p>':''):'')+
   (scope==='mine'?'<details class="competition-list-help"><summary>Which leagues appear here?</summary><p>'+(
    firstPartyBuild?'Public seasons you created and your submitted entries.':'Public seasons you created, your submitted entries and entries matched to your linked player. Private organizer seasons remain in League Office.'
   )+'</p></details>':'<p class="rating-context">Discover public TiQ team and player leagues.'+(firstPartyBuild?'':' Imported USTA league summaries remain in Explore → Leagues.')+'</p>')+
   (guest?'':'<button type="button" class="secondary competition-entry-open" data-competition-tournaments>Browse tournaments →</button>')
  )+'<p role="'+(notice&&!busy?'alert':'status')+'" tabindex="-1" data-competition-notice>'+html(notice)+'</p>'+(snapshot?'<p class="competition-checked">Checked '+html(new Date(snapshot.checkedAt).toLocaleString())+' · refresh for changes.</p>':'')
  const tournamentLink=dialog.querySelector<HTMLButtonElement>('[data-competition-tournaments]')
  if(tournamentLink)tournamentLink.onclick=()=>{if(tournaments?.isOpen())return;tournaments=openTournaments(client,owner,active,()=>{tournaments=null},send,tournamentLink)}
  dialog.querySelector('[data-competition-back]')?.addEventListener('click',back)
  dialog.querySelector('[data-competition-refresh]')?.addEventListener('click',()=>{void load()})
  dialog.querySelectorAll<HTMLButtonElement>('[data-competition-scope]').forEach(b=>{b.onclick=()=>{scope=b.dataset.competitionScope as CompetitionScope;void load()}})
  dialog.querySelector('[data-competition-discover]')?.addEventListener('click',()=>{scope='discover';void load()})
  bindCompetitionSearch(dialog,value=>{query=value;void load(undefined,true)})
  dialog.querySelectorAll<HTMLButtonElement>('[data-competition-league]').forEach(b=>{b.onclick=()=>{
   const league=snapshot?.leagues[Number(b.dataset.competitionLeague)]
   if(!league)return
   leagueListScroll=dialog.scrollTop
   selected=league.id;view='home';filters=emptyLeagueFinder();lists=emptyLeagueListFinder()
   dialog.scrollTop=0
   void load()
  }})
  dialog.querySelectorAll<HTMLButtonElement>('[data-competition-view]').forEach(b=>{b.onclick=()=>{
   showFullSchedule=false
   view=b.dataset.competitionView as View
   render();focus()
  }})
  const openSchedule=(button:HTMLButtonElement,id='',manage=false)=>{
   if(!canSchedule||!active()||busy||!selected||scheduler?.isOpen())return
   scheduler=openLeagueSchedule(client,owner,active,selected,(saved,refresh)=>{
    scheduler=null
    if(!active())return
    if(saved){filters.fixtures=emptyLeagueMatchFilters();showFullSchedule=true;calendarMatchId=saved;void load()}
    else if(refresh)void load()
    else button.focus({preventScroll:true})
   },send,id,manage)
  }
  dialog.querySelector<HTMLButtonElement>('[data-competition-schedule-add]')?.addEventListener('click',event=>openSchedule(event.currentTarget as HTMLButtonElement))
  dialog.querySelector<HTMLButtonElement>('[data-competition-schedule-manage]')?.addEventListener('click',event=>openSchedule(event.currentTarget as HTMLButtonElement,'',true))
  const openScore=(button:HTMLButtonElement,id='')=>{
   if(!canOpenScores||!active()||busy||!selected||scores?.isOpen())return
   scores=openLeagueScores(client,owner,active,selected,id,changed=>{
    scores=null
    if(!active())return
    if(changed){view='standings';void load()}
    else button.focus({preventScroll:true})
   },send)
  }
  dialog.querySelector<HTMLButtonElement>('[data-competition-score-queue]')?.addEventListener('click',event=>openScore(event.currentTarget as HTMLButtonElement))
  if(canOpenScores&&scheduleDetail&&view==='fixtures'){
   const clock=competitionScheduleClock(scheduleDetail.league.timeZone)
   const eligible=new Set(scheduleDetail.fixtures.filter(match=>courtAccountId(match.id)&&['confirmed','coordinator_set','completed'].includes(match.status)&&
    (match.date<clock.day||match.date===clock.day&&(!match.time||match.time.slice(0,5)<=clock.time))).map(match=>match.id))
   dialog.querySelectorAll<HTMLElement>('[data-competition-schedule-match]').forEach(card=>{
    const id=card.dataset.competitionScheduleMatch
    if(!id||!eligible.has(id))return
    const button=document.createElement('button')
    button.type='button';button.className='secondary';button.textContent='League scorecard'
    button.onclick=()=>openScore(button,id)
    card.append(button)
   })
  }
  if(canSchedule&&scheduleDetail&&view==='fixtures'){
   const clock=competitionScheduleClock(scheduleDetail.league.timeZone)
   const upcoming=new Set(scheduleDetail.fixtures.filter(f=>courtAccountId(f.id)&&['confirmed','coordinator_set'].includes(f.status)&&
    (f.date>clock.day||f.date===clock.day&&f.time.slice(0,5)>clock.time)).map(f=>f.id))
   dialog.querySelectorAll<HTMLElement>('[data-competition-schedule-match]').forEach(card=>{
    const id=card.dataset.competitionScheduleMatch
    if(!id||!upcoming.has(id))return
    const button=document.createElement('button')
    button.type='button';button.className='secondary';button.textContent='Reschedule'
    button.onclick=()=>openSchedule(button,id)
    card.append(button)
   })
  }
  if(d)bindCompetitionScheduleJumps(dialog,(id,trigger)=>{
   if(!active()||busy||(view!=='home'&&view!=='results'))return
   const source=view,sourceScroll=dialog.scrollTop
   const sourceResult=trigger.closest<HTMLElement>('[data-league-result-id]')
   const resultId=sourceResult?.dataset.leagueResultId
   const scoresOpen=sourceResult?.querySelector('details')?.open
   showFullSchedule=!filterLeagueFixtures(d.fixtures,filters.fixtures).some(fixture=>fixture.id===id)
   view='fixtures'
   render()
   if(!focusCompetitionMatch(dialog,id,()=>{
    if(!active()||busy||view!=='fixtures')return
    showFullSchedule=false
    view=source
    render()
    const result=resultId?dialog.querySelector<HTMLElement>(`[data-league-result-id="${CSS.escape(resultId)}"]`):dialog
    const scores=result?.querySelector('details')
    if(scores&&scoresOpen!==undefined)scores.open=scoresOpen
    const resultHeading=resultId?result?.querySelector<HTMLElement>('.competition-opponents'):null
    if(resultHeading)resultHeading.tabIndex=-1
    const target=(result&&competitionScheduleJumpButton(result,id))??resultHeading??dialog.querySelector<HTMLElement>('[data-competition-content] h3')
    restoreListFocus(dialog,target,sourceScroll)
   },source==='results'?'Back to results':'Back to overview'))focus()
  })
  dialog.querySelectorAll<HTMLButtonElement>('[data-competition-league-entry]').forEach(b=>{b.onclick=()=>{
   const league=snapshot?.leagues[Number(b.dataset.competitionLeagueEntry)]
   if(scope==='mine'&&league)showEntry(league.id,{target:'league-entry',id:league.id,scroll:dialog.scrollTop})
  }})
  dialog.querySelector('[data-competition-entry]')?.addEventListener('click',()=>{
   if(selected)showEntry(selected,{target:'registration',scroll:dialog.scrollTop})
  })
  dialog.querySelector('[data-competition-decisions]')?.addEventListener('click',()=>{
   if(!canReviewEntries||!active()||busy||!selected||decisions?.isOpen())return
   const scroll=dialog.scrollTop
   decisions=openLeagueDecisions(client,owner,active,selected,()=>{
    decisions=null
    if(active())void load({target:'entry-requests',scroll})
   },send,'← League')
  })
  if(d)bindLeagueTeamActions(dialog,d,()=>active()&&!busy,team=>{
   if(teamEvidence?.isOpen())return;const scroll=dialog.scrollTop,id=d.league.id,chosenScope=scope,chosenQuery=query
   teamEvidence=openLeagueTeamEvidence(d,team,active,async valid=>{try{const result=await loadCompetitions(client,owner,()=>active()&&valid(),chosenScope,chosenQuery,id,send);if(!valid()||!result.detail)throw Error('League changed');snapshot=result;notice='';return result.detail}catch(error){if(valid()){snapshot=null;notice='Couldn’t refresh this league. Refresh to try again.'}throw error}},()=>{teamEvidence=null;if(active()){render();restoreLeagueTeamFocus(dialog,team,scroll)}},team.source==='standings'?'← Standings':'← Teams')
  })
  if(d)bindLeaguePlayerActions(dialog,d,()=>active()&&!busy,name=>{
   if(teamEvidence?.isOpen())return;const scroll=dialog.scrollTop,id=d.league.id,chosenScope=scope,chosenQuery=query
   teamEvidence=openLeaguePlayerEvidence(d,name,active,async valid=>{try{const result=await loadCompetitions(client,owner,()=>active()&&valid(),chosenScope,chosenQuery,id,send);if(!valid()||!result.detail)throw Error('League changed');snapshot=result;notice='';return result.detail}catch(error){if(valid()){snapshot=null;notice='Couldn’t refresh this league. Refresh to try again.'}throw error}},()=>{teamEvidence=null;if(active()){render();restoreLeaguePlayerFocus(dialog,name,scroll)}},'← Players')
  })
  if(firstPartyBuild&&!guest&&d?.league.format==='team'&&view==='fixtures'){
   const today=localCalendarDate()
   const fixtures=new Map(d.fixtures.filter(f=>courtAccountId(f.id)&&f.date<=today&&['confirmed','coordinator_set','completed'].includes(f.status)).map(f=>[f.id,f]))
   dialog.querySelectorAll<HTMLElement>('[data-competition-schedule-match]').forEach(card=>{
    const fixture=fixtures.get(card.dataset.competitionScheduleMatch||'')
    if(!fixture)return
    const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent='Open court scores'
    button.onclick=()=>{
     if(!active()||busy||courtDesk?.isOpen())return
     courtDesk=openCaptainCourtScores(client,owner,active,button,{league:d.league.id,fixture:fixture.id},openPersonal?seed=>{dispose();openPersonal(seed)}:undefined)
    }
    card.append(button)
   })
  }
  bindLeagueListFinder(dialog,()=>active()&&!busy,next=>{if(view!=='participants'&&view!=='standings')return;lists[view]=next;render();dialog.querySelector<HTMLElement>('[data-league-list-summary]')?.focus()})
  bindLeagueMatchFinder(dialog,()=>active()&&!busy,next=>{
   if(view!=='fixtures'&&view!=='results')return
   showFullSchedule=false
   filters[view]=next
   render();dialog.querySelector<HTMLElement>('[data-league-filter-summary]')?.focus()
  })
  dialog.querySelector('[data-competition-chats]')?.addEventListener('click',()=>{dispose();onChats?.()})
 }
 const load=async(returning?:ReturnPosition,fromSearch=false)=>{
  if(!active())return
  const attempt=++version;busy=true;snapshot=null;notice='Loading your competition records…';render()
  try{const result=await loadCompetitions(client,owner,()=>active()&&version===attempt,scope,query,selected,send);if(active()&&version===attempt){snapshot=result;notice=''}}
  catch{if(active()&&version===attempt)notice='Couldn’t load these competitions. Refresh to try again.'}
  finally{if(active()&&version===attempt){
   busy=false;render()
   const index=returning&&'id' in returning?snapshot?.leagues.findIndex(league=>league.id===returning.id)??-1:-1
   const leagueOpener=index>=0?dialog.querySelector<HTMLElement>('[data-competition-league="'+index+'"]'):null
   const opener=returning?.target==='entry-requests'?dialog.querySelector<HTMLElement>('[data-competition-decisions]'):
    returning?.target==='registration'?dialog.querySelector<HTMLElement>('[data-competition-entry]'):
    returning?.target==='league-entry'?dialog.querySelector<HTMLElement>('[data-competition-league-entry="'+index+'"]')||leagueOpener:leagueOpener
   if(notice)dialog.querySelector<HTMLElement>('[data-competition-notice]')?.focus()
   else if(opener&&returning)restoreListFocus(dialog,opener,returning.scroll)
   else if(calendarMatchId&&view==='fixtures'){
    if(calendarEntry?.fromUpdates){
     if(!focusCompetitionMatch(dialog,calendarMatchId,back,'Back to updates')){
      const notice=document.createElement('p')
      notice.className='rating-context';notice.tabIndex=-1;notice.textContent='This match is no longer in the published schedule.'
      dialog.querySelector('[data-competition-content]')?.prepend(notice);notice.focus()
     }
    }else if(calendarEntry)focusCalendarCompetitionMatch(dialog,calendarMatchId,dialog.querySelector('[data-competition-content] h3'),back)
    else{
     const card=dialog.querySelector<HTMLElement>(`[data-competition-schedule-match="${CSS.escape(calendarMatchId)}"]`)
     const heading=card?.querySelector<HTMLElement>('.competition-opponents')
     if(heading){heading.tabIndex=-1;heading.focus();card?.scrollIntoView({block:'start'})}
     else focus()
    }
    calendarMatchId=undefined
   }
   else{
    if(returning)dialog.scrollTop=0
    if(!fromSearch||!focusCompetitionSearchResults(dialog))focus()
   }
  }}
 }
 dialog.oncancel=e=>{e.preventDefault();back()};document.addEventListener('visibilitychange',hidden);document.body.append(dialog);dialog.showModal();void load()
 return {dispose,isOpen:()=>!disposed,back}
}
