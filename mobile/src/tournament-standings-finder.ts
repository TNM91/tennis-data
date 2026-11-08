import type {TournamentDetail,TournamentStanding} from '../../lib/native-tournaments-contract'
import {html} from './match-details'
import {competitionFiltersHtml} from './competition-filters'
import {competitionStandingHtml} from './competition-standing'

export type TournamentStandingFilters={query:string;group:string|null}
export const emptyTournamentStandingFilters=():TournamentStandingFilters=>({query:'',group:null})
const normalized=(value:string)=>value.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase()
export function filterTournamentStandings(rows:TournamentStanding[],filters:TournamentStandingFilters){
 const query=normalized(filters.query)
 return rows.map((standing,index)=>({standing,index})).filter(({standing})=>(!query||normalized(standing.name).includes(query))&&(filters.group===null||standing.group===filters.group))
}
function finderHtml(standings:TournamentStanding[],filters:TournamentStandingFilters){
 const groups=[...new Set(standings.map(s=>s.group))],missing=filters.group!==null&&!groups.includes(filters.group),showGroups=groups.some(Boolean)||filters.group!==null
 const options='<option value="">All groups</option>'+[...groups,...(missing?[filters.group!]:[])].map(group=>'<option value="'+html(JSON.stringify(group))+'"'+(group===filters.group?' selected':'')+'>'+html(group||'No group')+(missing&&group===filters.group?' — no longer published':'')+'</option>').join('')
 return '<form class="league-match-finder" data-tournament-standings-finder aria-label="Find tournament entrants"><label>Entrant name<input type="search" name="query" maxlength="160" value="'+html(filters.query)+'" placeholder="Find a player or team"></label>'+(showGroups?'<label>Group<select name="group" aria-label="Standings group">'+options+'</select></label>':'')+'<div class="league-finder-actions"><button type="submit">Find entrants</button>'+((normalized(filters.query)||filters.group!==null)?'<button type="button" class="secondary" data-tournament-standings-clear>Clear entrant filters</button>':'')+'</div></form>'
}
export function tournamentStandingsHtml(d:TournamentDetail,filters:TournamentStandingFilters=emptyTournamentStandingFilters()){
 const heading='<h3 tabindex="-1">Standings</h3>'
 if(!d.active||d.drawNotice)return heading+'<p>'+html(d.drawNotice||'Choose a published division to see standings.')+'</p>'
 if(!d.standings.length&&!normalized(filters.query)&&filters.group===null)return heading+'<p>No standings are available for this draw format.</p>'
 const rows=filterTournamentStandings(d.standings,filters)
 const activeCount=Number(Boolean(normalized(filters.query)))+Number(filters.group!==null)
 const finder=competitionFiltersHtml('standings',finderHtml(d.standings,filters),activeCount)
 const standings=rows.map(({standing:s,index})=>competitionStandingHtml({
  kind:'tournament',position:index+1,name:s.name,group:s.group,record:`${s.wins} W · ${s.losses} L · ${s.played?s.winPct+'%':'—'}`,
  stats:`${s.gamesWon}–${s.gamesLost} games · ${s.gameDiff>0?'+':''}${s.gameDiff} differential`,
  actionAttributes:`data-tournament-entrant="${index}"`,
 })).join('')
 return heading+'<p class="league-finder-context">Tap an entry to see its matches. Set games exclude match-tiebreak points.</p>'+finder+'<p class="league-finder-summary" tabindex="-1" role="status" data-tournament-standings-status>Showing '+rows.length+' of '+d.standings.length+' published standings entries · selected division.</p>'+(standings?'<ol class="competition-standings tournament-standings" role="list">'+standings+'</ol>':'<div class="competition-empty"><h4>No entries fit these filters</h4><p>Try another name or group, or clear the entrant filters.</p></div>')
}
export function bindTournamentStandingsFinder(host:HTMLElement,active:()=>boolean,apply:(filters:TournamentStandingFilters)=>void){
 host.querySelector<HTMLFormElement>('[data-tournament-standings-finder]')?.addEventListener('submit',event=>{
  event.preventDefault();if(!active())return
  const form=new FormData(event.currentTarget as HTMLFormElement),value=String(form.get('group')||'');let group:string|null=null
  if(value){try{const parsed:unknown=JSON.parse(value);if(typeof parsed!=='string'||parsed.length>500)return;group=parsed}catch{return}}
  apply({query:String(form.get('query')||'').slice(0,160).trim(),group})
 })
 host.querySelector('[data-tournament-standings-clear]')?.addEventListener('click',()=>{if(active())apply(emptyTournamentStandingFilters())})
}
