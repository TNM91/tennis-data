import type {OfficeDetail,OfficeParticipant} from '../../lib/native-league-office-contract'
import type {TiqTeamStandingRow} from '../../lib/tiq-team-standings'
import {html} from './match-details'
import {leagueTeamOpenHtml} from './league-team-evidence'
import {leaguePlayerOpenHtml} from './league-player-evidence'

export type LeagueListFilters={query:string;status:string}
export const emptyLeagueListFilters=():LeagueListFilters=>({query:'',status:''})
export const emptyLeagueListFinder=()=>({participants:emptyLeagueListFilters(),standings:emptyLeagueListFilters()})
const normalized=(name:string)=>name.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase()
const statuses:Record<string,string>={active:'Approved',pending:'Pending',rejected:'Rejected',removed:'Removed'}
export function filterLeagueParticipants(rows:OfficeParticipant[],filters:LeagueListFilters,organizer:boolean){
 const query=normalized(filters.query)
 return rows.filter(p=>(organizer||p.status==='active')&&(!query||normalized(p.name).includes(query))&&(!organizer||!filters.status||p.status===filters.status))
}
export function filterLeagueStandings(rows:TiqTeamStandingRow[],filters:LeagueListFilters){const query=normalized(filters.query);return rows.map((row,index)=>({row,position:index+1})).filter(({row})=>!query||normalized(row.teamName).includes(query))}
function finderHtml(team:boolean,filters:LeagueListFilters,organizer:boolean){
 return '<form class="league-match-finder" data-league-list-finder aria-label="Find league entries"><label>'+ (team?'Team name':'Player name')+'<input type="search" name="query" maxlength="160" value="'+html(filters.query)+'" placeholder="Find a '+(team?'team':'player')+'"></label>'+(organizer?'<label>Entry status<select name="status"><option value="">All statuses</option>'+Object.entries(statuses).map(([value,label])=>'<option value="'+value+'"'+(filters.status===value?' selected':'')+'>'+label+'</option>').join('')+'</select></label>':'')+'<div class="league-finder-actions"><button type="submit">Find entries</button>'+((normalized(filters.query)||(organizer&&filters.status))?'<button type="button" class="secondary" data-league-list-clear>Clear entry filters</button>':'')+'</div></form>'
}
const summaryHtml=(shown:number,total:number,noun:string,limited:boolean)=>'<p class="league-finder-summary" tabindex="-1" role="status" data-league-list-summary>Showing '+shown+' of '+total+' loaded '+noun+'.'+(limited?' Filters search this sample only; more entries may be missing.':'')+'</p>'
const emptyHtml=(total:number,noun:string)=>'<div class="competition-empty"><h4>'+(total?'No '+noun+' fit these filters':'No '+noun+' saved yet')+'</h4><p>'+(total?'Try another name or clear the entry filters.':'Refresh to check for new entries.')+'</p></div>'
export function leagueParticipantsViewHtml(d:OfficeDetail,filters:LeagueListFilters=emptyLeagueListFilters(),organizer=false){
 const team=d.league.format==='team',all=filterLeagueParticipants(d.participants,emptyLeagueListFilters(),organizer),rows=filterLeagueParticipants(d.participants,filters,organizer),noun=organizer?'entry records':team?'teams':'players'
 return '<h3 tabindex="-1">'+(organizer?'Participants':team?'Teams':'Players')+'</h3><p class="league-finder-context">'+(organizer?'Entry records · approved, pending, rejected and removed entries stay separate.':'Approved entries. Pending and declined entries are not listed.')+(d.moreParticipants?' Showing the first 100 saved entries; more exist.':'')+'</p>'+finderHtml(team,filters,organizer)+summaryHtml(rows.length,all.length,noun,d.moreParticipants)+(rows.length?'<ul class="'+(organizer?'team-members':'competition-participants')+'">'+rows.map(p=>'<li><strong>'+html(p.name)+'</strong>'+(organizer?'<span>'+html(statuses[p.status]||p.status)+'</span>':'')+(p.status==='active'?(team?leagueTeamOpenHtml(d,p.name,'participants'):leaguePlayerOpenHtml(d,p.name)):'')+'</li>').join('')+'</ul>':emptyHtml(all.length,organizer?'entries':noun))
}
export function leagueStandingsViewHtml(d:OfficeDetail,filters:LeagueListFilters=emptyLeagueListFilters()){
 const heading='<h3 tabindex="-1">Team standings</h3>'
 if(d.league.format==='individual')return heading+'<p>This is an individual league. Open Results to review recorded player matches.</p>'
 if(!d.standingsAvailable||d.moreResults)return heading+'<p>Standings are withheld because this loaded result sample is incomplete. A partial sample cannot establish season standings.</p>'
 const rows=filterLeagueStandings(d.standings,filters)
 return heading+'<p class="league-finder-context">Recorded court results use this league’s website scoring and standings rules. Unplayed events do not count as wins, losses or ties.</p>'+finderHtml(true,filters,false)+summaryHtml(rows.length,d.standings.length,'teams',false)+(rows.length?'<ol class="team-members">'+rows.map(({row:p,position})=>'<li value="'+position+'"><strong>'+html(p.teamName)+'</strong><span>'+p.wins+' W · '+p.losses+' L · '+p.ties+' T<br>'+p.lineWins+' courts won · '+p.lineLosses+' lost · '+Number(p.points.toFixed(2))+' points</span>'+leagueTeamOpenHtml(d,p.teamName,'standings')+'</li>').join('')+'</ol>':emptyHtml(d.standings.length,'teams'))
}
export function bindLeagueListFinder(host:HTMLElement,active:()=>boolean,apply:(filters:LeagueListFilters)=>void){
 host.querySelector<HTMLFormElement>('[data-league-list-finder]')?.addEventListener('submit',event=>{event.preventDefault();if(!active())return;const form=new FormData(event.currentTarget as HTMLFormElement),status=String(form.get('status')||'');apply({query:String(form.get('query')||'').slice(0,160).trim(),status:Object.hasOwn(statuses,status)?status:''})})
 host.querySelector('[data-league-list-clear]')?.addEventListener('click',()=>{if(active())apply(emptyLeagueListFilters())})
}
