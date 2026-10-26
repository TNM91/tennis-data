import type {SupabaseClient} from '@supabase/supabase-js'
import type {PerformanceMatch} from '../../lib/player-performance'
import {playerRepeatOpponents,type RepeatOpponent} from '../../lib/player-repeat-opponents'
type Participant={match_id:string;player_id:string;side:'A'|'B';seat:number;players:{id:string;name:string}}
export function parseRepeatOpponents(rows:unknown,count:unknown,matches:PerformanceMatch[],playerId:string):RepeatOpponent[] {
  if(!Array.isArray(rows)||count!==rows.length||rows.length>2000)throw Error('Opponent coverage unavailable.')
  const ids=new Set(matches.map(m=>m.id)),groups=new Map<string,Participant[]>()
  for(const raw of rows){
    const r=raw as Participant
    if(!r||!ids.has(r.match_id)||typeof r.player_id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(r.player_id)||!['A','B'].includes(r.side)||!Number.isInteger(r.seat)||r.seat<1||r.seat>4||!r.players||r.players.id!==r.player_id||typeof r.players.name!=='string'||!r.players.name.trim()||r.players.name.length>200)throw Error('Opponent coverage unavailable.')
    const group=groups.get(r.match_id)??[];group.push(r);groups.set(r.match_id,group)
  }
  return playerRepeatOpponents(matches.map(match=>{
    const group=groups.get(match.id)??[],own=group.filter(p=>p.player_id===playerId),size=match.matchType==='singles'?1:2
    if(group.length!==size*2||new Set(group.map(p=>p.player_id)).size!==group.length||own.length!==1||group.filter(p=>p.side===own[0].side).length!==size)throw Error('Opponent coverage unavailable.')
    for(const side of ['A','B']){const seats=group.filter(p=>p.side===side).map(p=>p.seat);if(new Set(seats).size!==seats.length)throw Error('Opponent coverage unavailable.')}
    const opponents=group.filter(p=>p.side!==own[0].side).sort((a,b)=>a.seat-b.seat)
    return {...match,opponent:opponents.map(p=>p.players.name.trim()).join(' / '),opponentIds:opponents.map(p=>p.player_id)}
  }))
}
export async function loadRepeatOpponents(client:SupabaseClient,matches:PerformanceMatch[],playerId:string,current:()=>boolean=()=>true):Promise<RepeatOpponent[]|null> {
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
    return parseRepeatOpponents(rows,rows.length,matches,playerId)
  }catch{return null}
}
