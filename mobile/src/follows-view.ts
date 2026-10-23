import type { SupabaseClient } from '@supabase/supabase-js'
import { html } from './match-details'
import { loadPlayerFollows } from './follows-data'
import { showExplore as showPlayer } from './explore'

export function showFollowing(app:HTMLElement,client:SupabaseClient,isCurrent:()=>boolean) {
  let disposed=false,request=0,player:ReturnType<typeof showPlayer>|null=null,scroll=0
  const valid=()=>!disposed && isCurrent()
  app.innerHTML='<div id="following-list"><small>My tennis</small><h1 tabindex="-1">Following</h1><p>Keep the players you watch close to hand.</p><p role="status" id="following-status"></p><div id="following-rows"></div><button type="button" class="secondary" id="refresh-following">Refresh following</button></div><div id="following-player" hidden></div>'
  const list=app.querySelector<HTMLElement>('#following-list')!,detail=app.querySelector<HTMLElement>('#following-player')!
  const status=list.querySelector<HTMLElement>('#following-status')!,rows=list.querySelector<HTMLElement>('#following-rows')!
  const refresh=list.querySelector<HTMLButtonElement>('#refresh-following')!
  app.querySelector<HTMLElement>('h1')!.focus()
  const back=()=>{player?.dispose();player=null;detail.hidden=true;detail.innerHTML='';list.hidden=false;window.scrollTo(0,scroll);void load().then(()=>{if(valid() && !player){window.scrollTo(0,scroll);list.querySelector<HTMLElement>('h1')?.focus({preventScroll:true})}})}
  const load=async()=>{
    const version=++request
    refresh.disabled=true;status.textContent='Loading followed players…';rows.innerHTML=''
    try {
      const items=await loadPlayerFollows(client,valid)
      if(!valid() || version!==request)return
      status.textContent=items.length?`${items.length} followed player${items.length===1?'':'s'} shown, up to 24. Teams and leagues are available on the website.`:'No followed players yet. Follow a player in Explore to save them here.'
      rows.innerHTML=`<ul class="player-choices">${items.map((item,index)=>`<li><h2>${html(item.entity_name)}</h2><p>${html(item.subtitle || 'Saved player')}</p><button type="button" class="secondary" data-follow-player="${index}">View player<span class="sr-only"> ${html(item.entity_name)}</span></button></li>`).join('')}</ul>`
      rows.querySelectorAll<HTMLButtonElement>('[data-follow-player]').forEach(button=>{button.onclick=()=>{
        if(!valid())return
        const item=items[Number(button.dataset.followPlayer)]
        scroll=window.scrollY;list.hidden=true;detail.hidden=false
        player=showPlayer(detail,client,valid,{player:{id:item.entity_id,name:item.entity_name,location:null,flight:null},back,backLabel:'Back to following'})
      }})
    } catch {
      if(!valid() || version!==request)return
      status.textContent='Can’t load followed players. Check your connection, then refresh.'
    } finally {if(valid() && version===request)refresh.disabled=false}
  }
  refresh.onclick=()=>{void load()};void load()
  return {dispose:()=>{disposed=true;request++;player?.dispose()},back:()=>{if(!player)return false;if(player.isMatchOpen()){history.back();return true}back();return true}}
}
