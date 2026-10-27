import type {SupabaseClient} from '@supabase/supabase-js'
import type {RecentMatchRow} from './recent-results'
import {isValidCalendarDate} from '../../lib/calendar-date'
export const RECENT_HISTORY_LIMIT=100
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function stamp(value:string|null){if(value===null)return null;if(typeof value!=='string'||!isValidCalendarDate(value.slice(0,10))||!/^\d{4}-\d{2}-\d{2}(?:T[0-9:.Z+-]+)?$/.test(value)||!Number.isFinite(Date.parse(value)))throw Error('Refresh your profile before loading older matches.');return Date.parse(value)}
function check(row:RecentMatchRow,playerId:string){if(!row||!uuid.test(row.id)||!Array.isArray(row.match_players)||!row.match_players.length||row.match_players.some(p=>!p||p.player_id!==playerId||p.side!==null&&typeof p.side!=='string')||['match_type','league_name','score','winner_side'].some(key=>row[key as keyof RecentMatchRow]!==null&&typeof row[key as keyof RecentMatchRow]!=='string'))throw Error('Match history changed. Refresh your profile.');stamp(row.match_date)}
function before(a:RecentMatchRow,b:RecentMatchRow){const x=stamp(a.match_date),y=stamp(b.match_date);return x===y?a.id.toLowerCase()<b.id.toLowerCase():x===null?true:y===null?false:x<y}
export function appendRecentHistory(loaded:RecentMatchRow[],page:unknown,playerId:string,count:number){
 if(!uuid.test(playerId)||!loaded.length||loaded.length>=RECENT_HISTORY_LIMIT||count!==Math.min(20,RECENT_HISTORY_LIMIT-loaded.length)||!Array.isArray(page)||page.length>count+1)throw Error('Refresh your profile before loading older matches.')
 const all=[...loaded,...page] as RecentMatchRow[]
 all.forEach(row=>check(row,playerId))
 if(new Set(all.map(row=>row.id.toLowerCase())).size!==all.length||all.some((row,i)=>i>0&&!before(row,all[i-1])))throw Error('Match history changed. Refresh your profile before loading older matches.')
 return {rows:[...loaded,...page.slice(0,count)] as RecentMatchRow[],hasMore:page.length>count&&loaded.length+count<RECENT_HISTORY_LIMIT}
}
export async function loadOlderResults(client:SupabaseClient,playerId:string,loaded:RecentMatchRow[]){
 if(!uuid.test(playerId)||!loaded.length||loaded.length>=RECENT_HISTORY_LIMIT)throw Error('Refresh your profile before loading older matches.')
 const count=Math.min(20,RECENT_HISTORY_LIMIT-loaded.length)
 const {data,error}=await client.from('matches').select('id,match_date,match_type,league_name,score,winner_side,match_players!inner(player_id,side)').eq('match_players.player_id',playerId).order('match_date',{ascending:false,nullsFirst:false}).order('id',{ascending:false}).range(loaded.length,loaded.length+count).abortSignal(AbortSignal.timeout(12000))
 if(error)throw Error('Older matches unavailable.')
 return appendRecentHistory(loaded,data,playerId,count)
}
