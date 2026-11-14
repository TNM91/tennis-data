import type {OfficeDetail,OfficeFixture,OfficeResult} from '../../lib/native-league-office-contract'
import {formatCalendarDay,isValidCalendarDate} from '../../lib/calendar-date'
import {formatCaptainPracticeTime} from '../../lib/captain-practice-invite'
import {competitionMatchGroupsHtml,competitionOpponentsHtml,competitionOutcomeHtml,competitionScheduleClock,competitionScheduleHtml,competitionScheduleJumpHtml} from './competition-match-card'
import {competitionFiltersHtml,competitionMatchFilterEmptyHtml} from './competition-filters'
import {html} from './match-details'
import {matchDate} from './recent-results'

export type LeagueMatchView='fixtures'|'results'
export type LeagueMatchFilters={query:string;day:string;status:string}
export const emptyLeagueMatchFilters=():LeagueMatchFilters=>({query:'',day:'',status:''})
export const emptyLeagueFinder=()=>({fixtures:emptyLeagueMatchFilters(),results:emptyLeagueMatchFilters()})
const normalized=(value:string)=>value.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase()
const statuses:Record<string,string>={confirmed:'Confirmed',coordinator_set:'Set by coordinator',proposed:'Proposed',completed:'Completed',cancelled:'Cancelled',postponed:'New date pending'}
const matchesName=(query:string,a:string,b:string)=>normalized(a).includes(query)||normalized(b).includes(query)
export function leagueFixtureDay(fixture:OfficeFixture){
 if(fixture.status==='postponed')return ''
 const date=fixture.date.slice(0,10)
 return (fixture.date.length===10||fixture.date[10]==='T')&&isValidCalendarDate(date)?date:''
}
const sortableTime=(time:string)=>time.trim().replace(/^(\d):/,'0$1:')
const fixtureClock=(time:string)=>/^((?:[01]?\d|2[0-3]):[0-5]\d)(?::00(?:\.0+)?)?$/.exec(time.trim())?.[1]
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

function nextLeagueMeetings(d:OfficeDetail,results:OfficeResult[]){
 const meetings=new Map<string,OfficeFixture>()
 if(!results.length||d.league.status!=='active'||d.moreFixtures||d.moreParticipants)return meetings
 let now:ReturnType<typeof competitionScheduleClock>
 try{now=competitionScheduleClock(d.league.timeZone)}catch{return meetings}
 const upcoming=filterLeagueFixtures(d.fixtures,emptyLeagueMatchFilters()).filter(f=>{
  if(f.status!=='confirmed'&&f.status!=='coordinator_set')return false
  const day=leagueFixtureDay(f),time=fixtureClock(f.time)
  return day>now.day||day===now.day&&!!time&&sortableTime(time)>=now.time
 })
 const activeNames=new Map<string,number>()
 for(const p of d.participants)if(p.status==='active')activeNames.set(p.name,(activeNames.get(p.name)||0)+1)
 for(const {id,date,a,b} of results){
  if(!isValidCalendarDate(date)||!a||!b||a===b||activeNames.get(a)!==1||activeNames.get(b)!==1)continue
  const meeting=upcoming.find(f=>leagueFixtureDay(f)>date&&((f.a===a&&f.b===b)||(f.a===b&&f.b===a)))
  if(meeting)meetings.set(id,meeting)
 }
 return meetings
}

