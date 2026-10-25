import type {SupabaseClient} from '@supabase/supabase-js'
import {loadCaptainData,type CaptainData} from './captain-data'
import type {TeamScope} from './team-room-data'
import type {PlayerChoice} from './player-connection'
import {loadComparison,type ComparedPlayer} from './comparison-data'
import {loadPlayerRatings} from './player-ratings-data'
import {loadRecentResults,type RecentMatchRow} from './recent-results'
export type RosterPlayer=CaptainData['roster'][number]
export function confirmedRosterPlayers(roster:RosterPlayer[],chosen:RosterPlayer[]){
 if(!chosen.length||chosen.length>2||new Set(chosen.map(p=>p.id)).size!==chosen.length)throw Error('Choose one or two different roster players.')
 return chosen.map(p=>{const matches=roster.filter(row=>row.id===p.id);if(matches.length!==1||!p.playerId||matches[0].playerId!==p.playerId||matches[0].name!==p.name||roster.filter(row=>row.playerId===p.playerId).length!==1)throw Error('This roster record changed or has no unique connected player. Refresh Captain tools.');return matches[0]})
}
export async function readRosterPlayers(client:SupabaseClient,ids:string[]):Promise<PlayerChoice[]>{
 const {data,error}=await client.from('players').select('id,name,location,flight').in('id',ids).limit(3).abortSignal(AbortSignal.timeout(12000))
 if(error||!Array.isArray(data)||data.length!==ids.length)throw Error('Connected player records could not be confirmed.')
 return ids.map(id=>{const rows=data.filter(p=>p.id===id);if(rows.length!==1||typeof rows[0].name!=='string'||!rows[0].name.trim()||rows[0].name.length>160||[rows[0].location,rows[0].flight].some(v=>v!=null&&(typeof v!=='string'||v.length>240)))throw Error('Connected player records could not be confirmed.');return rows[0] as PlayerChoice})
}
export function rosterResults(rows:unknown,playerId:string):RecentMatchRow[]{
 if(!Array.isArray(rows)||rows.length>10)throw Error('Recent results could not be confirmed.')
 const seen=new Set<string>();return rows.map(row=>{if(!row||typeof row!=='object'||typeof row.id!=='string'||!row.id||row.id.length>120||seen.has(row.id)||!Array.isArray(row.match_players)||row.match_players.length>8||row.match_players.filter((p:{player_id?:string})=>p?.player_id===playerId).length!==1||row.match_players.some((p:{player_id?:unknown;side?:unknown})=>!p||typeof p.player_id!=='string'||p.player_id.length>120||p.side!=null&&!['A','B'].includes(String(p.side)))||['match_date','match_type','league_name','score','winner_side'].some(k=>row[k]!=null&&(typeof row[k]!=='string'||row[k].length>240)))throw Error('Recent results could not be confirmed.');seen.add(row.id);return row as RecentMatchRow})
}
export async function readRosterPlayer(client:SupabaseClient,player:PlayerChoice):Promise<ComparedPlayer>{const [ratings,result]=await Promise.all([loadPlayerRatings(client,player.id),loadRecentResults(client,player.id)]);if(result.error)throw Error('Recent results unavailable.');return {player,ratings,matches:rosterResults(result.data||[],player.id)}}
export async function loadRosterScout(client:SupabaseClient,owner:string,current:()=>boolean,scope:TeamScope,chosen:RosterPlayer[],read={workspace:loadCaptainData,players:readRosterPlayers,one:readRosterPlayer,compare:loadComparison}):Promise<ComparedPlayer[]>{
 if(!current())throw Error('This team is no longer open.')
 const fresh=await read.workspace(client,owner,current,scope);if(!current())throw Error('This team is no longer open.');const selected=confirmedRosterPlayers(fresh.roster,chosen)
 const players=await read.players(client,selected.map(p=>p.playerId!));if(!current())throw Error('This team is no longer open.')
 if(players.length!==selected.length||players.some((p,i)=>p.id!==selected[i].playerId))throw Error('The connected player record changed.')
 const results=players.length===1?[await read.one(client,players[0])]:await read.compare(client,players as [PlayerChoice,PlayerChoice]);if(!current())throw Error('This team is no longer open.')
 if(results.length!==players.length||results.some((p,i)=>p.player.id!==players[i].id))throw Error('Player results could not be confirmed.')
 return results.map(p=>({...p,matches:rosterResults(p.matches,p.player.id)}))
}
