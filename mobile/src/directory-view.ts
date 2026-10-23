import type { SupabaseClient } from '@supabase/supabase-js'
import type { LeagueCard } from '../../lib/league-summary'
import { html } from './match-details'
import { matchDate } from './recent-results'
import { searchTeams, loadTeamRecords, loadLeagues, filterLeagues, type TeamChoice } from './directory-data'

export type DirectoryMode = 'Teams'|'Leagues'
const count=(value:unknown)=>typeof value==='number' && Number.isFinite(value) && value>=0 ? String(Math.floor(value)) : 'Unavailable'
export function leagueDetails(row:LeagueCard) {
  return `<h1 tabindex="-1">${html(row.leagueName)}</h1><p>${[row.flight,row.ustaSection,row.districtArea].filter(Boolean).map(html).join(' · ') || 'Area unavailable'}</p><dl><dt>Season</dt><dd>${html([row.year,row.season].filter(Boolean).join(' ') || 'Unavailable')}</dd><dt>Teams in directory</dt><dd>${count(row.teamCount)}</dd><dt>Matches in summary</dt><dd>${count(row.matchCount)}</dd><dt>Latest recorded match</dt><dd>${html(matchDate(row.latestMatchDate))}</dd></dl><p>Counts reflect the available directory summary, not a complete season record.</p>`
}
export function showDirectory(app:HTMLElement,mode:DirectoryMode,client:SupabaseClient,isCurrent:()=>boolean) {
  let disposed=false,request=0,selected=false,scroll=0
  let previousFocus:HTMLElement|null=null
  const valid=()=>!disposed && isCurrent()
  app.innerHTML=`<div id="directory-search"><small>Tennis intelligence</small><h1 tabindex="-1">${mode}</h1><p>${mode==='Teams'?'Find a team and its recorded fixtures.':'Find leagues by name, flight, season, or area.'}</p><form><label>${mode==='Teams'?'Team name':'League or area'}<input type="search" maxlength="80" ${mode==='Teams'?'minlength="2" required':''}></label><button>Search ${mode.toLowerCase()}</button></form><p role="status" id="directory-status">${mode==='Teams'?'Enter at least two characters of a team name.':''}</p><p role="alert" id="directory-error"></p><div id="directory-choices"></div></div><section id="directory-detail" hidden></section>`
  app.querySelector<HTMLElement>('h1')!.focus()
  const search=app.querySelector<HTMLElement>('#directory-search')!
  const form=search.querySelector<HTMLFormElement>('form')!
  const input=form.querySelector<HTMLInputElement>('input')!
  const button=form.querySelector<HTMLButtonElement>('button')!
  const status=search.querySelector<HTMLElement>('#directory-status')!
  const error=search.querySelector<HTMLElement>('#directory-error')!
  const choices=search.querySelector<HTMLElement>('#directory-choices')!
  const detail=app.querySelector<HTMLElement>('#directory-detail')!
  const back=()=>{request++;selected=false;detail.hidden=true;detail.innerHTML='';search.hidden=false;window.scrollTo(0,scroll);previousFocus?.focus({preventScroll:true})}
  const open=(markup:string)=>{
    request++;selected=true;scroll=window.scrollY;previousFocus=document.activeElement as HTMLElement|null
    search.hidden=true;detail.hidden=false
    detail.innerHTML=`<button type="button" class="secondary" id="directory-back">Back to ${mode.toLowerCase()}</button>${markup}`
    detail.querySelector<HTMLButtonElement>('#directory-back')!.onclick=back
    window.scrollTo(0,0);detail.querySelector<HTMLElement>('h1')!.focus({preventScroll:true})
  }
  const openTeam=(team:TeamChoice)=>{
    if(!valid())return
    open(`<h1 tabindex="-1">${html(team.name)}</h1><p>${html(team.league || 'League unavailable')} · ${html(team.flight || 'Flight unavailable')}</p><p>${team.source==='observation'?'Public source observation':'Recorded team context'}</p><h2>Recorded fixtures</h2><div id="team-records" aria-live="polite"></div>`)
    const version=request,content=detail.querySelector<HTMLElement>('#team-records')!
    const load=async()=>{
      content.innerHTML='<p role="status">Loading team records…</p>'
      try {
        const rows=await loadTeamRecords(client,team)
        if(!valid() || request!==version || !content.isConnected)return
        content.innerHTML=rows.length?`<p>Showing up to 10 records for this team, league, and flight.</p><ol class="matches">${rows.map(row=>`<li><div class="match-heading"><strong>${html(row.home_team || 'Home team unavailable')}</strong><span>${html(matchDate(row.match_date))}</span></div><p>vs ${html(row.away_team || 'Away team unavailable')}</p><p class="score">${html(row.score || 'Score not recorded')}</p><p>${html(row.status || 'Status unavailable')}</p></li>`).join('')}</ol><small>Scores follow the source’s court order. Records may include scheduled fixtures.</small>`:'<p>No recorded fixtures are available for this team in this league and flight yet.</p>'
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
        choices.innerHTML=result.teams.length?`<ul class="player-choices">${result.teams.map((team,index)=>`<li><h2>${html(team.name)}</h2><p>${html(team.league || 'League unavailable')} · ${html(team.flight || 'Flight unavailable')}</p><button type="button" class="secondary" data-choice="${index}">View team<span class="sr-only"> ${html(team.name)}</span></button></li>`).join('')}</ul>`:'<p>No teams found. Try the team name used in your league schedule.</p>'
        choices.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach(control=>{control.onclick=()=>openTeam(result.teams[Number(control.dataset.choice)])})
      } else {
        const result=await loadLeagues()
        if(!valid() || version!==request)return
        const filtered=filterLeagues(result.rows,text),rows=filtered.slice(0,12)
        status.textContent=`${filtered.length} league record${filtered.length===1?'':'s'} found. Showing ${rows.length}.${filtered.length>12?' Search a name, flight, or area to narrow the list.':''}${result.notice?' '+result.notice:''}`
        choices.innerHTML=rows.length?`<ul class="player-choices">${rows.map((league,index)=>`<li><h2>${html(league.leagueName)}</h2><p>${[league.flight,league.ustaSection,league.districtArea].filter(Boolean).map(html).join(' · ') || 'Area unavailable'}</p><button type="button" class="secondary" data-choice="${index}">View league<span class="sr-only"> ${html(league.leagueName)}</span></button></li>`).join('')}</ul>`:'<p>No leagues found. Try another name or area.</p>'
        choices.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach(control=>{control.onclick=()=>{if(valid())open(leagueDetails(rows[Number(control.dataset.choice)]))}})
      }
    } catch {
      if(!valid() || version!==request)return
      status.textContent='';error.textContent=`Can’t load ${mode.toLowerCase()}. Check your connection and search again.`
    } finally {if(valid() && version===request)button.disabled=false}
  }
  input.oninput=()=>{request++;button.disabled=false;choices.innerHTML='';status.textContent='';error.textContent=''}
  form.onsubmit=event=>{event.preventDefault();void run()}
  if(mode==='Leagues')void run()
  return {dispose:()=>{disposed=true;request++},back:()=>{if(selected){back();return true}return false}}
}
