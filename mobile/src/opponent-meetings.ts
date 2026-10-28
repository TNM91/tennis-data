import {PLAYER_MATCH_TYPES} from '../../lib/player-match-history'
import websiteUi from '../generated/website-ui.json'
import {matchupOutcome} from '../../lib/matchup-outcome'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {ComparedPlayer} from './comparison-data'
import type {RatingView} from '../../lib/player-rating-display'
import {canFollowPlayers} from './follows-data'
import {html} from './match-details'
import {matchDate,matchResult,type RecentMatchRow} from './recent-results'

const LIMIT=200
export type OpponentHistory={rows:RecentMatchRow[];limited:boolean}
// Require complete, unambiguous sides. Exact pairs exclude matches with substitute partners.
export function opposingMeetings(rows:RecentMatchRow[],ids:string[],view:RatingView){
 if(![2,4].includes(ids.length)||new Set(ids).size!==ids.length)return []
 return rows.filter(row=>{
  const type=row.match_type?.toLowerCase().trim()
  if(view!=='overall'&&type!==view||ids.length===4&&type!=='doubles')return false
  const members=row.match_players
  if(!['singles','doubles'].includes(type||'')||members.length!==(type==='singles'?2:4)||new Set(members.map(p=>p.player_id)).size!==members.length||members.some(p=>!['A','B'].includes(p.side||'')))return false
  const a=members.filter(p=>p.side==='A'),b=members.filter(p=>p.side==='B')
  if(a.length!==b.length)return false
  const side=(id:string)=>members.find(p=>p.player_id===id)?.side
  if(ids.length===2)return Boolean(side(ids[0])&&side(ids[1])&&side(ids[0])!==side(ids[1]))
  return Boolean(side(ids[0])&&side(ids[2])&&side(ids[0])===side(ids[1])&&side(ids[2])===side(ids[3])&&side(ids[0])!==side(ids[2]))
 })
}
export async function loadOpponentMeetings(client:SupabaseClient,players:ComparedPlayer[],current:()=>boolean):Promise<OpponentHistory>{
 const ids=players.map(p=>p.player.id)
 if(![2,4].includes(ids.length)||ids.some(id=>!id)||new Set(ids).size!==ids.length)throw Error('Choose different players.')
 const own=async(owner?:string)=>{const {data,error}=await client.auth.getSession();if(error||!current()||!data.session||owner&&data.session.user.id!==owner)throw Error('Comparison is no longer open.');return data.session.user.id}
 const owner=await own();if(!await canFollowPlayers(client,current))throw Error('Player access is required.');await own(owner)
 // Two reads per explicit request, at most 201 candidate matches and 200 hydrated matches.
 const candidates=await client.from('matches').select('id,match_players!inner(player_id)').eq('match_players.player_id',ids[0]).eq('public_history_eligible',true).in('match_type',PLAYER_MATCH_TYPES).order('match_date',{ascending:false,nullsFirst:false}).order('id',{ascending:false}).limit(LIMIT+1).abortSignal(AbortSignal.timeout(12000))
 await own(owner)
 if(candidates.error||!Array.isArray(candidates.data)||candidates.data.length>LIMIT+1)throw Error('Meeting history unavailable.')
 const selected=candidates.data.slice(0,LIMIT).map(r=>r.id)
 if(selected.some(id=>typeof id!=='string'||!id)||new Set(selected).size!==selected.length)throw Error('Meeting history unavailable.')
 if(!selected.length)return {rows:[],limited:false}
 // No inner filter here: retain every participant, rather than only the anchor player.
 const details=await client.from('matches').select('id,match_date,match_type,league_name,score,winner_side,match_players(player_id,side)').in('id',selected).eq('public_history_eligible',true).in('match_type',PLAYER_MATCH_TYPES).order('match_date',{ascending:false,nullsFirst:false}).order('id',{ascending:false}).limit(LIMIT).abortSignal(AbortSignal.timeout(12000))
 await own(owner)
 if(details.error||!Array.isArray(details.data)||details.data.length!==selected.length||new Set(details.data.map(r=>r.id)).size!==selected.length)throw Error('Meeting history unavailable. Refresh to try again.')
 const rows=details.data as unknown as RecentMatchRow[]
 if(rows.some(r=>!selected.includes(r.id)||!Array.isArray(r.match_players)||r.match_players.some(p=>!p||typeof p.player_id!=='string')||[r.match_date,r.match_type,r.league_name,r.score,r.winner_side].some(v=>v!==null&&typeof v!=='string')))throw Error('Meeting history unavailable.')
 // A correction between reads can remove the anchor; withhold that record rather than guess.
 return {rows,limited:candidates.data.length>LIMIT}
}
export function opponentHistoryHtml(players:ComparedPlayer[],history:OpponentHistory|null,view:RatingView){
 if(!history)return '<p>Search beyond the latest ten results for opposing meetings. Doubles compares these exact pairs.</p>'
 const ids=players.map(p=>p.player.id),rows=opposingMeetings(history.rows,ids,view),half=ids.length/2,labels=[players.slice(0,half),players.slice(half)].map(side=>side.map(p=>p.player.name).join(' / '))
 const record={total:rows.length,winsA:0,winsB:0,singlesA:0,singlesB:0,doublesA:0,doublesB:0}
 for(const row of rows){const outcome=matchupOutcome(row.match_players.find(p=>p.player_id===ids[0])?.side,row.winner_side);if(!outcome)continue;record[outcome==='A'?'winsA':'winsB']++;const type=row.match_type!.toLowerCase().trim();if(type==='singles')record[outcome==='A'?'singlesA':'singlesB']++;else record[outcome==='A'?'doublesA':'doublesB']++}
 const completed=record.winsA+record.winsB,index=completed?Math.round(record.winsA/completed*100):101
 const values:Record<string,string>={TIQ_MEETING_LEFT:labels[0],TIQ_MEETING_RIGHT:labels[1],TIQ_MEETING_TOTAL:String(record.total),TIQ_MEETING_OVERALL:`${record.winsA} - ${record.winsB}`,TIQ_MEETING_SINGLES:`${record.singlesA} - ${record.singlesB}`,TIQ_MEETING_DOUBLES:`${record.doublesA} - ${record.doublesB}`,TIQ_MEETING_PENDING:String(rows.length-completed),TIQ_MEETING_LEAD:record.winsA>record.winsB?labels[0]+' leads':record.winsB>record.winsA?labels[1]+' leads':'Even'}
 const summary='<div class="website-ui website-meeting-summary">'+websiteUi.meetingSummary[index].replace(/TIQ_MEETING_[A-Z]+/g,key=>html(values[key]??key))+'</div>'
 return `<p class="rating-context">Checked ${history.rows.length} of ${html(players[0].player.name)}’s latest connected matches${history.limited?' (200-match limit reached)':''}. This is a bounded search, not a complete career record. Only matches with complete opposing sides are included.</p>${summary}${rows.length?`<ol class="matches">${rows.slice(0,20).map((row,index)=>`<li><div class="match-heading"><strong>${html(matchResult(row,ids[0])==='Won'?labels[0]+' won':matchResult(row,ids[0])==='Lost'?labels[1]+' won':'Result pending')}</strong><span>${html(matchDate(row.match_date))}</span></div><p>${html(row.match_type||'Match')} · ${html(row.league_name||'League unavailable')}</p><p class="score">${html(row.score||'Score unavailable')}</p><button type="button" class="secondary match-open" data-opponent-meeting="${index}">View meeting<span class="sr-only"> ${html(matchDate(row.match_date))}</span></button></li>`).join('')}</ol>${rows.length>20?'<p>Showing the latest 20 meetings. The record above includes every confirmed meeting in this search.</p>':''}`:'<p>No confirmed opposing meetings found for this view. Older or incomplete records may be outside this search.</p>'}`
}
