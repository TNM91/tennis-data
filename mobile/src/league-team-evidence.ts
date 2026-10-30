import type {OfficeDetail,OfficeFixture,OfficeResult} from '../../lib/native-league-office-contract'
import {leagueFixtureHtml,leagueResultHtml} from './league-match-finder'
import {html} from './match-details'

export type LeagueTeamSelection={name:string;source:'standings'|'participants'}
export function leagueTeamAvailable(d:OfficeDetail,team:LeagueTeamSelection){
 if(d.league.format!=='team'||!team.name)return false
 return team.source==='standings'?d.standingsAvailable&&!d.moreResults&&d.standings.filter(s=>s.teamName===team.name).length===1:d.participants.filter(p=>p.name===team.name&&p.status==='active').length===1
}
export function leagueTeamOpenHtml(d:OfficeDetail,name:string,source:LeagueTeamSelection['source']){
 return leagueTeamAvailable(d,{name,source})?'<button type="button" class="secondary league-team-open" data-league-team-name="'+html(name)+'" data-league-team-source="'+source+'">View matches<span class="sr-only"> for '+html(name)+'</span><span aria-hidden="true">↗</span></button>':''
}
export function leagueTeamRecords(d:OfficeDetail,name:string){
 return {fixtures:d.fixtures.filter(r=>r.a===name||r.b===name).sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time)||a.id.localeCompare(b.id)),results:d.results.filter(r=>r.a===name||r.b===name).sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id))}
}
export function leagueTeamDetailHtml(d:OfficeDetail,team:LeagueTeamSelection){
 if(!leagueTeamAvailable(d,team))return '<h3 tabindex="-1">Team unavailable</h3><p>This team entry is no longer available in the loaded '+(team.source==='standings'?'standings':'approved entries')+'. Return to the league to review current records.</p>'
 const standings=d.standingsAvailable&&!d.moreResults?d.standings.filter(s=>s.teamName===team.name):[],standing=standings.length===1?standings[0]:null,records=leagueTeamRecords(d,team.name)
 const section=(heading:string,rows:OfficeFixture[]|OfficeResult[],schedule:boolean)=>'<section class="league-team-section"><h4>'+heading+' · '+rows.length+'</h4>'+(rows.length?rows.map(r=>schedule?leagueFixtureHtml(r as OfficeFixture):leagueResultHtml(r as OfficeResult,true)).join(''):'<p>No '+(schedule?'scheduled dates':'results')+' for this exact team name in the loaded records.</p>')+'</section>'
 return '<div class="league-team-heading"><small>Team season</small><h3 tabindex="-1">'+html(team.name)+'</h3>'+(standing?'<div class="competition-metrics" aria-label="Saved team standings">'+[[standing.wins+'–'+standing.losses+'–'+standing.ties,'Team W–L–T'],[standing.lineWins+'–'+standing.lineLosses,'Courts W–L'],[String(Number(standing.points.toFixed(2))),'Points']].map(([value,label])=>'<div><strong>'+value+'</strong><span>'+label+'</span></div>').join('')+'</div><p>Season record from the league standings.</p>':'<p>A complete standings record is not available for this team.</p>')+'</div><p class="league-team-context">Matches recorded under this exact team name. Individual court scores stay inside each team result.</p><p class="league-team-context">Schedule times · '+html(d.league.timeZone)+'. Proposed and cancelled dates keep their recorded status.</p>'+(d.moreFixtures||d.moreResults?'<p class="league-team-context">'+(d.moreFixtures?'Schedule is limited to the latest 100 saved dates. ':'')+(d.moreResults?'Results and courts are a limited sample. ':'')+'Some matches may be missing.</p>':'')+section('Scheduled dates',records.fixtures,true)+section('Recorded team results',records.results,false)
}
export function bindLeagueTeamActions(host:HTMLElement,d:OfficeDetail,active:()=>boolean,open:(team:LeagueTeamSelection,trigger:HTMLButtonElement)=>void){
 host.querySelectorAll<HTMLButtonElement>('[data-league-team-name]').forEach(button=>{button.onclick=()=>{
  if(!active())return;const source=button.dataset.leagueTeamSource;if(source!=='standings'&&source!=='participants')return
  const team:LeagueTeamSelection={name:button.dataset.leagueTeamName||'',source};if(leagueTeamAvailable(d,team))open(team,button)
 }})
}
export function restoreLeagueTeamFocus(host:HTMLElement,team:LeagueTeamSelection,scroll:number){
 const button=[...host.querySelectorAll<HTMLElement>('[data-league-team-name]')].find(b=>b.dataset.leagueTeamName===team.name&&b.dataset.leagueTeamSource===team.source)
 const target=button||host.querySelector<HTMLElement>('h3,h2');target?.focus({preventScroll:true});host.scrollTop=scroll
}
export function openLeagueTeamEvidence(initial:OfficeDetail,selection:LeagueTeamSelection,current:()=>boolean,refresh:(valid:()=>boolean)=>Promise<OfficeDetail>,onClose:()=>void,backLabel:string){
 const dialog=document.createElement('dialog');dialog.className='captain-lineup-dialog competitions-dialog league-team-dialog';dialog.setAttribute('aria-label','Team season')
 const leagueId=initial.league.id,team={...selection};let detail:OfficeDetail|null=initial,disposed=false,busy=false,version=0,notice=''
 const active=()=>!disposed&&current(),dispose=()=>{if(disposed)return;disposed=true;version++;detail=null;document.removeEventListener('visibilitychange',hidden);dialog.remove();if(current())onClose()},hidden=()=>{if(document.visibilityState==='hidden')dispose()}
 const focus=()=>dialog.querySelector<HTMLElement>('[data-league-team-content] h3,[data-league-team-notice]')?.focus({preventScroll:true})
 const render=()=>{if(!active())return;dialog.innerHTML='<header class="competition-header"><button type="button" class="secondary" data-league-team-back>'+html(backLabel)+'</button><button type="button" class="secondary" data-league-team-refresh '+(busy?'disabled':'')+'>Refresh team</button></header>'+(detail?'<p class="league-team-context">'+html(detail.league.name)+'</p><div data-league-team-content>'+leagueTeamDetailHtml(detail,team)+'</div>':'')+'<p data-league-team-notice tabindex="-1" role="'+(notice&&!busy?'alert':'status')+'">'+html(notice)+'</p>';dialog.querySelector('[data-league-team-back]')?.addEventListener('click',dispose);dialog.querySelector('[data-league-team-refresh]')?.addEventListener('click',()=>{void load()})}
 const load=async()=>{if(!active()||busy)return;const attempt=++version,valid=()=>active()&&version===attempt;busy=true;detail=null;notice='Checking team records…';render();try{const result=await refresh(valid);if(valid()){if(result.league.id!==leagueId||result.league.format!=='team')throw Error('League changed');detail=result;notice=''}}catch{if(valid())notice='Couldn’t refresh this team. Try Refresh team again, or return to the league.'}finally{if(valid()){busy=false;render();focus()}}}
 dialog.oncancel=event=>{event.preventDefault();dispose()};document.addEventListener('visibilitychange',hidden);document.body.append(dialog);dialog.showModal();render();focus();return {dispose,isOpen:()=>!disposed,back:()=>{dispose();return true}}
}
