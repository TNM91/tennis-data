import websiteUi from '../generated/website-ui.json'
import type {SupabaseClient} from '@supabase/supabase-js'
import {showPlayerJourney} from './player-journey-view'

// History stays opt-in, using the same bounded, access-checked website journey as profiles.
export function mountLabRatingTrends(host:HTMLElement,client:SupabaseClient,playerId:string,current:()=>boolean) {
  let disposed=false,journey:ReturnType<typeof showPlayerJourney>|null=null
  const valid=()=>!disposed&&host.isConnected&&current()
  host.classList.add('lab-rating-trends')
  host.innerHTML='<h2>Understand your game</h2><button type="button" class="secondary lab-trend-entry" aria-label="Open rating trends"><span class="lab-trend-entry-icon" aria-hidden="true">'+websiteUi.icons.following+'</span><span><strong>Your TIQ over time</strong><small>Overall, singles &amp; doubles history</small></span><span class="lab-trend-arrow" aria-hidden="true">→</span></button><p>Open saved ratings and the scorecards behind them.</p>'
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
