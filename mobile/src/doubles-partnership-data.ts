import type {SupabaseClient} from '@supabase/supabase-js'
import type {ComparedPlayer} from './comparison-data'
import type {TeamScope} from './team-room-data'
import {loadRosterScout,type RosterPlayer} from './captain-roster-scout-data'
import type {LineupEditorData} from '../../lib/native-captain-lineup-contract'
import {matchResult,type RecentMatchRow} from './recent-results'
export type PartnershipMatch={match:RecentMatchRow;opponents:{id:string;name:string}[];result:'Won'|'Lost'|'Result pending'}
export type Partnership={players:ComparedPlayer[];matches:PartnershipMatch[];excluded:number;checkedAt:string;today:string}
const record=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
const one=(v:unknown)=>Array.isArray(v)?v.length===1?record(v[0]):{}:record(v)
const date=(s:unknown):s is string=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s
const metadata=(r:RecentMatchRow)=>JSON.stringify([r.id,r.match_date,r.match_type?.trim().toLowerCase(),r.league_name,r.score,r.winner_side])
export function lineupPartnership(data:LineupEditorData,index:number):RosterPlayer[]|null{const court=data.plan.courts[index];if(!court||court.defaulted||court.slotType!=='doubles'||court.players.length!==2||new Set(court.players).size!==2)return null;const pair=court.players.map(key=>data.roster.filter(p=>p.key===key));if(pair.some(p=>p.length!==1||!p[0].playerId)||pair[0][0].playerId===pair[1][0].playerId)return null;return pair.map(([p])=>({id:p.key,name:p.name,playerId:p.playerId}))}
export function partnershipCandidates(players:ComparedPlayer[],today:string){
 if(players.length!==2||players[0].player.id===players[1].player.id||!date(today))throw Error('Choose two connected roster players.')
 const [left,right]=players,other=new Map(right.matches.map(m=>[m.id,m])),matches:RecentMatchRow[]=[];let excluded=0
 for(const row of left.matches){const second=other.get(row.id);if(!second)continue;if(row.match_type?.trim().toLowerCase()!=='doubles'&&second.match_type?.trim().toLowerCase()!=='doubles')continue
  if(metadata(row)!==metadata(second)||!date(row.match_date)||row.match_date>today){excluded++;continue}
  const a=row.match_players.filter(p=>p.player_id===left.player.id),b=second.match_players.filter(p=>p.player_id===right.player.id);if(a.length!==1||b.length!==1||!['A','B'].includes(a[0].side||'')||!['A','B'].includes(b[0].side||'')){excluded++;continue}if(a[0].side===b[0].side)matches.push(row)
 }
 return {matches,excluded}
}
export async function readPartnershipCourts(client:SupabaseClient,ids:string[]):Promise<unknown[]>{if(!ids.length||ids.length>10||new Set(ids).size!==ids.length)throw Error('Partnership sample could not be confirmed.');const {data,error}=await client.from('match_players').select('match_id,player_id,side,seat,players(name),matches(id,match_date,match_type,league_name,score,winner_side,status)').in('match_id',ids).order('match_id').order('side').order('seat').limit(41).abortSignal(AbortSignal.timeout(12000));if(error||!Array.isArray(data)||data.length>40)throw Error('Partnership courts could not be confirmed.');return data}
export function confirmPartnershipCourts(players:ComparedPlayer[],candidates:RecentMatchRow[],raw:unknown[]){
 if(raw.length>40||raw.some(v=>!candidates.some(m=>m.id===record(v).match_id)))throw Error('Partnership courts could not be confirmed.')
 const matches:PartnershipMatch[]=[];let excluded=0
 for(const match of candidates){const rows=raw.filter(v=>record(v).match_id===match.id).map(record),left=players[0].player.id,right=players[1].player.id,side=match.match_players.find(p=>p.player_id===left)?.side
  if(rows.length!==4||new Set(rows.map(p=>p.player_id)).size!==4||rows.some(p=>typeof p.player_id!=='string'||!p.player_id||p.player_id.length>120||!['A','B'].includes(String(p.side))||metadata(one(p.matches) as RecentMatchRow)!==metadata(match)||one(p.matches).status!=null&&typeof one(p.matches).status!=='string'||/cancel|postpon/i.test(String(one(p.matches).status)))||['A','B'].some(s=>rows.filter(p=>p.side===s).length!==2)||rows.filter(p=>p.side===side).some(p=>p.player_id!==left&&p.player_id!==right)||rows.filter(p=>p.player_id===left||p.player_id===right).some(p=>p.side!==side)){excluded++;continue}
  const opponents=rows.filter(p=>p.side!==side).sort((a,b)=>String(a.player_id).localeCompare(String(b.player_id))).map(p=>({id:String(p.player_id),name:typeof one(p.players).name==='string'&&String(one(p.players).name).trim()&&String(one(p.players).name).length<=160?String(one(p.players).name):'Player name unavailable'}));matches.push({match,opponents,result:matchResult(match,left)})
 }
 matches.sort((a,b)=>String(b.match.match_date).localeCompare(String(a.match.match_date))||b.match.id.localeCompare(a.match.id));return {matches,excluded}
}
export async function loadPartnership(client:SupabaseClient,owner:string,current:()=>boolean,scope:TeamScope,chosen:RosterPlayer[],read={scout:loadRosterScout,courts:readPartnershipCourts},today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())):Promise<Partnership>{
 if(chosen.length!==2||!current())throw Error('Choose two connected roster players.');const players=await read.scout(client,owner,current,scope,chosen);if(!current())throw Error('This team is no longer open.');const candidates=partnershipCandidates(players,today);const rows=candidates.matches.length?await read.courts(client,candidates.matches.map(m=>m.id)):[];if(!current())throw Error('This team is no longer open.');const result=confirmPartnershipCourts(players,candidates.matches,rows);return {players,...result,excluded:candidates.excluded+result.excluded,checkedAt:new Date().toISOString(),today}
}
