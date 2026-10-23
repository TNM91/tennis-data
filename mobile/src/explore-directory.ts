import type { SupabaseClient } from '@supabase/supabase-js'
import { showExplore as showPlayers } from './explore'
import { showDirectory } from './directory-view'

type Category='Players'|'Teams'|'Leagues'
export function showExplore(app:HTMLElement,client:SupabaseClient,isCurrent:()=>boolean) {
  let disposed=false
  let currentCategory:Category|null=null
  let active:ReturnType<typeof showPlayers>|ReturnType<typeof showDirectory>|null=null
  app.dataset.state='explore'
  app.innerHTML='<div class="explore-categories" role="group" aria-label="Explore categories"><button type="button" data-category="Players">Players</button><button type="button" data-category="Teams">Teams</button><button type="button" data-category="Leagues">Leagues</button></div><div id="explore-content"></div>'
  const content=app.querySelector<HTMLElement>('#explore-content')!
  const valid=()=>!disposed && isCurrent()
  const select=(category:Category)=>{
    if(!valid() || currentCategory===category)return
    currentCategory=category
    active?.dispose()
    app.querySelectorAll<HTMLButtonElement>('[data-category]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.category===category)))
    active=category==='Players'?showPlayers(content,client,valid):showDirectory(content,category,client,valid)
  }
  app.querySelectorAll<HTMLButtonElement>('[data-category]').forEach(button=>{button.onclick=()=>select(button.dataset.category as Category)})
  select('Players')
  return {dispose:()=>{disposed=true;active?.dispose()},back:()=>active?.back() || false}
}
