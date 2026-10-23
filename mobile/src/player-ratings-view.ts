import type { SupabaseClient } from '@supabase/supabase-js'
import { loadPlayerRatings, ratingValues, type RecordedRatings } from './player-ratings-data'

export function ratingsHtml(player:RecordedRatings|null) {
  if(!player)return '<p>No player rating record is available.</p>'
  return `<dl class="player-ratings">${ratingValues(player).map(row=>`<div><dt>${row.label}</dt><dd>${row.value ?? '—'}</dd><dd class="rating-note">${row.value?(row.fallback?'Overall used':'Recorded TIQ'):'Not recorded'}</dd></div>`).join('')}</dl><p class="rating-context">${player.rating_source==='self'?'Self-rated player record. ':player.rating_source==null?'Rating source unavailable. ':''}TIQ ratings are estimates, not official USTA ratings. Singles and Doubles use Overall when a separate rating is missing.</p>`
}
export function showPlayerRatings(host:HTMLElement,client:SupabaseClient,playerId:string,isCurrent:()=>boolean) {
  let request=0
  const load=async()=>{
    const version=++request
    host.innerHTML='<p role="status">Loading recorded TIQ ratings…</p>'
    try {
      const player=await loadPlayerRatings(client,playerId)
      if(!isCurrent() || version!==request || !host.isConnected)return
      host.innerHTML=ratingsHtml(player)
    } catch {
      if(!isCurrent() || version!==request || !host.isConnected)return
      host.innerHTML='<p role="alert">Can’t load ratings. Check your connection and try again.</p><button type="button" class="secondary">Retry ratings</button>'
      host.querySelector<HTMLButtonElement>('button')!.onclick=()=>{void load()}
    }
  }
  void load()
}
