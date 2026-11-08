import type {TournamentMatch} from '../../lib/native-tournaments-contract'
import {html} from './match-details'

export type TournamentMatchFilters={query:string;day:string;court:string}
export type TournamentMatchView='draw'|'schedule'|'results'
export const emptyTournamentMatchFilters=():TournamentMatchFilters=>({query:'',day:'',court:''})
const shortDay=(value:string)=>{const date=new Date(value+'T12:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(date.getTime())?new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'}).format(date):value}
const normalized=(value:string)=>value.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase()
export function tournamentCourtLabel(court:string) {
 const label=court.trim()
 const identifier=/^(?:court\s+)?(\d+[A-Z]?|[A-Z])$/i.exec(label)
 return identifier?'Court '+identifier[1].toUpperCase():label
}
export function tournamentViewMatches(matches:TournamentMatch[],view:TournamentMatchView){
 const rows=matches.filter(m=>view==='results'?!!m.winner:view==='schedule'?!!(m.date||m.time||m.court):true)
 return view==='schedule'?rows.sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time)||a.court.localeCompare(b.court)):rows
}
export function tournamentEntrantMatches(matches:TournamentMatch[],name:string){
 return name?matches.filter(m=>m.a===name||m.b===name):[]
}
export function filterTournamentMatches(matches:TournamentMatch[],view:TournamentMatchView,filters:TournamentMatchFilters){
 const query=normalized(filters.query),court=tournamentCourtLabel(filters.court)
 return tournamentViewMatches(matches,view).filter(m=>(!query||normalized(m.a).includes(query)||normalized(m.b).includes(query))&&(view!=='schedule'||(!filters.day||m.date===filters.day)&&(!court||tournamentCourtLabel(m.court)===court)))
}
export function tournamentMatchFiltersHtml(matches:TournamentMatch[],view:TournamentMatchView,filters:TournamentMatchFilters){
 const scheduled=tournamentViewMatches(matches,'schedule'),days=[...new Set(scheduled.map(m=>m.date).filter(Boolean))].sort()
 const courtByLabel=new Map(scheduled.filter(m=>m.court).map(m=>[tournamentCourtLabel(m.court),m.court]))
 const selectedLabel=tournamentCourtLabel(filters.court)
 if(courtByLabel.has(selectedLabel))courtByLabel.set(selectedLabel,filters.court)
 const courts=[...courtByLabel.entries()].sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true})).map(([,value])=>value)
 const options=(values:string[],selected:string,date=false)=>'<option value="">'+(date?'All days':'All courts')+'</option>'+[...values,...(selected&&!values.includes(selected)?[selected]:[])].map(value=>'<option value="'+html(value)+'"'+(value===selected?' selected':'')+'>'+html(date?shortDay(value):tournamentCourtLabel(value))+(values.includes(value)?'':' — no longer scheduled')+'</option>').join('')
 return '<form class="tournament-match-filters" aria-label="Find matches"><label for="tournament-player-filter">Player or team name</label><input id="tournament-player-filter" type="search" name="player" maxlength="160" value="'+html(filters.query)+'" placeholder="Find a player or team">'+(view==='schedule'?'<div class="tournament-schedule-filters"><label>Day<select name="day" aria-label="Match day">'+options(days,filters.day,true)+'</select></label><label>Court<select name="court" aria-label="Match court">'+options(courts,filters.court)+'</select></label></div>':'')+'<div class="tournament-filter-actions"><button type="submit">Apply filters</button>'+((normalized(filters.query)||(view==='schedule'&&(filters.day||filters.court)))?'<button type="button" class="secondary" data-tournament-clear-filters>Clear filters</button>':'')+'</div></form>'+((filters.day||filters.court)&&view==='schedule'?'<p class="tournament-filter-summary">'+html([filters.day?'Day: '+shortDay(filters.day):'',tournamentCourtLabel(filters.court)].filter(Boolean).join(' · '))+'</p>':'')
}