export function leagueFixtureHtml(f:OfficeFixture,view:'standalone'|'day-group'|'preview'='standalone') {
 const savedTime=f.time.trim()
 const clock=fixtureClock(savedTime)
 const time=clock?formatCaptainPracticeTime(clock):savedTime
 const status=`<span class="competition-status" data-fixture-state="${html(f.status)}">${html(statuses[f.status]||f.status)}</span>`
 const grouped=view==='day-group'
 const schedule=f.status==='postponed'?'':competitionScheduleHtml(grouped?'':matchDate(f.date),time||'Time to be confirmed',f.facility||'Venue to be confirmed')
 if(grouped)return `<article class="competition-fixture competition-schedule-match" data-competition-schedule-match="${html(f.id)}">
  ${schedule}<div class="fixture-heading">${status}</div>
  ${competitionOpponentsHtml(f.a,f.b,'h5')}
 </article>`
 return `<article class="competition-fixture">
  ${status}${schedule}
  ${competitionOpponentsHtml(f.a,f.b)}
  ${view==='preview'?competitionScheduleJumpHtml(f.id,`${f.a} vs ${f.b}, ${matchDate(f.date)}`):''}
 </article>`
}
function finderHtml(d:OfficeDetail,view:LeagueMatchView,filters:LeagueMatchFilters,showClear:boolean){
 const days=[...new Set((view==='fixtures'?d.fixtures.map(leagueFixtureDay):d.results.map(r=>r.date)).filter(Boolean))].sort()
 const dayOptions='<option value="">All days</option>'+[...days,...(filters.day&&!days.includes(filters.day)?[filters.day]:[])].map(day=>'<option value="'+html(day)+'"'+(day===filters.day?' selected':'')+'>'+html(matchDate(day))+(days.includes(day)?'':' — no longer loaded')+'</option>').join('')
 const queryLabel=view==='results'?'Team or player name':d.league.format==='team'?'Team name':'Player name'
 const activeCount=[normalized(filters.query),filters.day,view==='fixtures'?filters.status:''].filter(Boolean).length
 const form='<form class="league-match-finder" data-league-match-finder aria-label="Find league matches"><label>'+queryLabel+'<input name="query" type="search" maxlength="160" value="'+html(filters.query)+'" placeholder="'+(view==='results'?'Team or player':'Find a '+(d.league.format==='team'?'team':'player'))+'"></label><div class="league-finder-selects"><label>Match day<select name="day">'+dayOptions+'</select></label>'+(view==='fixtures'?'<label>Schedule status<select name="status"><option value="">All statuses</option>'+Object.entries(statuses).map(([value,label])=>'<option value="'+value+'"'+(value===filters.status?' selected':'')+'>'+label+'</option>').join('')+'</select></label>':'')+'</div><div class="league-finder-actions"><button type="submit">Find matches</button>'+(activeCount&&showClear?'<button type="button" class="secondary" data-competition-clear-match-filters>Clear filters</button>':'')+'</div></form>'
 return competitionFiltersHtml(view==='fixtures'?'schedule':'results',form,activeCount)
}
const courtWinner=(c:OfficeResult['courts'][number])=>c.winner==='Side A'?(c.a||c.winner):c.winner==='Side B'?(c.b||c.winner):c.winner
export function leagueResultHtml(r:OfficeResult,team:boolean,query='',meeting?:OfficeFixture,openCourts=false){
 const search=normalized(query),courtMatch=!!search&&r.courts.some(c=>matchesName(search,c.a,c.b))
 const winsA=r.courts.filter(c=>c.winner==='Side A').length,winsB=r.courts.filter(c=>c.winner==='Side B').length
 const tie=team&&!r.winner&&winsA>0&&winsA===winsB
 return `<article class="league-result-card" data-league-result-id="${html(r.id)}">
  <p class="competition-date">${html(matchDate(r.date))} · ${team?'Team result':'Player result'}</p>
  ${competitionOutcomeHtml(tie?'Match result':team?'Team winner':'Winner',tie?'Tie':r.winner,r.score||undefined)}
  ${competitionOpponentsHtml(r.a,r.b)}
  ${r.courts.length?`<details${courtMatch||openCourts?' open':''}>
   <summary>Court scores (${r.courts.length})</summary>
   ${r.courts.map(c=>`<div class="league-court-result${search&&matchesName(search,c.a,c.b)?' league-court-match':''}">
    <h5>${html(c.label)}</h5>
    <p>${html(c.a||r.a)} <span>vs</span> ${html(c.b||r.b)}</p>
    ${competitionOutcomeHtml('Court winner',courtWinner({...c,a:c.a||r.a,b:c.b||r.b}),c.score)}
   </div>`).join('')}
  </details>`:''}
  ${meeting?competitionScheduleJumpHtml(meeting.id,`${r.a} vs ${r.b}`,'Next meeting',matchDate(meeting.date)):''}
 </article>`
}
export function leagueMatchViewHtml(d:OfficeDetail,view:LeagueMatchView,filters:LeagueMatchFilters=emptyLeagueMatchFilters(),showNextMeeting=false){
 const schedule=view==='fixtures',total=schedule?d.fixtures.length:d.results.length,limited=schedule?d.moreFixtures:d.moreResults
 const fixtures=schedule?filterLeagueFixtures(d.fixtures,filters):[]
 const results=schedule?[]:filterLeagueResults(d.results,filters)
 const count=fixtures.length+results.length
 const meetings=showNextMeeting?nextLeagueMeetings(d,results):undefined
 const cards=schedule?competitionMatchGroupsHtml(fixtures,fixture=>fixture.status==='postponed'?'postponed':leagueFixtureDay(fixture),
  day=>day==='postponed'?'Awaiting a new date':formatCalendarDay(day),f=>leagueFixtureHtml(f,'day-group')):results.map(r=>leagueResultHtml(r,d.league.format==='team',filters.query,meetings?.get(r.id))).join('')
 const noun=schedule?'matches':d.league.format==='team'?'team results':'player results'
 const empty=total
  ? competitionMatchFilterEmptyHtml(schedule?'schedule':'results')
  : `<div class="competition-empty"><h4>${schedule?'No matches scheduled yet':'No results saved yet'}</h4><p>Refresh to check for new season records.</p></div>`
 return '<h3 tabindex="-1">'+(schedule?'Schedule':'Results')+'</h3><p class="league-finder-context">'+(schedule?'Times use '+html(d.league.timeZone)+'.'+(limited?' Latest 100 schedule entries. Earlier matches may be missing.':''):(limited?'Limited result/court sample; more records exist.':'Loaded recorded results, newest first.'))+'</p>'+finderHtml(d,view,filters,count>0||total===0)+'<p class="league-finder-summary" tabindex="-1" role="status" data-league-filter-summary>Showing '+count+' of '+total+' loaded '+noun+'.'+(limited?' Filters search this sample only.':'')+'</p>'+(count?cards:empty)
}
export function bindLeagueMatchFinder(host:HTMLElement,active:()=>boolean,apply:(filters:LeagueMatchFilters)=>void){
 host.querySelector<HTMLFormElement>('[data-league-match-finder]')?.addEventListener('submit',event=>{
  event.preventDefault();if(!active())return
  const form=new FormData(event.currentTarget as HTMLFormElement),status=String(form.get('status')||'')
  apply({query:String(form.get('query')||'').slice(0,160).trim(),day:String(form.get('day')||''),status:Object.hasOwn(statuses,status)?status:''})
 })
 host.querySelector('[data-competition-clear-match-filters]')?.addEventListener('click',()=>{if(active())apply(emptyLeagueMatchFilters())})
}
