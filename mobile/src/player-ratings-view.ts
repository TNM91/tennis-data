import {publishedUstaLabel} from '../../lib/published-usta-rating'
import {labLevelPathHtml} from './lab-level-path'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadPlayerRatings, ratingValues, type RecordedRatings } from './player-ratings-data'

export function ratingsHtml(player:RecordedRatings|null,visual=false,showcase=false) {
  if(!player)return '<p>No player rating record is available.</p>'
  return `<dl class="player-ratings${visual?' lab-rating-chart':''}">${ratingValues(player).map((row,index)=>`<div>${showcase&&index===0?'<img class="rating-court-art" src="./brand/courts/tiq-court-approved-20261024-v2.png" alt="" width="1448" height="1086">':''}<dt>${row.label}</dt><dd>${row.value ?? '—'}</dd>${visual&&row.value?`<dd class="rating-scale"><meter min="1.5" max="7" value="${Number(row.value)}" aria-label="${row.label} ${row.fallback?'Overall fallback':'recorded TIQ'}">${row.value}</meter></dd>`:''}<dd class="rating-note">${row.value?(row.fallback?'Overall used':showcase&&index===0&&player.rating_source==='self'?'Self-rated TIQ':showcase&&index===0&&player.rating_source==null?'Source unavailable':'Recorded TIQ'):'Not recorded'}</dd></div>`).join('')}</dl>${visual?'<p class="rating-scale-caption">TIQ scale · 1.5–7.0</p>':''}<p class="rating-context">USTA current: <strong>${publishedUstaLabel(player)}</strong></p>${showcase?'<details class="rating-context-info"><summary>About these ratings</summary>':''}<p class="rating-context">${player.rating_source==='self'?'Self-rated player record. ':player.rating_source==null?'Rating source unavailable. ':''}TIQ ratings are estimates, not official USTA ratings. Singles and Doubles use Overall when a separate rating is missing.</p>${showcase?'</details>':''}${visual&&!showcase?labLevelPathHtml(player):''}`
}
export function showPlayerRatings(host:HTMLElement,client:SupabaseClient,playerId:string,isCurrent:()=>boolean,visual=false,options?:{showcase?:boolean;onReady?:(player:RecordedRatings)=>void}) {
  let request=0
  const load=async()=>{
    const version=++request
    host.innerHTML='<p role="status">Loading recorded TIQ ratings…</p>'
    try {
      const player=await loadPlayerRatings(client,playerId)
      if(!isCurrent() || version!==request || !host.isConnected)return
      host.innerHTML=ratingsHtml(player,visual,options?.showcase);if(player)options?.onReady?.(player)
    } catch {
      if(!isCurrent() || version!==request || !host.isConnected)return
      host.innerHTML='<p role="alert">Can’t load ratings. Check your connection and try again.</p><button type="button" class="secondary">Retry ratings</button>'
      host.querySelector<HTMLButtonElement>('button')!.onclick=()=>{void load()}
    }
  }
  void load()
}
