import type {SupabaseClient} from '@supabase/supabase-js'
import {loadCoachChatConnections,type CoachChatConnection} from './coach-chats-data'
import {openCoachMessages} from './coach-messages-view'
import type {ChatUnread} from './chat-unread'

/** One connection read on first mount, then explicit refresh; no message prefetch or polling. */
export function createCoachChatsInbox(client:SupabaseClient,owner:string,current:()=>boolean,getCounts:()=>ChatUnread|null=()=>null,refreshCounts:()=>void=()=>{}){
 const element=document.createElement('section');element.className='chats-coach-inbox';element.setAttribute('aria-label','Coach & player conversations')
 let disposed=false,started=false,busy=false,epoch=0,query='',notice='',more=false,unreadOnly=false,connections:CoachChatConnection[]=[],summary=getCounts()
 let conversation:ReturnType<typeof openCoachMessages>|null=null
 const active=()=>!disposed&&current(),find=(value:string)=>value.normalize('NFKC').toLocaleLowerCase().trim()
 const unread=(id:string)=>summary?.owner===owner&&summary.coach?.available?summary.coach.connections.find(c=>c.id===id)?.unread:undefined
 const paintRows=()=>{
  const rows=element.querySelector<HTMLElement>('[data-coach-chat-rows]');if(!rows)return
  const unknown=connections.some(c=>unread(c.id)===undefined)
  const visible=connections.filter(c=>find(c.name+' '+(c.role==='coach'?'Your player':'Your coach')).includes(find(query))&&(!unreadOnly||Boolean(unread(c.id))))
  const keep=new Set(visible.map(c=>c.id));let lostFocus=false
  for(const row of rows.querySelectorAll<HTMLElement>('[data-coach-chat-row]'))if(!keep.has(row.dataset.coachChatRow!)){lostFocus||=row.contains(document.activeElement);row.remove()}
  for(const [index,connection] of visible.entries()){
   let row=Array.from(rows.children).find(row=>(row as HTMLElement).dataset.coachChatRow===connection.id) as HTMLLIElement|undefined
   if(!row){
    row=document.createElement('li');row.dataset.coachChatRow=connection.id
    const button=document.createElement('button');button.type='button';button.className='secondary chats-team-card chats-coach-card';button.dataset.coachChat=connection.id
    button.innerHTML='<span class="chats-team-avatar" aria-hidden="true"></span><span class="chats-team-copy"><strong data-coach-name></strong><span data-coach-role></span></span><span class="chat-unread-badge chat-coach-unread" data-coach-unread aria-hidden="true" hidden></span><span aria-hidden="true">›</span>'
    button.onclick=()=>{if(!active()||busy||conversation?.isOpen()||!element.isConnected||!button.isConnected||!connections.some(c=>c.id===connection.id))return
     conversation=openCoachMessages(client,owner,active,button,undefined,connection.id,()=>{
      conversation=null;if(!active()||!element.isConnected)return
      const target=Array.from(element.querySelectorAll<HTMLButtonElement>('[data-coach-chat]')).find(button=>button.dataset.coachChat===connection.id)
      ;(target||element.querySelector<HTMLElement>('[data-coach-filter="'+(unreadOnly?'unread':'all')+'"]')||element.querySelector<HTMLElement>('h2'))?.focus({preventScroll:true})
     },refreshCounts)
    };row.append(button)
   }
   if(rows.children[index]!==row)rows.insertBefore(row,rows.children[index]||null)
   const button=row.querySelector<HTMLButtonElement>('button')!,count=unread(connection.id),role=connection.role==='coach'?'Your player':'Your coach'
   button.querySelector('.chats-team-avatar')!.textContent=connection.name.trim().split(/\s+/).slice(0,2).map(word=>Array.from(word)[0]).join('').toLocaleUpperCase()
   button.querySelector('[data-coach-name]')!.textContent=connection.name;button.querySelector('[data-coach-role]')!.textContent=role
   const badge=button.querySelector<HTMLElement>('[data-coach-unread]')!;badge.hidden=!count;badge.textContent=count===100?'99+':String(count||'')
   button.setAttribute('aria-label',connection.name+', '+role+(count===undefined?', unread count unavailable':', '+(count===100?'99+':count)+' unread messages'))
  }
  element.querySelectorAll<HTMLButtonElement>('[data-coach-filter]').forEach(button=>button.setAttribute('aria-pressed',String((button.dataset.coachFilter==='unread')===unreadOnly)))
  element.querySelector('[data-coach-chat-status]')!.textContent=notice||(!connections.length?'Your active coach connections will appear here.':unknown?'Unread counts unavailable for some conversations. Refresh to try again.':!visible.length?(query?'No conversations match your search.':unreadOnly?'You’re all caught up.':'No conversations to show.'):more?'Showing your latest 100 connections.':'')
  if(lostFocus&&element.isConnected)element.querySelector<HTMLElement>('[data-coach-filter="'+(unreadOnly?'unread':'all')+'"]')?.focus({preventScroll:true})
 }
 const render=()=>{
  element.innerHTML='<div class="chats-section-heading"><h2 tabindex="-1">Coach &amp; player</h2><button type="button" class="secondary" data-coach-chat-refresh aria-label="Refresh conversations">Refresh</button></div><p class="rating-context">Private conversations</p><label data-coach-search-label>Find a conversation<input type="search" data-coach-chat-search maxlength="160" placeholder="Name" autocomplete="off"></label><div class="chats-inbox-filters" role="group" aria-label="Show coach conversations"><button type="button" class="secondary" data-coach-filter="all" aria-pressed="true">All</button><button type="button" class="secondary" data-coach-filter="unread" aria-pressed="false">Unread</button></div><p role="status" data-coach-chat-status></p><ul class="chats-team-list" data-coach-chat-rows></ul>'
  element.querySelector<HTMLButtonElement>('[data-coach-chat-refresh]')!.disabled=busy
  element.querySelector<HTMLElement>('[data-coach-search-label]')!.hidden=!connections.length
  element.querySelector<HTMLElement>('[aria-label="Show coach conversations"]')!.hidden=!connections.length
  element.querySelector('[data-coach-chat-refresh]')!.addEventListener('click',()=>void refresh(true))
  const input=element.querySelector<HTMLInputElement>('[data-coach-chat-search]')!;input.value=query;input.addEventListener('input',()=>{query=input.value.slice(0,160);paintRows()})
  element.querySelectorAll<HTMLButtonElement>('[data-coach-filter]').forEach(button=>button.addEventListener('click',()=>{unreadOnly=button.dataset.coachFilter==='unread';paintRows()}))
  paintRows()
 }
 const refresh=async(checkCounts=false)=>{
  if(!active()||busy||conversation?.isOpen())return
  if(checkCounts)refreshCounts()
  const restoreFocus=element.contains(document.activeElement),version=++epoch;busy=true;connections=[];notice='Loading conversations…';render()
  try{const result=await loadCoachChatConnections(client,owner,active);if(!active()||version!==epoch)return;connections=result.connections;more=result.more;notice=''}
  catch{if(active()&&version===epoch)notice='Coach conversations are unavailable. Refresh to try again.'}
  finally{if(active()&&version===epoch){busy=false;render();if(restoreFocus&&element.isConnected)element.querySelector<HTMLButtonElement>('[data-coach-chat-refresh]')?.focus({preventScroll:true})}}
 }
 return {
  mount(host:HTMLElement){if(!active())return;host.append(element);if(!started){started=true;void refresh()}},
  update(value:ChatUnread|null){if(!active())return;summary=value?.owner===owner?value:null;paintRows()},
  isOpen:()=>Boolean(conversation?.isOpen()),
  back(){if(!conversation?.isOpen())return false;conversation.back();return true},
  dispose(){disposed=true;epoch++;conversation?.dispose();conversation=null;connections=[];summary=null;query='';element.replaceChildren();element.remove()},
 }
}
