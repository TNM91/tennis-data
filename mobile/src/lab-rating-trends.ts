import type {SupabaseClient} from '@supabase/supabase-js'
import {showPlayerJourney} from './player-journey-view'

// History stays opt-in, using the same bounded, access-checked website journey as profiles.
export function mountLabRatingTrends(host:HTMLElement,client:SupabaseClient,playerId:string,current:()=>boolean) {
  let disposed=false,journey:ReturnType<typeof showPlayerJourney>|null=null
  const valid=()=>!disposed&&host.isConnected&&current()
  host.classList.add('lab-rating-trends')
  host.innerHTML='<small class="stat-eyebrow">Your rating over time</small><h2>Rating trends</h2><p>Explore saved TIQ movement, compare formats, and open linked scorecards.</p><button type="button" class="secondary">Open rating trends</button>'
  const button=host.querySelector<HTMLButtonElement>('button')!
  button.onclick=()=>{
    if(journey||!valid())return
    journey=showPlayerJourney(host,client,playerId,valid,undefined,undefined,{expandChart:true})
  }
  return {
    isScorecardOpen:()=>journey?.isScorecardOpen()??false,
    back:()=>journey?.closeScorecard()??false,
    dispose:()=>{if(disposed)return;disposed=true;journey?.dispose();journey=null;host.replaceChildren()},
  }
}
