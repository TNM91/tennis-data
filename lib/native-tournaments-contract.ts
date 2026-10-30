import {normalizeTournamentEventDetails,type TournamentEventDetails} from './tournament-event-presentation'
export type TournamentSummary={id:string;parentId:string;isEvent:boolean;name:string;format:string;formatLabel:string;entrantType:'players'|'teams';status:'open'|'scheduled'|'completed';date:string;location:string;updatedAt:string;details:TournamentEventDetails;registrationClosed:boolean}
export type TournamentMatch={id:string;label:string;round:number;a:string;b:string;winner:string;score:string;date:string;time:string;court:string}
export type TournamentStanding={name:string;group:string;played:number;wins:number;losses:number;gamesWon:number;gamesLost:number;gameDiff:number;winPct:number}
export type TournamentDetail={root:TournamentSummary;divisions:TournamentSummary[];moreDivisions:boolean;active:TournamentSummary|null;entrants:number;drawNotice:string;matches:TournamentMatch[];standings:TournamentStanding[]}
export type TournamentSnapshot={owner:string;checkedAt:string;query:string;selected:string;division:string;tournaments:TournamentSummary[];more:boolean;detail:TournamentDetail|null}
export function tournamentInput(query='',selected='',division=''){
 if(query.length>80||[selected,division].some(v=>v.length>80||v&&!/^[a-zA-Z0-9_-]+$/.test(v))||division&&!selected)throw Error('Invalid tournament selection')
 return {query:query.trim().replace(/\s+/g,' '),selected,division}
}
const object=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Invalid tournament record');return v as Record<string,unknown>}
const str=(v:unknown,max=500)=>{if(typeof v!=='string'||v.length>max)throw Error('Invalid tournament text');return v}
const bool=(v:unknown)=>{if(typeof v!=='boolean')throw Error('Invalid tournament flag');return v}
const num=(v:unknown,min=0,max=10000)=>{if(typeof v!=='number'||!Number.isInteger(v)||v<min||v>max)throw Error('Invalid tournament total');return v}
const array=(v:unknown,max:number)=>{if(!Array.isArray(v)||v.length>max)throw Error('Incomplete tournament data');return v}
const unique=<T,>(rows:T[],key:(r:T)=>string)=>{if(new Set(rows.map(key)).size!==rows.length)throw Error('Ambiguous tournament records');return rows}
function summary(v:unknown):TournamentSummary{
 const r=object(v),id=str(r.id,80),parentId=str(r.parentId,80),entrantType=str(r.entrantType),status=str(r.status)
 if(!/^[a-zA-Z0-9_-]+$/.test(id)||parentId&&!/^[a-zA-Z0-9_-]+$/.test(parentId)||!['players','teams'].includes(entrantType)||!['open','scheduled','completed'].includes(status))throw Error('Invalid tournament context')
 const isEvent=bool(r.isEvent);if(isEvent&&parentId)throw Error('Invalid event nesting')
 return {id,parentId,isEvent,name:str(r.name),format:str(r.format,80),formatLabel:str(r.formatLabel),entrantType:entrantType as TournamentSummary['entrantType'],status:status as TournamentSummary['status'],date:str(r.date,10),location:str(r.location),updatedAt:str(r.updatedAt,80),details:normalizeTournamentEventDetails(object(r.details)),registrationClosed:bool(r.registrationClosed)}
}
export function readTournamentSnapshot(value:unknown,owner:string,query='',selected='',division=''):TournamentSnapshot{
 const r=object(value),input=tournamentInput(query,selected,division)
 if(r.ok!==true||r.owner!==owner||!owner||r.query!==input.query||r.selected!==selected||r.division!==division)throw Error('Tournament account or selection changed')
 const tournaments=unique(array(r.tournaments,20).map(summary),v=>v.id)
 if(tournaments.some(t=>t.parentId))throw Error('Unexpected child tournament')
 let detail:TournamentDetail|null=null
 if(selected){const d=object(r.detail),root=summary(d.root),divisions=unique(array(d.divisions,20).map(summary),v=>v.id),active=d.active===null?null:summary(d.active)
  if(root.id!==selected||root.parentId||tournaments.length!==1||tournaments[0].id!==selected||divisions.some(v=>v.parentId!==selected||v.isEvent)||!root.isEvent&&divisions.length||root.isEvent&&active?.id!==division&&!!active||division&&!active||!root.isEvent&&(!active||active.id!==selected||division)||active?.isEvent||active&&active.parentId!==(root.isEvent?selected:''))throw Error('Tournament selection changed')
  const matches=unique(array(d.matches,500).map(value=>{const m=object(value),a=str(m.a,256),b=str(m.b,256),winner=str(m.winner,256);if(winner&&winner!==a&&winner!==b)throw Error('Invalid tournament winner');return {id:str(m.id,120),label:str(m.label),round:num(m.round,1,100),a,b,winner,score:str(m.score),date:str(m.date,10),time:str(m.time,5),court:str(m.court,160)}}),m=>m.id)
  const standings=unique(array(d.standings,64).map(value=>{const s=object(value),played=num(s.played),wins=num(s.wins),losses=num(s.losses),gamesWon=num(s.gamesWon),gamesLost=num(s.gamesLost);if(wins+losses!==played||gamesWon-gamesLost!==s.gameDiff||s.winPct!==(played?Math.round(wins/played*100):0))throw Error('Invalid tournament standing');return {name:str(s.name,256),group:str(s.group),played,wins,losses,gamesWon,gamesLost,gameDiff:num(s.gameDiff,-10000),winPct:num(s.winPct,0,100)}}),s=>s.group+':'+s.name)
  const drawNotice=str(d.drawNotice);if((!active||drawNotice)&&(matches.length||standings.length))throw Error('Incomplete draw presented as complete')
  detail={root,divisions,active,matches,standings,drawNotice,entrants:num(d.entrants,0,64),moreDivisions:bool(d.moreDivisions)}
 }else if(r.detail!==null)throw Error('Unexpected tournament detail')
 const checkedAt=str(r.checkedAt,80);if(!Number.isFinite(Date.parse(checkedAt)))throw Error('Invalid tournament check time')
 return {owner,checkedAt,query:input.query,selected,division,tournaments,more:bool(r.more),detail}
}
