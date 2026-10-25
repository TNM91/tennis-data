import type {SupabaseClient} from '@supabase/supabase-js'
import {expectedScore} from './matchup-preparation'
export type HistoricalKind='singles'|'doubles'
export type HistoricalCheck={kind:HistoricalKind;scanned:number;limited:boolean;bands:Record<'overall'|'high'|'medium'|'low',{correct:number;total:number}>;excluded:Record<'pending'|'incomplete'|'ratings'|'tied',number>}
const validRating=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=1.5&&v<=7
const object=(v:unknown):v is Record<string,unknown>=>Boolean(v)&&typeof v==='object'&&!Array.isArray(v)
export function evaluateHistoricalRatings(value:unknown,kind:HistoricalKind):HistoricalCheck{
 if(!['singles','doubles'].includes(kind)||!Array.isArray(value)||value.length>201)throw Error('Historical check unavailable.')
 const report:HistoricalCheck={kind,scanned:Math.min(value.length,200),limited:value.length>200,bands:{overall:{correct:0,total:0},high:{correct:0,total:0},medium:{correct:0,total:0},low:{correct:0,total:0}},excluded:{pending:0,incomplete:0,ratings:0,tied:0}}
 const seen=new Set<string>()
 for(const r of value.slice(0,200)){
  if(!object(r)||typeof r.id!=='string'||!r.id||seen.has(r.id))throw Error('Historical check unavailable.')
  seen.add(r.id)
  if(r.winner_side!=='A'&&r.winner_side!=='B'){report.excluded.pending++;continue}
  const members=r.match_players
  if(r.match_type!==kind||!Array.isArray(members)||members.length!==(kind==='singles'?2:4)||members.some(p=>!object(p)||typeof p.player_id!=='string'||!p.player_id||(p.side!=='A'&&p.side!=='B'))||new Set(members.map(p=>p.player_id)).size!==members.length){report.excluded.incomplete++;continue}
  const a=members.filter(p=>p.side==='A'),b=members.filter(p=>p.side==='B')
  if(a.length!==b.length){report.excluded.incomplete++;continue}
  const ratings=members.map(p=>{const player=p.players;if(!object(player)||player.id!==p.player_id)return null;return player[kind+'_dynamic_rating']??player.overall_dynamic_rating})
  if(!ratings.every(validRating)){report.excluded.ratings++;continue}
  const average=(side:'A'|'B')=>members.reduce((sum,p,i)=>sum+(p.side===side?ratings[i]:0),0)/(members.length/2)
  const left=average('A'),right=average('B')
  if(left===right){report.excluded.tied++;continue}
  const probability=expectedScore(left,right),favorite=Math.max(probability,1-probability),band=favorite>=0.72?'high':favorite>=0.6?'medium':'low',correct=(probability>0.5?'A':'B')===r.winner_side
  for(const key of ['overall',band] as const){report.bands[key].total++;if(correct)report.bands[key].correct++}
 }
 return report
}
export async function readHistoricalRatingCheck(client:SupabaseClient,kind:HistoricalKind,current:()=>boolean):Promise<HistoricalCheck>{
 if(!current()||!['singles','doubles'].includes(kind))throw Error('Historical check unavailable.')
 // One explicit bounded read. Up to 201 matches and 804 participants, below the row cap.
 const response=await client.from('matches').select('id,match_type,winner_side,match_players(player_id,side,players(id,overall_dynamic_rating,singles_dynamic_rating,doubles_dynamic_rating))').eq('match_type',kind).order('match_date',{ascending:false,nullsFirst:false}).order('id',{ascending:false}).limit(201).abortSignal(AbortSignal.timeout(12000))
 if(!current()||response.error)throw Error('Historical check unavailable.')
 return evaluateHistoricalRatings(response.data,kind)
}
