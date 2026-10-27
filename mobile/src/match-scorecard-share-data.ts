import type {SupabaseClient} from '@supabase/supabase-js'
import {isValidCalendarDate} from '../../lib/calendar-date'
import {matchDate} from './recent-results'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export type PublicScorecardShare={title:string;text:string;url:string;key:string}
export function publicScorecardShare(value:unknown,matchId:string,playerId:string,owner:string,today:string):PublicScorecardShare{
 if(!uuid.test(matchId)||!uuid.test(playerId)||!uuid.test(owner)||!value||typeof value!=='object'||Array.isArray(value))throw Error('Public scorecard unavailable.')
 const row=value as Record<string,unknown>,own=Array.isArray(row.match_players)&&row.match_players.length===1?row.match_players[0]:null
 if(row.id!==matchId||row.public_history_eligible!==true||!own||own.player_id!==playerId||![null,'A','B'].includes(own.side)||typeof row.match_date!=='string'||!isValidCalendarDate(row.match_date.slice(0,10))||!Number.isFinite(Date.parse(row.match_date))||row.match_date.slice(0,10)>today)throw Error('Public scorecard unavailable.')
 const text=(value:unknown,max:number)=>{if(value==null)return '';if(typeof value!=='string'||value.length>max)throw Error('Public scorecard unavailable.');return value.replace(/\s+/g,' ').trim()}
 const format=text(row.match_type,80)||'Match',league=text(row.league_name,200)||'League unavailable',score=text(row.score,500)||'Score unavailable'
 if(![null,'A','B'].includes(row.winner_side as string|null))throw Error('Public scorecard unavailable.')
 const url='https://www.tenaceiq.com/matches/'+encodeURIComponent(matchId)+'?via=scorecard-share'
 const title='TenAceIQ tennis scorecard',body=['Recorded match: '+matchDate(row.match_date),'Format: '+format,'League: '+league,'Recorded score: '+score,'Scores follow the source court order. Open the scorecard for the latest public result.'].join('\n')
 return Object.freeze({title,text:body,url,key:JSON.stringify([owner,matchId,playerId,row.match_date,format,league,score,own.side,row.winner_side])})
}
export async function readPublicScorecardShare(client:SupabaseClient,matchId:string,playerId:string,current:()=>boolean):Promise<PublicScorecardShare>{
 if(!current()||!uuid.test(matchId)||!uuid.test(playerId))throw Error('Match visit closed.')
 const own=async(owner?:string)=>{const {data,error}=await client.auth.getSession();const id=data.session?.user.id;if(error||!id||!uuid.test(id)||!current()||owner&&id!==owner)throw Error('Match visit closed.');return id}
 const owner=await own(),today=new Date().toISOString().slice(0,10)
 const {data,error,count}=await client.from('matches').select('id,match_date,match_type,league_name,score,winner_side,public_history_eligible,match_players!inner(player_id,side)',{count:'exact'}).eq('id',matchId).eq('match_players.player_id',playerId).eq('public_history_eligible',true).lte('match_date',today).limit(2).abortSignal(AbortSignal.timeout(12000))
 await own(owner)
 if(error||!Array.isArray(data)||data.length!==1||count!==1)throw Error('Public scorecard unavailable.')
 return publicScorecardShare(data[0],matchId,playerId,owner,today)
}
