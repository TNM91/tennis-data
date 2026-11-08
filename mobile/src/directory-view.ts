import {showPublicSignIn,type PublicBrowseAccess} from './public-browse-access'
import {directoryFollowItem} from './directory-follow-data'
import {showDirectoryFollow} from './directory-follow-control'
import {followedLeagueRows,type FollowedLeagueScope} from './followed-entities'
import type { SupabaseClient } from '@supabase/supabase-js'
import {showTeamRoster} from './team-roster-view'
import type { LeagueCard } from '../../lib/league-summary'
import { html } from './match-details'
import { matchDate } from './recent-results'
import { searchTeams, loadTeamRecords, loadLeagues, filterLeagues, type TeamChoice, type TeamRecord } from './directory-data'
import {showExploreSearchEmpty} from './explore-search-empty'
import {exploreResultCard} from './explore-result-card'
import {competitionOpponentsHtml} from './competition-match-card'

export type DirectoryMode = 'Teams'|'Leagues'
const count=(value:unknown)=>typeof value==='number' && Number.isFinite(value) && value>=0 ? String(Math.floor(value)) : 'Unavailable'
function directoryProfileHeader(label:string,title:string,context:string) {
  return `<header class="tab-hero directory-profile-header"><small class="stat-eyebrow">${html(label)}</small>
    <h1 tabindex="-1">${html(title)}</h1><p>${html(context)}</p></header>`
}
export function leagueDetails(row:LeagueCard) {
  const season=[row.season,row.year].filter(Boolean).join(' ')
  const context=[season,row.flight,row.districtArea,row.ustaSection].filter(Boolean).join(' · ')
  return `${directoryProfileHeader('League',row.leagueName,context || 'Season and area unavailable')}
    <section class="directory-profile-section" aria-labelledby="directory-season-title">
      <h2 id="directory-season-title">Season snapshot</h2>
      <dl class="directory-season-stats">
        <div><dt>Teams in directory</dt><dd>${count(row.teamCount)}</dd></div>
        <div><dt>Matches in summary</dt><dd>${count(row.matchCount)}</dd></div>
        <div><dt>Latest recorded match</dt><dd>${html(matchDate(row.latestMatchDate))}</dd></div>
      </dl>
      <p class="directory-profile-note">Counts cover the records available in the directory.</p>
    </section>`
}
function teamFixtures(rows:TeamRecord[]) {
  if(!rows.length)return '<p>No recorded fixtures are available for this team in this league and flight yet.</p>'
  return `<p class="directory-profile-note">${rows.length} ${rows.length===1?'fixture':'fixtures'} shown · newest first</p>
    <ol class="directory-fixtures" role="list">${rows.map(row=>{
    const score=row.score?.trim()
    return `<li class="competition-fixture">
      <div class="fixture-heading"><p>${html(matchDate(row.match_date))}</p><span class="competition-status">${html(row.status?.trim() || 'Status unavailable')}</span></div>
      ${competitionOpponentsHtml(row.home_team || 'Home team unavailable',row.away_team || 'Away team unavailable','h3')}
      ${score?`<dl class="competition-outcome"><div><dt>Recorded score</dt><dd>${html(score)}</dd></div></dl>`:'<p class="directory-score-note">Score not recorded</p>'}
    </li>`
  }).join('')}</ol>
    <p class="directory-profile-note">Scores follow the source’s court order. Records may include scheduled fixtures.</p>`
}
export function showDirectory(app:HTMLElement,mode:DirectoryMode,client:SupabaseClient,isCurrent:()=>boolean,initialTerm='',initial?:{team?:TeamChoice;league?:FollowedLeagueScope;back?:()=>void;backLabel?:string},access?:PublicBrowseAccess) {
  let disposed=false,request=0,selected=false,scroll=0
  let previousFocus:HTMLElement|null=null
  let roster:ReturnType<typeof showTeamRoster>|null=null
  const clearRoster=()=>{roster?.dispose();roster=null}
  const valid=()=>!disposed && isCurrent()
  app.innerHTML=`<div id="directory-search"><small>Tennis intelligence</small><h1 tabindex="-1">${mode}</h1><p>${mode==='Teams'?'Find a team and its recorded fixtures.':initial?.league?'Choose a season from this saved league context.':'Find leagues by name, flight, season, or area.'}</p><form><label>${mode==='Teams'?'Team name':initial?.league?'Filter saved league seasons':'League or area'}<input type="search" maxlength="80" ${mode==='Teams'?'minlength="2" required':''}></label><button>Search ${mode.toLowerCase()}</button></form><p role="status" id="directory-status">${mode==='Teams'?'Enter at least two characters of a team name.':''}</p><p role="alert" id="directory-error"></p><div id="directory-choices"></div></div><section id="directory-detail" hidden></section>`
  app.querySelector<HTMLElement>('h1')!.focus()
  const search=app.querySelector<HTMLElement>('#directory-search')!
  const form=search.querySelector<HTMLFormElement>('form')!
  const input=form.querySelector<HTMLInputElement>('input')!
  const button=form.querySelector<HTMLButtonElement>('button')!
  input.value=initialTerm
  const status=search.querySelector<HTMLElement>('#directory-status')!
  const error=search.querySelector<HTMLElement>('#directory-error')!
  const choices=search.querySelector<HTMLElement>('#directory-choices')!
  const detail=app.querySelector<HTMLElement>('#directory-detail')!
  const back=()=>{clearRoster();request++;selected=false;detail.hidden=true;detail.innerHTML='';search.hidden=false;window.scrollTo(0,scroll);previousFocus?.focus({preventScroll:true})}
  const open=(markup:string,trigger?:HTMLElement)=>{
    clearRoster();request++;selected=true;scroll=window.scrollY;previousFocus=trigger??null
    search.hidden=true;detail.hidden=false
    detail.innerHTML=`<button type="button" class="secondary" id="directory-back">Back to ${mode.toLowerCase()}</button>${markup}`
    detail.querySelector<HTMLButtonElement>('#directory-back')!.onclick=initial?.team&&initial.back?initial.back:back
    if(initial?.team&&initial.back)detail.querySelector<HTMLButtonElement>('#directory-back')!.textContent=initial.backLabel||'Back to following'
    window.scrollTo(0,0);detail.querySelector<HTMLElement>('h1')!.focus({preventScroll:true})
  }
  const openTeam=(team:TeamChoice,trigger?:HTMLElement)=>{
    if(!valid())return
    const context=`${team.league || 'League unavailable'} · ${team.flight || 'Flight unavailable'}`
    open(`${directoryProfileHeader(team.source==='observation'?'Public team listing':'Team',team.name,context)}
      <div id="team-follow-control"></div>
      <section class="directory-profile-section" aria-labelledby="directory-fixtures-title">
        <h2 id="directory-fixtures-title">Recorded fixtures</h2><div id="team-records" aria-live="polite"></div>
      </section><div id="team-roster-details"></div>`,trigger)
    const version=request,content=detail.querySelector<HTMLElement>('#team-records')!
    if(access)showPublicSignIn(detail.querySelector<HTMLElement>('#team-follow-control')!,access,()=>valid()&&selected&&request===version)
    const follow=directoryFollowItem(team);if(!access&&follow){const host=detail.querySelector<HTMLElement>('#team-follow-control')!;showDirectoryFollow(host,client,follow,()=>valid()&&selected&&request===version)}
    if(!access)roster=showTeamRoster(detail.querySelector<HTMLElement>('#team-roster-details')!,client,team,()=>valid()&&request===version)
    const load=async()=>{
      content.innerHTML='<p role="status">Loading team records…</p>'
      try {
        const loaded=await loadTeamRecords(client,team)
        const rows=initial?.team?loaded.filter(row=>!/\btiq\b/i.test([row.source,row.league_name].join(' '))):loaded
        if(!valid() || request!==version || !content.isConnected)return
        content.innerHTML=teamFixtures(rows)
      } catch {
        if(!valid() || request!==version || !content.isConnected)return
        content.innerHTML='<p role="alert">Can’t load team records. Check your connection and try again.</p><button type="button" class="secondary">Retry records</button>'
        content.querySelector<HTMLButtonElement>('button')!.onclick=()=>{void load()}
      }
    };void load()
  }
  const run=async()=>{
    if(!valid() || button.disabled)return
    const text=input.value.trim().replace(/\s+/g,' ')
    if(text.length>80 || (mode==='Teams' && text.length<2)){error.textContent='Use between 2 and 80 characters for a team search.';return}
    const version=++request;button.disabled=true;error.textContent='';choices.innerHTML='';status.textContent=`Loading ${mode.toLowerCase()}…`
    try {
      if(mode==='Teams') {
        const result=await searchTeams(client,text)
        if(!valid() || version!==request)return
        status.textContent=`${result.teams.length} team record${result.teams.length===1?'':'s'} found.${result.limited?' Showing a limited sample; add more of the name to narrow it.':''}${result.partial?' Some sources are unavailable; results may be incomplete.':''}`
        if(!result.teams.length){
          showExploreSearchEmpty(choices,input,status,{title:result.partial?'No teams in the available records':'No teams found',detail:'Try part of the team name used in the league schedule.'})
          return
        }
        choices.innerHTML=`<ul class="explore-result-list" role="list">${result.teams.map((team,index)=>exploreResultCard('team',index,{
          title:team.name,
          context:`${team.league || 'League unavailable'} · ${team.flight || 'Flight unavailable'}`,
        })).join('')}</ul>`
        choices.querySelectorAll<HTMLButtonElement>('[data-explore-result]').forEach(control=>{control.onclick=()=>openTeam(result.teams[Number(control.dataset.exploreResult)],control)})
      } else {
        const result=await loadLeagues()
        if(!valid() || version!==request)return
        const filtered=filterLeagues(initial?.league?followedLeagueRows(result.rows,initial.league):result.rows,text),rows=filtered.slice(0,12)
        status.textContent=`${filtered.length} league record${filtered.length===1?'':'s'} found. Showing ${rows.length}.${filtered.length>12?' Search a name, flight, or area to narrow the list.':''}${result.notice?' '+result.notice:''}`
        if(!rows.length){
          showExploreSearchEmpty(choices,input,status,{
            title:initial?.league?'No matching seasons':'No leagues found',
            detail:initial?.league?'Try another season or flight for this league.':'Try part of a league name, flight, or area.',
            reset:text?{label:initial?.league?'Show all seasons':'Show all leagues',search:()=>{void run()}}:undefined,
          })
          return
        }
        choices.innerHTML=`<ul class="explore-result-list" role="list">${rows.map((league,index)=>exploreResultCard('league',index,{
          title:league.leagueName,
          actionName:[league.leagueName,league.year,league.season,league.flight].filter(Boolean).join(' '),
          context:[league.year,league.season,league.flight,league.ustaSection,league.districtArea].filter(Boolean).join(' · ') || 'Area unavailable',
        })).join('')}</ul>`
        choices.querySelectorAll<HTMLButtonElement>('[data-explore-result]').forEach(control=>{control.onclick=()=>{if(valid()){const row=rows[Number(control.dataset.exploreResult)];open(leagueDetails(row),control);const follow=directoryFollowItem(row),version=request;if(access){const host=document.createElement('div');detail.append(host);showPublicSignIn(host,access,()=>valid()&&selected&&request===version)}else if(follow){const host=document.createElement('div');detail.append(host);showDirectoryFollow(host,client,follow,()=>valid()&&selected&&request===version)}}}})
      }
    } catch {
      if(!valid() || version!==request)return
      status.textContent='';error.textContent=`Can’t load ${mode.toLowerCase()}. Check your connection and search again.`
    } finally {if(valid() && version===request)button.disabled=false}
  }
  input.oninput=()=>{request++;button.disabled=false;choices.innerHTML='';status.textContent='';error.textContent=''}
  form.onsubmit=event=>{event.preventDefault();void run()}
  if(initial?.team)openTeam(initial.team)
  else if(mode==='Leagues'||initialTerm)void run()
  return {searchTerm:()=>input.value,dispose:()=>{disposed=true;request++;clearRoster()},back:()=>{if(roster?.back())return true;if(selected){if(initial?.team)return false;back();return true}return false}}
}
