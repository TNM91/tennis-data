import type {OfficeDetail,OfficeFixture,OfficeResult} from '../../lib/native-league-office-contract'
import {html} from './match-details'
import {matchDate} from './recent-results'

export type LeagueMatchView='fixtures'|'results'
export type LeagueMatchFilters={query:string;day:string;status:string}
export const emptyLeagueMatchFilters=():LeagueMatchFilters=>({query:'',day:'',status:''})
export const emptyLeagueFinder=()=>({fixtures:emptyLeagueMatchFilters(),results:emptyLeagueMatchFilters()})
const normalized=(value:string)=>value.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase()
const statuses:Record<string,string>={confirmed:'Confirmed',coordinator_set:'Set by coordinator',proposed:'Proposed',completed:'Completed',cancelled:'Cancelled'}
const matchesName=(query:string,a:string,b:string)=>normalized(a).includes(query)||normalized(b).includes(query)
export function filterLeagueFixtures(rows:OfficeFixture[],filters:LeagueMatchFilters){
 const query=normalized(filters.query)
 return rows.filter(f=>(!query||matchesName(query,f.a,f.b))&&(!filters.day||f.date===filters.day)&&(!filters.status||f.status===filters.status)).sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time)||a.id.localeCompare(b.id))
}
export function filterLeagueResults(rows:OfficeResult[],filters:LeagueMatchFilters){
 const query=normalized(filters.query)
 return rows.filter(r=>(!filters.day||r.date===filters.day)&&(!query||matchesName(query,r.a,r.b)||r.courts.some(c=>matchesName(query,c.a,c.b)))).sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id))
}
export function leagueFixtureHtml(f:OfficeFixture){return '<article class="competition-fixture"><p class="competition-date">'+html(matchDate(f.date))+' · '+html(f.time||'Time to be confirmed')+'</p><h4>'+html(f.a)+' <span>vs</span> '+html(f.b)+'</h4><p>'+html(f.facility||'Venue to be confirmed')+'</p><span class="competition-status">'+html(statuses[f.status]||f.status)+'</span></article>'}
function finderHtml(d:OfficeDetail,view:LeagueMatchView,filters:LeagueMatchFilters){
 const days=[...new Set((view==='fixtures'?d.fixtures:d.results).map(r=>r.date).filter(Boolean))].sort()
 const dayOptions='<option value="">All days</option>'+[...days,...(filters.day&&!days.includes(filters.day)?[filters.day]:[])].map(day=>'<option value="'+html(day)+'"'+(day===filters.day?' selected':'')+'>'+html(matchDate(day))+(days.includes(day)?'':' — no longer loaded')+'</option>').join('')
 const queryLabel=view==='results'?'Team or player name':d.league.format==='team'?'Team name':'Player name'
 return '<form class="league-match-finder" data-league-match-finder aria-label="Find league matches"><label>'+queryLabel+'<input name="query" type="search" maxlength="160" value="'+html(filters.query)+'" placeholder="'+(view==='results'?'Search teams or recorded court players':'Find a '+(d.league.format==='team'?'team':'player'))+'"></label><div class="league-finder-selects"><label>Match day<select name="day">'+dayOptions+'</select></label>'+(view==='fixtures'?'<label>Schedule status<select name="status"><option value="">All statuses</option>'+Object.entries(statuses).map(([value,label])=>'<option value="'+value+'"'+(value===filters.status?' selected':'')+'>'+label+'</option>').join('')+'</select></label>':'')+'</div><div class="league-finder-actions"><button type="submit">Find matches</button>'+((normalized(filters.query)||filters.day||(view==='fixtures'&&filters.status))?'<button type="button" class="secondary" data-league-clear-filters>Clear filters</button>':'')+'</div></form>'
}
const courtWinner=(c:OfficeResult['courts'][number])=>c.winner==='Side A'?(c.a||c.winner):c.winner==='Side B'?(c.b||c.winner):(c.winner||'Not recorded')
function resultHtml(r:OfficeResult,team:boolean,query:string){
 const search=normalized(query),courtMatch=!!search&&r.courts.some(c=>matchesName(search,c.a,c.b))
 return '<article class="league-result-card"><p class="competition-date">'+html(matchDate(r.date))+' · '+(team?'Team result':'Player result')+'</p><h4>'+html(r.a)+' <span>vs</span> '+html(r.b)+'</h4><p>'+html(r.winner?(team?'Team winner: ':'Recorded winner: ')+r.winner:'Winner not recorded')+'</p>'+(r.score?'<p class="league-result-score">'+html(r.score)+'</p>':'')+(r.courts.length?'<details'+(courtMatch?' open':'')+'><summary>Recorded courts ('+r.courts.length+')</summary>'+r.courts.map(c=>'<div class="league-court-result'+(search&&matchesName(search,c.a,c.b)?' league-court-match':'')+'"><strong>'+html(c.label)+'</strong><p>'+html(c.a)+' <span>vs</span> '+html(c.b)+'</p><p class="league-result-score">'+html(c.score||'Score not recorded')+'</p><p>Court winner: '+html(courtWinner(c))+'</p></div>').join('')+'</details>':'')+'</article>'
}
export function leagueMatchViewHtml(d:OfficeDetail,view:LeagueMatchView,filters:LeagueMatchFilters=emptyLeagueMatchFilters()){
 const schedule=view==='fixtures',rows=schedule?filterLeagueFixtures(d.fixtures,filters):filterLeagueResults(d.results,filters),total=schedule?d.fixtures.length:d.results.length,limited=schedule?d.moreFixtures:d.moreResults
 const noun=schedule?'dates':d.league.format==='team'?'team results':'player results'
 return '<h3 tabindex="-1">'+(schedule?'Schedule':'Results')+'</h3><p class="league-finder-context">'+(schedule?'Times use '+html(d.league.timeZone)+'. '+(limited?'Latest 100 saved dates; earlier dates may be missing.':'Loaded season dates, ordered by date.'):(limited?'Limited result/court sample; more records exist.':'Loaded recorded results, newest first.'))+'</p>'+finderHtml(d,view,filters)+'<p class="league-finder-summary" tabindex="-1" role="status" data-league-filter-summary>Showing '+rows.length+' of '+total+' loaded '+noun+'.'+(limited?' Filters search this sample only.':'')+'</p>'+(!schedule&&d.league.format==='team'?'<p class="league-finder-context">Team outcomes and individual court scores are shown separately. A team win is not an individual player win.</p>':'')+(rows.length?rows.map(r=>schedule?leagueFixtureHtml(r as OfficeFixture):resultHtml(r as OfficeResult,d.league.format==='team',filters.query)).join(''):'<div class="competition-empty"><h4>'+(total?'No matches fit these filters':schedule?'No dates saved yet':'No results saved yet')+'</h4><p>'+(total?'Try another name, day or status, or clear the filters.':'Refresh to check for new season records.')+'</p></div>')
}
export function bindLeagueMatchFinder(host:HTMLElement,active:()=>boolean,apply:(filters:LeagueMatchFilters)=>void){
 host.querySelector<HTMLFormElement>('[data-league-match-finder]')?.addEventListener('submit',event=>{
  event.preventDefault();if(!active())return
  const form=new FormData(event.currentTarget as HTMLFormElement),status=String(form.get('status')||'')
  apply({query:String(form.get('query')||'').slice(0,160).trim(),day:String(form.get('day')||''),status:Object.hasOwn(statuses,status)?status:''})
 })
 host.querySelector('[data-league-clear-filters]')?.addEventListener('click',()=>{if(active())apply(emptyLeagueMatchFilters())})
}
