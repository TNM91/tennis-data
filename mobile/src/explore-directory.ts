import type { SupabaseClient } from '@supabase/supabase-js'
import { showExplore as showPlayers } from './explore'
import { showDirectory } from './directory-view'
import { showRankings } from './rankings-view'

export type ExploreCategory='Players'|'Teams'|'Leagues'|'Rankings'
type Category=ExploreCategory|'Overview'
export const exploreTools=[
 {category:'Players',title:'Find a player',detail:'Open ratings and recent matches.'},
 {category:'Teams',title:'Browse teams',detail:'Check rosters and team results.'},
 {category:'Leagues',title:'Find a league',detail:'Browse teams and league context.'},
 {category:'Rankings',title:'Check rankings',detail:'Compare the field by recorded TIQ rating.'},
] as const
export function exploreHomeHtml(){return `<small>Tennis intelligence</small><h1 tabindex="-1">Find players, teams, leagues.</h1><p>Choose what you want to understand before your next match.</p><section class="tennis-tools" aria-labelledby="explore-tools-title"><h2 id="explore-tools-title">Explore tennis</h2><div class="tennis-tool-grid">${exploreTools.map(t=>`<button type="button" class="secondary tennis-tool" data-tool="${t.category}"><strong>${t.title}</strong><span>${t.detail}</span></button>`).join('')}</div></section>`}
export function showExplore(app:HTMLElement,client:SupabaseClient,isCurrent:()=>boolean,initial:Category='Overview') {
  let disposed=false
  let currentCategory:Category|null=null
  let active:ReturnType<typeof showPlayers>|ReturnType<typeof showDirectory>|ReturnType<typeof showRankings>|null=null
  app.dataset.state='explore'
  app.innerHTML='<div class="explore-categories" role="group" aria-label="Explore categories"><button type="button" data-category="Overview">Explore</button><button type="button" data-category="Players">Players</button><button type="button" data-category="Teams">Teams</button><button type="button" data-category="Leagues">Leagues</button><button type="button" data-category="Rankings">Rankings</button></div><div id="explore-content"></div>'
  const content=app.querySelector<HTMLElement>('#explore-content')!
  const valid=()=>!disposed && isCurrent()
  const select=(category:Category)=>{
    if(!valid() || currentCategory===category)return
    currentCategory=category
    active?.dispose();active=null
    app.querySelectorAll<HTMLButtonElement>('[data-category]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.category===category)))
    if(category==='Overview'){content.innerHTML=exploreHomeHtml();content.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach(b=>{b.onclick=()=>select(b.dataset.tool as ExploreCategory)});content.querySelector<HTMLElement>('h1')?.focus();window.scrollTo(0,0);return}
    active=category==='Players'?showPlayers(content,client,valid):category==='Rankings'?showRankings(content,client,valid):showDirectory(content,category,client,valid)
  }
  app.querySelectorAll<HTMLButtonElement>('[data-category]').forEach(button=>{button.onclick=()=>select(button.dataset.category as Category)})
  select(initial)
  return {dispose:()=>{disposed=true;active?.dispose()},back:()=>{if(active?.back())return true;if(currentCategory!=='Overview'){select('Overview');return true}return false}}
}
