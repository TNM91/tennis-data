import type {TeamRoomScope} from './team-room'
import {fixtureDate,fixtureId} from './team-fixtures-contract'
import {buildOpponentSeasonScout} from './captain-opponent-season-scout'
import {isPublicTeamDirectoryMatch} from './team-directory-rules'
type Input=Parameters<typeof buildOpponentSeasonScout>[0]
export type CourtScoutRecords=Pick<Input,'matches'|'links'|'players'|'slots'>
export type CourtScoutContext={owner:string;scope:TeamRoomScope;match:{id:string;date:string;opponent:string};before:string;from:string;checkedAt:string;limited:boolean;records:CourtScoutRecords}
const object=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Court records unavailable.');return v as Record<string,unknown>}
const text=(v:unknown,max:number,optional=false)=>{if(optional&&v==null)return null;if(typeof v!=='string'||v.length>max||!optional&&!v.trim())throw Error('Court records unavailable.');return v as string}
const array=(v:unknown,max:number)=>{if(!Array.isArray(v)||v.length>max)throw Error('Court records unavailable.');return v}
export function readCourtScoutRecords(value:unknown,scope:TeamRoomScope,opponent:string,from:string,before:string):CourtScoutRecords{
 const r=object(value),matches=array(r.matches,160).map(v=>{const m=object(v);if(!fixtureId(m.id)||!fixtureDate(m.match_date)||m.match_date<from||m.match_date>=before||m.league_name!==scope.leagueName||(m.flight||'')!==scope.flight||m.home_team===m.away_team||Number(m.home_team===opponent)+Number(m.away_team===opponent)!==1||typeof m.line_number!=='string'||!/^([1-9]|[12][0-9]|30)$/.test(m.line_number)||m.winner_side!=null&&!['A','B'].includes(String(m.winner_side)))throw Error('Court scope changed.');const row={id:m.id,match_date:m.match_date,league_name:scope.leagueName,flight:scope.flight,home_team:text(m.home_team,160)!,away_team:text(m.away_team,160)!,line_number:m.line_number,match_type:text(m.match_type,80,true),winner_side:(m.winner_side||null) as 'A'|'B'|null,score:text(m.score,240,true),source:text(m.source,120,true),match_time:text(m.match_time,40,true),facility:text(m.facility,240,true)};if(!isPublicTeamDirectoryMatch({homeTeam:row.home_team,awayTeam:row.away_team,league:scope.leagueName,source:row.source}))throw Error('Court teams need review.');return row})
 if(new Set(matches.map(m=>m.id)).size!==matches.length)throw Error('Duplicate court records.')
 const links=array(r.links,640).map(v=>{const p=object(v),m=matches.find(m=>m.id===p.match_id);if(!m||!fixtureId(p.player_id)||p.side!==(m.home_team===opponent?'A':'B')||p.seat!=null&&(!Number.isInteger(p.seat)||Number(p.seat)<0||Number(p.seat)>4))throw Error('Court player links changed.');return {match_id:m.id,player_id:p.player_id,side:p.side as 'A'|'B',seat:p.seat==null?null:Number(p.seat)}})
 if(new Set(links.map(p=>p.match_id+':'+p.player_id)).size!==links.length)throw Error('Duplicate player links.')
 const ids=new Set(links.map(p=>p.player_id)),players=array(r.players,320).map(v=>{const p=object(v);if(!fixtureId(p.id)||!ids.has(p.id))throw Error('Court players changed.');return {id:p.id,name:text(p.name,160)!}})
 if(new Set(players.map(p=>p.id)).size!==players.length)throw Error('Duplicate player records.')
 const slots=array(r.slots,30).map(v=>{const s=object(v);if(typeof s.id!=='string'||!s.id||s.id.length>120||!['singles','doubles'].includes(String(s.slotType)))throw Error('Court format changed.');return {id:s.id,label:text(s.label,120)!,slotType:s.slotType as 'singles'|'doubles',players:Array.from({length:s.slotType==='singles'?1:2},()=>({playerId:'',playerName:''}))}})
 if(!slots.length||new Set(slots.map(s=>s.id)).size!==slots.length)throw Error('Court format changed.')
 return {matches,links,players,slots}
}
export function courtScoutEvidence(ctx:CourtScoutContext){return buildOpponentSeasonScout({...ctx.records,opponent:ctx.match.opponent,league:ctx.scope.leagueName,flight:ctx.scope.flight,beforeDate:ctx.before})}
