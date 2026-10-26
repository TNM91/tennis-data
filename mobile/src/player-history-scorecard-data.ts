import type {SupabaseClient} from '@supabase/supabase-js'
import type {RatingJourneyPoint} from '../../app/components/rating-journey-explorer'
import type {RatingView} from '../../lib/player-rating-display'
import {isValidCalendarDate} from '../../lib/calendar-date'
import {canFollowPlayers,FollowAccessError} from './follows-data'
import {matchupOutcome} from '../../lib/matchup-outcome'
export type HistoryScorecard={date:string;format:'singles'|'doubles';league:string|null;score:string|null;result:'Won'|'Lost';side:'A'|'B';players:Array<{id:string;name:string;side:'A'|'B';seat:number}>;rating:number;delta:number|null}
const object=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Scorecard unavailable.');return v as Record<string,unknown>}
const text=(v:unknown,max:number)=>{if(v==null)return null;if(typeof v!=='string'||v.length>max)throw Error('Scorecard unavailable.');return v.trim()||null}
const key=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v)
export function confirmHistorySnapshot(value:unknown,playerId:string,view:RatingView,point:RatingJourneyPoint) {
 const r=object(value)
 if(r.id!==point.id||r.player_id!==playerId||r.track!=='tiq'||r.rating_type!==view||r.match_id!==point.matchId||!key(r.match_id)||r.snapshot_date!==point.date||r.dynamic_rating!==point.rating||r.delta!==point.delta)throw Error('Rating history changed. Refresh this player.')
}
function historyMatch(value:unknown,playerId:string,point:RatingJourneyPoint,view:RatingView,today:string) {
 const r=object(value),date=text(r.match_date,40),format=r.match_type
 if(r.id!==point.matchId||r.public_history_eligible!==true||!date||!Number.isFinite(Date.parse(date))||!isValidCalendarDate(date.slice(0,10))||date.slice(0,10)>today||!['singles','doubles'].includes(String(format))||view!=='overall'&&view!==format||!Array.isArray(r.match_players)||r.match_players.length!==1)throw Error('Scorecard unavailable.')
 const own=object(r.match_players[0]),outcome=matchupOutcome(own.side,r.winner_side),size=format==='singles'?2:4
 if(own.player_id!==playerId||!outcome)throw Error('Scorecard unavailable.')
 const league=text(r.league_name,200),score=text(r.score,500)
 return {date,format:format as 'singles'|'doubles',side:own.side as 'A'|'B',outcome,size,league,score}
}
export function parseHistoryScorecard(value:unknown,participants:unknown,count:unknown,playerId:string,point:RatingJourneyPoint,view:RatingView,today:string):HistoryScorecard {
 const {date,format,side:ownSide,outcome,size,league,score}=historyMatch(value,playerId,point,view,today)
 if(!Array.isArray(participants)||participants.length!==size||count!==size)throw Error('Scorecard coverage unavailable.')
 const players=participants.map(raw=>{const p=object(raw),person=object(p.players),name=text(person.name,200)
 if(p.match_id!==point.matchId||!key(p.player_id)||person.id!==p.player_id||!name||!['A','B'].includes(String(p.side))||!Number.isInteger(p.seat)||Number(p.seat)<1||Number(p.seat)>4)throw Error('Scorecard players unavailable.')
 return {id:p.player_id,name,side:p.side as 'A'|'B',seat:Number(p.seat)}
 })
 if(new Set(players.map(p=>p.id)).size!==size||players.filter(p=>p.id===playerId&&p.side===ownSide).length!==1)throw Error('Scorecard players unavailable.')
 for(const side of ['A','B']){const team=players.filter(p=>p.side===side);if(team.length!==size/2||new Set(team.map(p=>p.seat)).size!==size/2)throw Error('Scorecard players unavailable.')}
 return {date,format,league,score,result:outcome==='A'?'Won':'Lost',side:ownSide,players:players.sort((a,b)=>a.side.localeCompare(b.side)||a.seat-b.seat),rating:point.rating,delta:point.delta}
}
export async function loadHistoryScorecard(client:SupabaseClient,playerId:string,view:RatingView,point:RatingJourneyPoint,current:()=>boolean):Promise<HistoryScorecard> {
 if(!current()||!key(playerId)||!key(point.id)||!key(point.matchId)||!['overall','singles','doubles'].includes(view)||!Number.isFinite(point.rating)||point.rating<1.5||point.rating>7||point.date.length>40||!Number.isFinite(Date.parse(point.date))||point.date.slice(0,10)>new Date().toISOString().slice(0,10)||!isValidCalendarDate(point.date.slice(0,10))||point.delta!==null&&(!Number.isFinite(point.delta)||Math.abs(point.delta)>10))throw Error('Scorecard unavailable.')
 const own=async(owner?:string)=>{const {data,error}=await client.auth.getSession();if(error||!data.session||!current()||owner&&data.session.user.id!==owner)throw Error('Player visit closed.');return data.session.user.id}
 const owner=await own();if(!await canFollowPlayers(client,current))throw new FollowAccessError('Player access is required.');await own(owner)
 const today=new Date().toISOString().slice(0,10)
 const snapshot=async()=>{if(!current())throw Error('Player visit closed.');const {data,error}=await client.from('rating_snapshots').select('id,match_id,player_id,rating_type,snapshot_date,dynamic_rating,delta,track').eq('id',point.id).eq('player_id',playerId).eq('track','tiq').eq('rating_type',view).limit(1).abortSignal(AbortSignal.timeout(12000)).maybeSingle();if(error)throw Error('Scorecard unavailable.');confirmHistorySnapshot(data,playerId,view,point)}
 const match=async()=>{if(!current())throw Error('Player visit closed.');const {data,error,count}=await client.from('matches').select('id,match_date,match_type,league_name,score,winner_side,public_history_eligible,match_players!inner(player_id,side)',{count:'exact'}).eq('id',point.matchId).eq('match_players.player_id',playerId).eq('public_history_eligible',true).lte('match_date',today).limit(2).abortSignal(AbortSignal.timeout(12000));if(error||!Array.isArray(data)||data.length!==1||count!==1)throw Error('Scorecard unavailable.');return data[0]}
 await snapshot();await own(owner);const parent=await match();historyMatch(parent,playerId,point,view,today);await own(owner)
 const {data,error,count}=await client.from('match_players').select('match_id,player_id,side,seat,players(id,name)',{count:'exact'}).eq('match_id',point.matchId).limit(5).abortSignal(AbortSignal.timeout(12000));if(error)throw Error('Scorecard unavailable.')
 const result=parseHistoryScorecard(parent,data,count,playerId,point,view,today);await own(owner)
 const [fresh]=await Promise.all([match(),snapshot()]);if(JSON.stringify(fresh)!==JSON.stringify(parent))throw Error('Scorecard changed. Refresh this player.');await own(owner)
 return result
}
