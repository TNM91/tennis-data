import type {OfficeDetail,OfficeFixture,OfficeResult} from '../../lib/native-league-office-contract'
import {formatCalendarDay,isValidCalendarDate} from '../../lib/calendar-date'
import {formatCaptainPracticeTime} from '../../lib/captain-practice-invite'
import {competitionMatchGroupsHtml,competitionOpponentsHtml,competitionOutcomeHtml,competitionScheduleHtml} from './competition-match-card'
import {competitionFiltersHtml} from './competition-filters'
import {html} from './match-details'
import {matchDate} from './recent-results'

export type LeagueMatchView='fixtures'|'results'
export type LeagueMatchFilters={query:string;day:string;status:string}
export const emptyLeagueMatchFilters=():LeagueMatchFilters=>({query:'',day:'',status:''})
export const emptyLeagueFinder=()=>({fixtures:emptyLeagueMatchFilters(),results:emptyLeagueMatchFilters()})
const normalized=(value:string)=>value.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase()
const statuses:Record<string,string>={confirmed:'Confirmed',coordinator_set:'Set by coordinator',proposed:'Proposed',completed:'Completed',cancelled:'Cancelled'}
const matchesName=(query:string,a:string,b:string)=>normalized(a).includes(query)||normalized(b).includes(query)
function leagueFixtureDay(fixture:OfficeFixture){
 const date=fixture.date.slice(0,10)
 return (fixture.date.length===10||fixture.date[10]==='T')&&isValidCalendarDate(date)?date:''
}
const sortableTime=(time:string)=>time.trim().replace(/^(\d):/,'0$1:')
export function filterLeagueFixtures(rows:OfficeFixture[],filters:LeagueMatchFilters){
 const query=normalized(filters.query)
 return rows.filter(f=>(!query||matchesName(query,f.a,f.b))&&(!filters.day||leagueFixtureDay(f)===filters.day)&&(!filters.status||f.status===filters.status)).sort((a,b)=>{
  const dayA=leagueFixtureDay(a),dayB=leagueFixtureDay(b),timeA=sortableTime(a.time),timeB=sortableTime(b.time)
  return Number(!dayA)-Number(!dayB)||dayA.localeCompare(dayB)||Number(!timeA)-Number(!timeB)||timeA.localeCompare(timeB)||a.id.localeCompare(b.id)
 })
}
export function filterLeagueResults(rows:OfficeResult[],filters:LeagueMatchFilters){
 const query=normalized(filters.query)
 return rows.filter(r=>(!filters.day||r.date===filters.day)&&(!query||matchesName(query,r.a,r.b)||r.courts.some(c=>matchesName(query,c.a,c.b)))).sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id))
}
export function leagueFixtureHtml(f:OfficeFixture,view:'standalone'|'day-group'='standalone') {
 const savedTime=f.time.trim()
 const clock=/^((?:[01]?\d|2[0-3]):[0-5]\d)(?::00(?:\.0+)?)?$/.exec(savedTime)
 const time=clock?formatCaptainPracticeTime(clock[1]):savedTime
 const status=`<span class="competition-status" data-fixture-state="${html(f.status)}">${html(statuses[f.status]||f.status)}</span>`
 const grouped=view==='day-group'
 const schedule=competitionScheduleHtml(grouped?'':matchDate(f.date),time||'Time to be confirmed',f.facility||'Venue to be confirmed')
 if(grouped)return `<article class="competition-fixture competition-schedule-match">
  ${schedule}<div class="fixture-heading">${status}</div>
  ${competitionOpponentsHtml(f.a,f.b,'h5')}
 </article>`
 return `<article class="competition-fixture">
  ${status}${schedule}
  ${competitionOpponentsHtml(f.a,f.b)}
 </article>`
}
function finderHtml(d:OfficeDetail,view:LeagueMatchView,filters:LeagueMatchFilters){
 const days=[...new Set((view==='fixtures'?d.fixtures.map(leagueFixtureDay):d.results.map(r=>r.date)).filter(Boolean))].sort()
 const dayOptions='<option value="">All days</option>'+[...days,...(filters.day&&!days.includes(filters.day)?[filters.day]:[])].map(day=>'<option value="'+html(day)+'"'+(day===filters.day?' selected':'')+'>'+html(matchDate(day))+(days.includes(day)?'':' — no longer loaded')+'</option>').join('')
 const queryLabel=view==='results'?'Team or player name':d.league.format==='team'?'Team name':'Player name'
 const activeCount=[normalized(filters.query),filters.day,view==='fixtures'?filters.status:''].filter(Boolean).length
 const form='<form class="league-match-finder" data-league-match-finder aria-label="Find league matches"><label>'+queryLabel+'<input name="query" type="search" maxlength="160" value="'+html(filters.query)+'" placeholder="'+(view==='results'?'Team or player':'Find a '+(d.league.format==='team'?'team':'player'))+'"></label><div class="league-finder-selects"><label>Match day<select name="day">'+dayOptions+'</select></label>'+(view==='fixtures'?'<label>Schedule status<select name="status"><option value="">All statuses</option>'+Object.entries(statuses).map(([value,label])=>'<option value="'+value+'"'+(value===filters.status?' selected':'')+'>'+label+'</option>').join('')+'</select></label>':'')+'</div><div class="league-finder-actions"><button type="submit">Find matches</button>'+(activeCount?'<button type="button" class="secondary" data-league-clear-filters>Clear filters</button>':'')+'</div></form>'
 return competitionFiltersHtml(view==='fixtures'?'schedule':'results',form,activeCount)
}
const courtWinner=(c:OfficeResult['courts'][number])=>c.winner==='Side A'?(c.a||c.winner):c.winner==='Side B'?(c.b||c.winner):c.winner
export function leagueResultHtml(r:OfficeResult,team:boolean,query=''){
 const search=normalized(query),courtMatch=!!search&&r.courts.some(c=>matchesName(search,c.a,c.b))
 return `<article class="league-result-card">
  <p class="competition-date">${html(matchDate(r.date))} · ${team?'Team result':'Player result'}</p>
  ${competitionOutcomeHtml(team?'Team winner':'Winner',r.winner,r.score||undefined)}
  ${competitionOpponentsHtml(r.a,r.b)}
  ${r.courts.length?`<details${courtMatch?' open':''}>
   <summary>Court scores (${r.courts.length})</summary>
   ${r.courts.map(c=>`<div class="league-court-result${search&&matchesName(search,c.a,c.b)?' league-court-match':''}">
    <h5>${html(c.label)}</h5>
    <p>${html(c.a)} <span>vs</span> ${html(c.b)}</p>
    ${competitionOutcomeHtml('Court winner',courtWinner(c),c.score)}
   </div>`).join('')}
  </details>`:''}
 </article>`
}
export function leagueMatchViewHtml(d:OfficeDetail,view:LeagueMatchView,filters:LeagueMatchFilters=emptyLeagueMatchFilters()){
 const schedule=view==='fixtures',total=schedule?d.fixtures.length:d.results.length,limited=schedule?d.moreFixtures:d.moreResults
 const fixtures=schedule?filterLeagueFixtures(d.fixtures,filters):[]
 const results=schedule?[]:filterLeagueResults(d.results,filters)
 const count=fixtures.length+results.length
 const cards=schedule?competitionMatchGroupsHtml(fixtures,leagueFixtureDay,formatCalendarDay,f=>leagueFixtureHtml(f,'day-group')):results.map(r=>leagueResultHtml(r,d.league.format==='team',filters.query)).join('')
 const noun=schedule?'matches':d.league.format==='team'?'team results':'player results'
 return '<h3 tabindex="-1">'+(schedule?'Schedule':'Results')+'</h3><p class="league-finder-context">'+(schedule?'Times use '+html(d.league.timeZone)+'.'+(limited?' Latest 100 schedule entries. Earlier matches may be missing.':''):(limited?'Limited result/court sample; more records exist.':'Loaded recorded results, newest first.'))+'</p>'+finderHtml(d,view,filters)+'<p class="league-finder-summary" tabindex="-1" role="status" data-league-filter-summary>Showing '+count+' of '+total+' loaded '+noun+'.'+(limited?' Filters search this sample only.':'')+'</p>'+(count?cards:'<div class="competition-empty"><h4>'+(total?'No matches fit these filters':schedule?'No matches scheduled yet':'No results saved yet')+'</h4><p>'+(total?'Try another name, day or status, or clear the filters.':'Refresh to check for new season records.')+'</p></div>')
}
export function bindLeagueMatchFinder(host:HTMLElement,active:()=>boolean,apply:(filters:LeagueMatchFilters)=>void){
 host.querySelector<HTMLFormElement>('[data-league-match-finder]')?.addEventListener('submit',event=>{
  event.preventDefault();if(!active())return
  const form=new FormData(event.currentTarget as HTMLFormElement),status=String(form.get('status')||'')
  apply({query:String(form.get('query')||'').slice(0,160).trim(),day:String(form.get('day')||''),status:Object.hasOwn(statuses,status)?status:''})
 })
 host.querySelector('[data-league-clear-filters]')?.addEventListener('click',()=>{if(active())apply(emptyLeagueMatchFilters())})
}
