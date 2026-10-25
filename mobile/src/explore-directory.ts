import websiteUi from '../generated/website-ui.json'
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
export function exploreHomeHtml(){return `<div class="native-explore-hero"><h1 tabindex="-1">Find players, teams, leagues.</h1><form id="native-search"><label class="sr-only" for="native-search-kind">Search category</label><select id="native-search-kind" name="category"><option value="Players">Players</option><option value="Teams">Teams</option><option value="Leagues">Leagues</option><option value="Rankings">Rankings by location</option></select><label class="sr-only" for="native-search-term">Search tennis</label><input id="native-search-term" name="term" type="search" minlength="2" maxlength="80" required placeholder="Search a player, team, league or area"><button type="submit">Search</button></form><div class="website-ui website-explore">${websiteUi.explore}</div></div>`}
export function showExplore(app:HTMLElement,client:SupabaseClient,isCurrent:()=>boolean,initial:Category='Overview') {
  let disposed=false
  let currentCategory:Category|null=null
  let active:ReturnType<typeof showPlayers>|ReturnType<typeof showDirectory>|ReturnType<typeof showRankings>|null=null
  app.dataset.state='explore'
  app.innerHTML='<div class="explore-categories" role="group" aria-label="Explore categories"><button type="button" data-category="Overview">Explore</button><button type="button" data-category="Players">Players</button><button type="button" data-category="Teams">Teams</button><button type="button" data-category="Leagues">Leagues</button><button type="button" data-category="Rankings">Rankings</button></div><div id="explore-content"></div>'
  const content=app.querySelector<HTMLElement>('#explore-content')!
  const valid=()=>!disposed && isCurrent()
  const select=(category:Category,term='')=>{
    if(!valid() || currentCategory===category)return
    currentCategory=category
    active?.dispose();active=null
    app.querySelectorAll<HTMLButtonElement>('[data-category]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.category===category)))
    if(category==='Overview'){content.innerHTML=exploreHomeHtml();content.querySelectorAll<HTMLButtonElement>('[data-native-ui-action]').forEach(b=>{b.onclick=()=>{const action=b.dataset.nativeUiAction||'';if(action==='search'){content.querySelector<HTMLInputElement>('#native-search-term')?.focus();return}if(action.startsWith('explore:'))select(action.slice(8) as ExploreCategory)}});content.querySelector<HTMLFormElement>('#native-search')!.onsubmit=e=>{e.preventDefault();const form=e.currentTarget as HTMLFormElement,fields=new FormData(form),term=String(fields.get('term')||'').trim();if(term.length<2||term.length>80)return;const category=String(fields.get('category')) as ExploreCategory;if(!['Players','Teams','Leagues','Rankings'].includes(category))return;select(category,term)};content.querySelector<HTMLElement>('h1')?.focus();window.scrollTo(0,0);return}
    active=category==='Players'?showPlayers(content,client,valid,undefined,term):category==='Rankings'?showRankings(content,client,valid,term):showDirectory(content,category,client,valid,term)
  }
  app.querySelectorAll<HTMLButtonElement>('[data-category]').forEach(button=>{button.onclick=()=>select(button.dataset.category as Category)})
  select(initial)
  return {dispose:()=>{disposed=true;active?.dispose()},back:()=>{if(active?.back())return true;if(currentCategory!=='Overview'){select('Overview');return true}return false}}
}
