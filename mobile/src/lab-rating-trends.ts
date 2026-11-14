import websiteUi from '../generated/website-ui.json'
import type {SupabaseClient} from '@supabase/supabase-js'
import {showPlayerJourney} from './player-journey-view'

// History stays opt-in, using the same bounded, access-checked website journey as profiles.
export function mountLabRatingTrends(host:HTMLElement,client:SupabaseClient,playerId:string,current:()=>boolean) {
  let disposed=false,journey:ReturnType<typeof showPlayerJourney>|null=null
  const valid=()=>!disposed&&host.isConnected&&current()
  host.classList.add('lab-rating-trends','native-section-group')
  host.innerHTML=`<h2>Understand your game</h2>
    <button type="button" class="secondary app-tool lab-action-row lab-trend-entry" aria-labelledby="lab-trend-title" aria-describedby="lab-trend-detail">
      <span class="lab-action-icon" aria-hidden="true">${websiteUi.icons.following}</span>
      <span class="app-tool-copy">
        <strong id="lab-trend-title">Your TIQ over time</strong>
        <span id="lab-trend-detail">Ratings by format &amp; match scorecards</span>
      </span>
      <span class="app-tool-arrow" aria-hidden="true">›</span>
    </button>`
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
