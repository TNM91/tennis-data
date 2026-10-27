import type {SupabaseClient} from '@supabase/supabase-js'
import {html} from './match-details'
import {loadFollowedEntities,followedTarget,type FollowKind,type FollowedEntity} from './followed-entities'
import {showExplore as showPlayer} from './explore'
import {showDirectory} from './directory-view'
const categories=[['player','Players'],['team','Teams'],['league','Leagues']] as const
export function followingRowsHtml(items:FollowedEntity[],query:string){
 const term=query.trim().toLocaleLowerCase(),shown=items.map((item,index)=>({item,index})).filter(({item})=>[item.entity_name,item.subtitle??''].join(' ').toLocaleLowerCase().includes(term))
 return `<p role="status">${shown.length} of ${items.length} loaded follows shown.</p>${!items.length?'<p>No saved follows in this category yet.</p>':!shown.length?'<p>No loaded follows match your search.</p>':`<ul class="player-choices">${shown.map(({item,index})=>{const target=followedTarget(item);return `<li><h2>${html(item.entity_name)}</h2><p>${html(item.subtitle||'Saved '+item.entity_type)}</p>${target?`<button type="button" class="secondary" data-follow-item="${index}">View ${item.entity_type}<span class="sr-only"> ${html(item.entity_name)}</span></button>`:'<p>Details for this saved record are not available here yet.</p>'}</li>`}).join('')}</ul>`}`
}
export function showFollowing(app:HTMLElement,client:SupabaseClient,isCurrent:()=>boolean){
 let disposed=false,request=0,kind:FollowKind='player',active:ReturnType<typeof showPlayer>|ReturnType<typeof showDirectory>|null=null,scroll=0,previousId:string|null=null,items:FollowedEntity[]=[],busy=false
 const queries:Record<FollowKind,string>={player:'',team:'',league:''},valid=()=>!disposed&&isCurrent()
 app.innerHTML=`<div id="following-list"><small>My tennis</small><h1 tabindex="-1">Following</h1><p>Your saved players, teams and leagues.</p><div class="match-filters" role="group" aria-label="Following category">${categories.map(([value,label])=>`<button type="button" class="secondary" data-follow-kind="${value}" aria-pressed="${value===kind}">${label}</button>`).join('')}</div><label for="following-search">Filter loaded follows</label><input id="following-search" type="search" maxlength="200" placeholder="Name or saved context"><p role="status" id="following-status"></p><div id="following-rows"></div><button type="button" class="secondary" id="refresh-following">Refresh following</button></div><div id="following-player" hidden></div>`
 const list=app.querySelector<HTMLElement>('#following-list')!,detail=app.querySelector<HTMLElement>('#following-player')!,status=list.querySelector<HTMLElement>('#following-status')!,rows=list.querySelector<HTMLElement>('#following-rows')!,refresh=list.querySelector<HTMLButtonElement>('#refresh-following')!,search=list.querySelector<HTMLInputElement>('#following-search')!
 app.querySelector<HTMLElement>('h1')!.focus()
 const back=()=>{active?.dispose();active=null;detail.hidden=true;detail.innerHTML='';list.hidden=false;window.scrollTo(0,scroll);void load().then(()=>{if(valid()&&!active){window.scrollTo(0,scroll);const index=items.findIndex(item=>item.entity_id===previousId);const focus=index<0?null:rows.querySelector<HTMLButtonElement>('[data-follow-item="'+index+'"]');if(focus)focus.focus({preventScroll:true});else list.querySelector<HTMLElement>('h1')?.focus({preventScroll:true})}})}
 const render=()=>{
  rows.innerHTML=followingRowsHtml(items,queries[kind])
  rows.querySelectorAll<HTMLButtonElement>('[data-follow-item]').forEach(button=>{button.onclick=()=>{
   if(!valid()||busy||active||!button.isConnected)return
   const item=items[Number(button.dataset.followItem)],target=item&&followedTarget(item);if(!target)return
   previousId=item.entity_id;scroll=window.scrollY;list.hidden=true;detail.hidden=false
   if(target.kind==='player')active=showPlayer(detail,client,valid,{player:target.player,back,backLabel:'Back to following'})
   else {detail.innerHTML=(target.kind==='league'?'<button type="button" class="secondary" data-back-following>Back to following</button>':'')+'<div data-follow-directory></div>';const returnButton=detail.querySelector<HTMLButtonElement>('[data-back-following]');if(returnButton)returnButton.onclick=back;active=showDirectory(detail.querySelector<HTMLElement>('[data-follow-directory]')!,target.kind==='team'?'Teams':'Leagues',client,valid,target.kind==='league'?target.scope.name:'',target.kind==='team'?{team:target.team,back}:{league:target.scope})}
  }})
 }
 const load=async(returnFocus?:HTMLElement)=>{
  const version=++request,selectedKind=kind;busy=true;refresh.disabled=true;list.querySelectorAll<HTMLButtonElement>('[data-follow-kind]').forEach(button=>button.disabled=true);status.textContent='Loading saved '+selectedKind+' follows...';items=[];rows.innerHTML=''
  try{const result=await loadFollowedEntities(client,selectedKind,()=>valid()&&version===request);if(!valid()||version!==request)return;items=result.rows;status.textContent=`${items.length} saved ${selectedKind} ${items.length===1?'follow':'follows'} loaded.${result.limited?' Showing the first 24; search filters this loaded sample.':' Up to 24 per category.'}`;render()}
  catch{if(valid()&&version===request)status.textContent='Can’t load these follows. Check your connection, then refresh.'}
  finally{if(valid()&&version===request){busy=false;refresh.disabled=false;list.querySelectorAll<HTMLButtonElement>('[data-follow-kind]').forEach(button=>button.disabled=false);if(returnFocus?.isConnected&&document.activeElement===document.body)returnFocus.focus({preventScroll:true})}}
 }
 search.oninput=()=>{queries[kind]=search.value;if(!busy)render()}
 list.querySelectorAll<HTMLButtonElement>('[data-follow-kind]').forEach(button=>{button.onclick=()=>{if(!valid()||busy||button.dataset.followKind===kind)return;kind=button.dataset.followKind as FollowKind;search.value=queries[kind];list.querySelectorAll<HTMLButtonElement>('[data-follow-kind]').forEach(tab=>tab.setAttribute('aria-pressed',String(tab.dataset.followKind===kind)));void load(button)}})
 refresh.onclick=()=>{if(!busy&&valid())void load(refresh)};void load()
 return {dispose:()=>{disposed=true;request++;active?.dispose();active=null},back:()=>{if(!active)return false;if('closeOverlay' in active?active.closeOverlay():active.back())return true;back();return true}}
}
