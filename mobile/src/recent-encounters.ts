import type {ComparedPlayer} from './comparison-data'
import type {RatingView} from '../../lib/player-rating-display'
import {matchDate,matchResult,type RecentMatchRow} from './recent-results'
import {html} from './match-details'

export function recentEncounters(players:ComparedPlayer[],view:RatingView) {
 if(players.length!==2 || players[0].player.id===players[1].player.id)return {matches:[] as RecentMatchRow[],unconfirmed:0}
 const [left,right]=players
 const other=new Map(right.matches.map(row=>[row.id,row]))
 const seen=new Set<string>(),matches:RecentMatchRow[]=[]
 let unconfirmed=0
 for(const row of left.matches){
  if(seen.has(row.id))continue
  seen.add(row.id)
  const opposite=other.get(row.id)
  if(!opposite)continue
  const type=row.match_type?.trim().toLowerCase()
  if(view!=='overall' && type!==view)continue
  const leftSeats=row.match_players.filter(member=>member.player_id===left.player.id)
  const rightSeats=opposite.match_players.filter(member=>member.player_id===right.player.id)
  const leftSide=leftSeats[0]?.side,rightSide=rightSeats[0]?.side
  if(leftSeats.length!==1 || rightSeats.length!==1 || !['A','B'].includes(leftSide || '') || !['A','B'].includes(rightSide || '')){unconfirmed++;continue}
  if(leftSide===rightSide)continue
  // Two bounded reads can straddle a source correction. Do not resolve conflicts by guessing.
  if(type!==opposite.match_type?.trim().toLowerCase() || row.match_date!==opposite.match_date || row.score!==opposite.score || row.winner_side!==opposite.winner_side){unconfirmed++;continue}
  matches.push(row)
 }
 return {matches,unconfirmed}
}
export function encountersHtml(players:ComparedPlayer[],view:RatingView) {
 const {matches,unconfirmed}=recentEncounters(players,view)
 const left=players[0]?.player,right=players[1]?.player
 if(!left || !right)return ''
 let winsLeft=0,winsRight=0,pending=0
 for(const row of matches){const result=matchResult(row,left.id);if(result==='Won')winsLeft++;else if(result==='Lost')winsRight++;else pending++}
 return `<section class="encounter-history" aria-labelledby="encounters-title"><h2 id="encounters-title">Recent meetings</h2><p class="rating-context">Opposing sides found within each player’s latest ten connected results. Doubles partners are excluded. Older meetings may be outside this sample.</p>${matches.length?`<dl class="recent-form"><div><dt>${html(left.name)} wins</dt><dd>${winsLeft}</dd></div><div><dt>${html(right.name)} wins</dt><dd>${winsRight}</dd></div><div><dt>Pending</dt><dd>${pending}</dd></div></dl><ol class="matches">${matches.map((row,index)=>`<li><div class="match-heading"><strong>${html(matchResult(row,left.id)==='Won'?left.name+' won':matchResult(row,left.id)==='Lost'?right.name+' won':'Result pending')}</strong><span>${html(matchDate(row.match_date))}</span></div><p>${html(row.match_type || 'Match')} · ${html(row.league_name || 'League unavailable')}</p><p class="score">${html(row.score || 'Score unavailable')}</p><button type="button" class="secondary match-open" data-encounter="${index}">View meeting<span class="sr-only"> ${html(matchDate(row.match_date))}</span></button></li>`).join('')}</ol>`:'<p>No opposing meetings found in this sample for the selected view. This does not mean the players have never met.</p>'}${unconfirmed?'<p role="status">Some shared records could not be confirmed as opposing meetings and are excluded.</p>':''}</section>`
}
