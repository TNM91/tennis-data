import type { SupabaseClient } from '@supabase/supabase-js'
import type { PlayerChoice } from './player-connection'
import { html } from './match-details'
import { MEMBERSHIP_TIERS } from '../../lib/product-story'
import { canFollowPlayers, FollowAccessError, playerFollowState, savePlayerFollow } from './follows-data'

export function showFollowControl(host:HTMLElement,client:SupabaseClient,player:PlayerChoice,isCurrent:()=>boolean) {
  let busy=false,following=false,allowed=false
  const valid=()=>isCurrent() && host.isConnected
  const load=async()=>{
    host.innerHTML='<p role="status">Checking follow status…</p>'
    try {
      // Existing follows can still be removed after membership expires.
      following=await playerFollowState(client,player.id,isCurrent)
      allowed=following || await canFollowPlayers(client,isCurrent)
      if(!valid())return
      render()
    } catch {
      if(!valid())return
      host.innerHTML='<p role="alert">Can’t check follows. Check your connection and try again.</p><button type="button" class="secondary">Retry follow status</button>'
      host.querySelector<HTMLButtonElement>('button')!.onclick=()=>{void load()}
    }
  }
  const render=()=>{
    if(!allowed){host.innerHTML=`<p>Following players is included with ${html(MEMBERSHIP_TIERS.player_plus.name)} access.</p>`;return}
    host.innerHTML=`<button type="button" class="secondary">${following?'Unfollow player':'Follow player'}</button><p role="status" class="follow-notice">${following?'Saved to Following.':''}</p>`
    const button=host.querySelector<HTMLButtonElement>('button')!
    button.onclick=async()=>{
      if(busy || !valid())return
      busy=true;button.disabled=true;button.textContent='Saving…'
      try {
        await savePlayerFollow(client,{entity_type:'player',entity_id:player.id,entity_name:player.name,subtitle:player.location},!following,isCurrent)
        if(!valid())return
        following=!following
        if(!following){await load();return}
        render()
        host.querySelector<HTMLElement>('.follow-notice')!.textContent=following?'Saved to Following.':'Player unfollowed.'
      } catch(error) {
        if(!valid())return
        if(error instanceof FollowAccessError){allowed=false;render();return}
        // A timed-out save may have completed. Re-check server state before another toggle.
        host.innerHTML='<p role="alert">Couldn’t confirm the change. Check follow status before trying again.</p><button type="button" class="secondary">Check follow status</button>'
        host.querySelector<HTMLButtonElement>('button')!.onclick=()=>{void load()}
      } finally {busy=false}
    }
  }
  void load()
}
