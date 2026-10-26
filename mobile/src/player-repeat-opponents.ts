import type {SupabaseClient} from '@supabase/supabase-js'
import type {PerformanceMatch} from '../../lib/player-performance'
import {playerRepeatOpponents,type RepeatOpponent} from '../../lib/player-repeat-opponents'
type Participant={match_id:string;player_id:string;side:'A'|'B';seat:number;players:{id:string;name:string}}
export type OpponentHistoryMatch=PerformanceMatch&{opponent:string;opponentIds:string[];side:'A'|'B';players:Array<{id:string;name:string;side:'A'|'B';seat:number}>}
export function parseOpponentHistory(rows:unknown,count:unknown,matches:PerformanceMatch[],playerId:string):OpponentHistoryMatch[] {
  if(!Array.isArray(rows)||count!==rows.length||rows.length>2000)throw Error('Opponent coverage unavailable.')
  const ids=new Set(matches.map(m=>m.id)),groups=new Map<string,Participant[]>()
  for(const raw of rows){
    const r=raw as Participant
    if(!r||!ids.has(r.match_id)||typeof r.player_id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(r.player_id)||!['A','B'].includes(r.side)||!Number.isInteger(r.seat)||r.seat<1||r.seat>4||!r.players||r.players.id!==r.player_id||typeof r.players.name!=='string'||!r.players.name.trim()||r.players.name.length>200)throw Error('Opponent coverage unavailable.')
    const group=groups.get(r.match_id)??[];group.push(r);groups.set(r.match_id,group)
  }
  return matches.map(match=>{
    const group=groups.get(match.id)??[],own=group.filter(p=>p.player_id===playerId),size=match.matchType==='singles'?1:2
    if(group.length!==size*2||new Set(group.map(p=>p.player_id)).size!==group.length||own.length!==1||group.filter(p=>p.side===own[0].side).length!==size)throw Error('Opponent coverage unavailable.')
    for(const side of ['A','B']){const seats=group.filter(p=>p.side===side).map(p=>p.seat);if(new Set(seats).size!==seats.length)throw Error('Opponent coverage unavailable.')}
    const opponents=group.filter(p=>p.side!==own[0].side).sort((a,b)=>a.seat-b.seat)
    return {...match,opponent:opponents.map(p=>p.players.name.trim()).join(' / '),opponentIds:opponents.map(p=>p.player_id),side:own[0].side,players:group.map(p=>({id:p.player_id,name:p.players.name.trim(),side:p.side,seat:p.seat})).sort((a,b)=>a.side.localeCompare(b.side)||a.seat-b.seat)}
  })
}
export function parseRepeatOpponents(rows:unknown,count:unknown,matches:PerformanceMatch[],playerId:string):RepeatOpponent[] {return playerRepeatOpponents(parseOpponentHistory(rows,count,matches,playerId))}
export async function loadRepeatOpponents(client:SupabaseClient,matches:PerformanceMatch[],playerId:string,current:()=>boolean=()=>true):Promise<RepeatOpponent[]|null> {const history=await loadOpponentHistory(client,matches,playerId,current);return history===null?null:playerRepeatOpponents(history)}
export async function loadOpponentHistory(client:SupabaseClient,matches:PerformanceMatch[],playerId:string,current:()=>boolean=()=>true):Promise<OpponentHistoryMatch[]|null> {
  if(!matches.length)return []
  try{
    // Bound batches below hosted row limits; exact counts detect truncation or missing participants.
    const rows:unknown[]=[]
    for(let start=0;start<matches.length;start+=100){
      if(!current())return null
      const {data,error,count}=await client.from('match_players').select('match_id,player_id,side,seat,players(id,name)',{count:'exact'}).in('match_id',matches.slice(start,start+100).map(m=>m.id)).limit(401).abortSignal(AbortSignal.timeout(12000))
      if(error||!Array.isArray(data)||count!==data.length||data.length>400)return null
      rows.push(...data)
    }
    if(!current())return null
    return parseOpponentHistory(rows,rows.length,matches,playerId)
  }catch{return null}
}
