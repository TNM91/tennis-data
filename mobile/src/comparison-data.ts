import type {SupabaseClient} from '@supabase/supabase-js'
import {loadPlayerRatings,ratingValues,type RecordedRatings} from './player-ratings-data'
import {loadRecentResults,type RecentMatchRow} from './recent-results'
import {filteredMatches,recentForm,type MatchFilter} from './results-view'
import type {PlayerChoice} from './player-connection'
import type {RatingView} from '../../lib/player-rating-display'
import {html} from './match-details'
export type ComparedPlayer={player:PlayerChoice;ratings:RecordedRatings|null;matches:RecentMatchRow[]}
export async function loadComparison(client:SupabaseClient,players:[PlayerChoice,PlayerChoice]):Promise<ComparedPlayer[]> {
 if(players[0].id===players[1].id)throw Error('Choose two different players.')
 return Promise.all(players.map(async player=>{
  const [ratings,results]=await Promise.all([loadPlayerRatings(client,player.id),loadRecentResults(client,player.id)])
  if(results.error)throw Error('Comparison unavailable')
  return {player,ratings,matches:(results.data || []) as RecentMatchRow[]}
 }))
}
export function comparisonCard(data:ComparedPlayer,view:RatingView,index:number) {
 const selected=data.ratings?ratingValues(data.ratings).find(row=>row.label.toLowerCase()===view):null
 const filter:MatchFilter=view==='overall'?'All':view==='singles'?'Singles':'Doubles'
 const shown=filteredMatches(data.matches,filter),form=recentForm(shown,data.player.id)
 return `<section class="comparison-card"><h2>${html(data.player.name)}</h2><p>${html(data.player.location || 'Location unavailable')}</p><p class="comparison-rating">${selected?.value || '—'}</p><p>${selected?.value?(selected.fallback?'Overall TIQ used':'Recorded TIQ rating'):'Rating not recorded'}${data.ratings?.rating_source==='self'?' · Self-rated record':''}</p><dl class="recent-form"><div><dt>Wins</dt><dd>${form.wins}</dd></div><div><dt>Losses</dt><dd>${form.losses}</dd></div><div><dt>Pending</dt><dd>${form.pending}</dd></div></dl><p class="rating-context">${shown.length} ${filter==='All'?'':filter.toLowerCase()+' '}match${shown.length===1?'':'es'} in the latest ${data.matches.length} connected results. This sample is not a complete season record.</p><button type="button" class="secondary" data-comparison-player="${index}">View player and matches<span class="sr-only"> ${html(data.player.name)}</span></button></section>`
}
