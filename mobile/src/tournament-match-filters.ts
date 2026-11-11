import type {TournamentMatch} from '../../lib/native-tournaments-contract'
import {isValidCalendarDate} from '../../lib/calendar-date'
import {tournamentCourtLabel} from '../../lib/tournament-event-presentation'
import {competitionFiltersHtml} from './competition-filters'
import {html} from './match-details'

export type TournamentMatchFilters={query:string;day:string;court:string;round:string}
export type TournamentMatchView='draw'|'schedule'|'results'
export const emptyTournamentMatchFilters=():TournamentMatchFilters=>({query:'',day:'',court:'',round:''})
const shortDay=(value:string)=>isValidCalendarDate(value)?new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'}).format(new Date(value+'T12:00:00Z')):value
const normalized=(value:string)=>value.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase()
export {tournamentCourtLabel} from '../../lib/tournament-event-presentation'
export const tournamentScheduleDay=(match:TournamentMatch)=>isValidCalendarDate(match.date)?match.date:''
const publishedFirst=(a:string,b:string)=>Number(!a)-Number(!b)
export function tournamentScheduleTime(time:string) {
 const clock=/^([01]?\d|2[0-3]):([0-5]\d)$/.exec(time.trim())
 return clock?`${clock[1].padStart(2,'0')}:${clock[2]}`:''
}
export function tournamentViewMatches(matches:TournamentMatch[],view:TournamentMatchView){
 const rows=matches.filter(m=>view==='results'?!!m.winner:view==='schedule'?!!(m.time||m.court||tournamentScheduleDay(m)):true)
 if(view!=='schedule')return rows
 return rows.sort((a,b)=>{
  const dayA=tournamentScheduleDay(a),dayB=tournamentScheduleDay(b)
  const timeA=tournamentScheduleTime(a.time),timeB=tournamentScheduleTime(b.time)
  return publishedFirst(dayA,dayB)||dayA.localeCompare(dayB)
   ||publishedFirst(timeA,timeB)||timeA.localeCompare(timeB)
   ||publishedFirst(a.court,b.court)||tournamentCourtLabel(a.court).localeCompare(tournamentCourtLabel(b.court),'en-US',{numeric:true})
 })
}
export function tournamentEntrantMatches(matches:TournamentMatch[],name:string){
 return name?matches.filter(m=>m.a===name||m.b===name):[]
}
export const tournamentDrawRoundLabel=(match:TournamentMatch)=>match.label.trim()||'Round '+match.round
export function filterTournamentMatches(matches:TournamentMatch[],view:TournamentMatchView,filters:TournamentMatchFilters){
 const query=normalized(filters.query),court=tournamentCourtLabel(filters.court)
 return tournamentViewMatches(matches,view).filter(m=>{
  if(query&&!normalized(m.a).includes(query)&&!normalized(m.b).includes(query))return false
  if(view==='draw')return !filters.round||tournamentDrawRoundLabel(m)===filters.round
  if(view==='schedule')return (!filters.day||tournamentScheduleDay(m)===filters.day)&&(!court||tournamentCourtLabel(m.court)===court)
  return true
 })
}
function scheduleFields(matches:TournamentMatch[],filters:TournamentMatchFilters){
 const scheduled=tournamentViewMatches(matches,'schedule'),days=[...new Set(scheduled.map(tournamentScheduleDay).filter(Boolean))]
 const courtByLabel=new Map(scheduled.filter(m=>m.court).map(m=>[tournamentCourtLabel(m.court),m.court]))
 const selectedLabel=tournamentCourtLabel(filters.court)
 if(courtByLabel.has(selectedLabel))courtByLabel.set(selectedLabel,filters.court)
 const courts=[...courtByLabel.entries()].sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true})).map(([,value])=>value)
 const options=(values:string[],selected:string,date=false)=>'<option value="">'+(date?'All days':'All courts')+'</option>'+[...values,...(selected&&!values.includes(selected)?[selected]:[])].map(value=>'<option value="'+html(value)+'"'+(value===selected?' selected':'')+'>'+html(date?shortDay(value):tournamentCourtLabel(value))+(values.includes(value)?'':' — no longer scheduled')+'</option>').join('')
 return `<div class="tournament-schedule-filters"><label>Day<select name="day" aria-label="Match day">${options(days,filters.day,true)}</select></label><label>Court<select name="court" aria-label="Match court">${options(courts,filters.court)}</select></label></div>`
}
function drawRoundField(matches:TournamentMatch[],selected:string){
 const rounds=[...new Set(matches.map(tournamentDrawRoundLabel))]
 const options=rounds.map(round=>`<option value="${html(round)}"${round===selected?' selected':''}>${html(round)}</option>`)
 if(selected&&!rounds.includes(selected))options.push(`<option value="${html(selected)}" selected>${html(selected)} — no longer published</option>`)
 return `<label for="tournament-draw-round">Round</label><select id="tournament-draw-round" name="round"><option value="">All rounds</option>${options.join('')}</select>`
}
export function tournamentMatchFiltersHtml(matches:TournamentMatch[],view:TournamentMatchView,filters:TournamentMatchFilters,showClear=true){
 const scheduleView=view==='schedule'
 const activeCount=[normalized(filters.query),scheduleView?filters.day:'',scheduleView?filters.court:'',view==='draw'?filters.round:''].filter(Boolean).length
 const form=`<form class="tournament-match-filters" aria-label="Find matches">
  <label for="tournament-player-filter">Player or team name</label>
  <input id="tournament-player-filter" type="search" name="player" maxlength="160" value="${html(filters.query)}" placeholder="Find a player or team">
  ${scheduleView?scheduleFields(matches,filters):view==='draw'?drawRoundField(matches,filters.round):''}
  <div class="tournament-filter-actions"><button type="submit">Apply filters</button>${activeCount&&showClear?'<button type="button" class="secondary" data-competition-clear-match-filters>Clear filters</button>':''}</div>
 </form>`
 const summary=(filters.day||filters.court)&&scheduleView?'<p class="tournament-filter-summary">'+html([filters.day?'Day: '+shortDay(filters.day):'',tournamentCourtLabel(filters.court)].filter(Boolean).join(' · '))+'</p>':''
 return competitionFiltersHtml(view,form,activeCount)+summary
}
