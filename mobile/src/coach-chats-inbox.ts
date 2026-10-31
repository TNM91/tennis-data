import type {SupabaseClient} from '@supabase/supabase-js'
import {loadCoachChatConnections,type CoachChatConnection} from './coach-chats-data'
import {openCoachMessages} from './coach-messages-view'
import {html} from './match-details'

/** One connection read on first mount, then explicit refresh; no message prefetch or polling. */
export function createCoachChatsInbox(client:SupabaseClient,owner:string,current:()=>boolean){
 const element=document.createElement('section');element.className='chats-coach-inbox';element.setAttribute('aria-label','Coach & player conversations')
 let disposed=false,started=false,busy=false,epoch=0,query='',notice='',more=false,connections:CoachChatConnection[]=[]
 let conversation:ReturnType<typeof openCoachMessages>|null=null
 const active=()=>!disposed&&current(),find=(value:string)=>value.normalize('NFKC').toLocaleLowerCase().trim()
 const paintRows=()=>{
  const rows=element.querySelector<HTMLElement>('[data-coach-chat-rows]')!;rows.replaceChildren()
  const visible=connections.filter(c=>find(c.name+' '+(c.role==='coach'?'Your player':'Your coach')).includes(find(query)))
  for(const connection of visible){
   const item=document.createElement('li'),button=document.createElement('button');button.type='button';button.className='secondary chats-team-card chats-coach-card';button.dataset.coachChat=connection.id
   button.innerHTML=`<span class="chats-team-avatar" aria-hidden="true">${html(connection.name.trim().split(/\s+/).slice(0,2).map(word=>Array.from(word)[0]).join('').toLocaleUpperCase())}</span><span class="chats-team-copy"><strong>${html(connection.name)}</strong><span>${connection.role==='coach'?'Your player':'Your coach'}</span></span><span aria-hidden="true">›</span>`
   button.onclick=()=>{if(!active()||busy||conversation?.isOpen()||!element.isConnected||!button.isConnected||!connections.some(c=>c.id===connection.id))return
    conversation=openCoachMessages(client,owner,active,button,undefined,connection.id,()=>{
     conversation=null;if(!active()||!element.isConnected)return
     const target=Array.from(element.querySelectorAll<HTMLButtonElement>('[data-coach-chat]')).find(button=>button.dataset.coachChat===connection.id)
     ;(target||element.querySelector<HTMLElement>('h2'))?.focus({preventScroll:true})
    })
   };item.append(button);rows.append(item)
  }
  element.querySelector('[data-coach-chat-status]')!.textContent=notice||(!connections.length?'Your active coach connections will appear here.':!visible.length?'No conversations match your search.':more?'Showing your latest 100 connections.':'')
 }
 const render=()=>{
  element.innerHTML=`<div class="chats-section-heading"><h2 tabindex="-1">Coach &amp; player</h2><button type="button" class="secondary" data-coach-chat-refresh aria-label="Refresh conversations" ${busy?'disabled':''}>Refresh</button></div><p class="rating-context">Private conversations</p><label ${connections.length?'':'hidden'}>Find a conversation<input type="search" data-coach-chat-search maxlength="160" placeholder="Name" autocomplete="off" value="${html(query)}"></label><p role="status" data-coach-chat-status></p><ul class="chats-team-list" data-coach-chat-rows></ul>`
  element.querySelector('[data-coach-chat-refresh]')!.addEventListener('click',()=>void refresh())
  element.querySelector<HTMLInputElement>('[data-coach-chat-search]')!.addEventListener('input',event=>{query=(event.target as HTMLInputElement).value.slice(0,160);paintRows()})
  paintRows()
 }
 const refresh=async()=>{
  if(!active()||busy||conversation?.isOpen())return
  const restoreFocus=element.contains(document.activeElement),version=++epoch;busy=true;connections=[];notice='Loading conversations…';render()
  try{const result=await loadCoachChatConnections(client,owner,active);if(!active()||version!==epoch)return;connections=result.connections;more=result.more;notice=''}
  catch{if(active()&&version===epoch)notice='Coach conversations are unavailable. Refresh to try again.'}
  finally{if(active()&&version===epoch){busy=false;render();if(restoreFocus&&element.isConnected)element.querySelector<HTMLButtonElement>('[data-coach-chat-refresh]')?.focus({preventScroll:true})}}
 }
 return {
  mount(host:HTMLElement){if(!active())return;host.append(element);if(!started){started=true;void refresh()}},
  isOpen:()=>Boolean(conversation?.isOpen()),
  back(){if(!conversation?.isOpen())return false;conversation.back();return true},
  dispose(){disposed=true;epoch++;conversation?.dispose();conversation=null;connections=[];query='';element.replaceChildren();element.remove()},
 }
}
