import type {SupabaseClient} from '@supabase/supabase-js'
import {coachChatInitials,loadCoachChatConnections,type CoachChatConnection} from './coach-chats-data'
import {openCoachMessages} from './coach-messages-view'
import {openCoachConnection} from './coach-connection-view'
import {chatsFilterFeedbackHtml,chatsFilterStatus,chatsStartActionHtml} from './chats-inbox'
import type {ChatUnread} from './chat-unread'
import {coachInboxKey} from './chat-inbox-order'
import {nativeActionIcon} from './native-action-icons'
import {firstPartyBuild} from './build-scope'

export type CoachInboxSearch = {
 connections: CoachChatConnection[]
 status: 'loading'|'ready'|'unavailable'
 more: boolean
}

/** Refresh the authorized connection list on mount and on request. */
export function createCoachChatsInbox(client:SupabaseClient,owner:string,current:()=>boolean,getCounts:()=>ChatUnread|null=()=>null,refreshCounts:()=>void=()=>{},searchChanged:()=>void=()=>{}){
 const element=document.createElement('section');element.className='native-section-group chats-coach-inbox';element.setAttribute('aria-label','Coach & player conversations')
 let disposed=false,started=false,busy=false,epoch=0,query='',notice='',more=false,unreadOnly=false,filtersOpen=false,connections:CoachChatConnection[]=[],summary=getCounts()
 let conversation:ReturnType<typeof openCoachMessages>|null=null
 let pinnedKeys:readonly string[]=[],togglePin:((key:string)=>void)|undefined
 let invitation:ReturnType<typeof openCoachConnection>|null=null
 const active=()=>!disposed&&current(),find=(value:string)=>value.normalize('NFKC').toLocaleLowerCase().trim()
 const overlayOpen=()=>Boolean(conversation?.isOpen()||invitation?.isOpen())
 const unread=(id:string)=>summary?.owner===owner&&summary.coach?.available?summary.coach.connections.find(c=>c.id===id)?.unread:undefined
 const filterTarget=()=>{
  const filters=element.querySelector<HTMLDetailsElement>('[data-coach-chat-filters]')
  if(!filters||filters.hidden)return element.querySelector<HTMLElement>('h2')
  const selector=filters.open?'[data-coach-filter="'+(unreadOnly?'unread':'all')+'"]':'summary'
  return filters.querySelector<HTMLElement>(selector)
 }
 function openConnection(id:string,trigger:HTMLButtonElement){
  if(!active()||busy||overlayOpen()||!trigger.isConnected||!connections.some(connection=>connection.id===id))return
  conversation=openCoachMessages(client,owner,active,trigger,undefined,id,()=>{
   conversation=null
   if(!active()||!element.isConnected)return
   const key=coachInboxKey(id)
   const visibleRow=Array.from(document.querySelectorAll<HTMLButtonElement>('[data-organized-open],[data-coach-chat]'))
    .find(button=>(button.dataset.focusKey===key||button.dataset.coachChat===id)&&button.getClientRects().length)
   const returnFocus=trigger.isConnected&&trigger.getClientRects().length?trigger:visibleRow??filterTarget()
   returnFocus?.focus({preventScroll:true})
   if(firstPartyBuild)refreshCounts()
  },refreshCounts)
 }
 const paintRows=()=>{
  const rows=element.querySelector<HTMLElement>('[data-coach-chat-rows]');if(!rows)return
  const term=find(query)
  const matching=connections.filter(c=>!pinnedKeys.includes(coachInboxKey(c.id))&&find(c.name+' '+(c.role==='coach'?'Your player':'Your coach')).includes(term))
  const unknown=matching.some(c=>unread(c.id)===undefined)
  const visible=unreadOnly?matching.filter(c=>Boolean(unread(c.id))):matching
  const keep=new Set(visible.map(c=>c.id));let lostFocus=false
  for(const row of rows.querySelectorAll<HTMLElement>('[data-coach-chat-row]'))if(!keep.has(row.dataset.coachChatRow!)){
   lostFocus||=!pinnedKeys.includes(coachInboxKey(row.dataset.coachChatRow!))&&row.contains(document.activeElement)
   row.remove()
  }
  for(const [index,connection] of visible.entries()){
   let row=Array.from(rows.children).find(row=>(row as HTMLElement).dataset.coachChatRow===connection.id) as HTMLLIElement|undefined
   if(!row){
    row=document.createElement('li');row.dataset.coachChatRow=connection.id
    row.className=firstPartyBuild?'chat-organized-row':'chat-organized-row chat-organized-row-single'
    const button=document.createElement('button');button.type='button';button.className='secondary chats-team-card chats-coach-card';button.dataset.coachChat=connection.id
    button.innerHTML='<span class="chats-team-avatar" aria-hidden="true"></span><span class="chats-team-copy"><strong data-coach-name></strong><span data-coach-role></span></span><span class="chat-unread-badge chat-coach-unread" data-coach-unread aria-hidden="true" hidden></span><span aria-hidden="true">›</span>'
    button.onclick=()=>openConnection(connection.id,button);row.append(button)
    if(firstPartyBuild){
     const key=coachInboxKey(connection.id),pin=document.createElement('button')
     button.dataset.focusKey=key
     pin.type='button';pin.className='secondary chat-pin';pin.setAttribute('data-organized-pin','')
     pin.dataset.focusKey=key;pin.setAttribute('aria-pressed','false');pin.innerHTML=nativeActionIcon('pin')
     pin.onclick=()=>{if(active()&&row?.isConnected&&!busy)togglePin?.(key)}
     row.append(pin)
    }
   }
   if(rows.children[index]!==row)rows.insertBefore(row,rows.children[index]||null)
   const button=row.querySelector<HTMLButtonElement>('button')!,count=unread(connection.id),role=connection.role==='coach'?'Your player':'Your coach'
   button.querySelector('.chats-team-avatar')!.textContent=coachChatInitials(connection.name)
   row.querySelector('[data-organized-pin]')?.setAttribute('aria-label','Pin '+connection.name)
   button.querySelector('[data-coach-name]')!.textContent=connection.name;button.querySelector('[data-coach-role]')!.textContent=role
   const badge=button.querySelector<HTMLElement>('[data-coach-unread]')!;badge.hidden=!count;badge.textContent=count===100?'99+':String(count||'')
   button.setAttribute('aria-label',connection.name+', '+role+(count===undefined?', unread count unavailable':', '+(count===100?'99+':count)+' unread messages'))
  }
  element.querySelectorAll<HTMLButtonElement>('[data-coach-filter]').forEach(button=>button.setAttribute('aria-pressed',String((button.dataset.coachFilter==='unread')===unreadOnly)))
  const hideClear=!connections.length||(!term&&!unreadOnly)
  element.querySelector<HTMLElement>('[data-coach-filter-active]')!.hidden=hideClear
  element.querySelector<HTMLButtonElement>('[data-clear-chat-filters]')!.hidden=hideClear
  const filtered=connections.length?chatsFilterStatus('coach',term,unreadOnly,matching.length,visible.length,unknown):''
  const message=notice||filtered||(unknown?'Unread counts unavailable for some conversations. Refresh to try again.':more?'Showing your latest 100 connections.':'')
  const status=element.querySelector('[data-coach-chat-status]')!
  if(status.textContent!==message)status.textContent=message
  if(lostFocus&&element.isConnected)filterTarget()?.focus({preventScroll:true})
 }
 const render=()=>{
  element.innerHTML=`<div class="chats-section-heading"><h2 tabindex="-1">Coach &amp; player</h2><button type="button" class="secondary" data-coach-chat-refresh aria-label="Refresh conversations">Refresh</button></div>
   <details class="chats-filter-drawer" data-coach-chat-filters>
    <summary>Search &amp; filter conversations<span class="chats-filter-active" data-coach-filter-active hidden>Active</span></summary>
    <div class="chats-inbox-tools">
     <label>Find a conversation<input type="search" data-coach-chat-search maxlength="160" placeholder="Name" autocomplete="off"></label>
     <div class="chats-inbox-filters" role="group" aria-label="Show coach conversations"><button type="button" class="secondary" data-coach-filter="all" aria-pressed="true">All</button><button type="button" class="secondary" data-coach-filter="unread" aria-pressed="false">Unread</button></div>
    </div>
   </details>
   ${chatsFilterFeedbackHtml('coach')}
   <ul class="chats-team-list" data-coach-chat-rows></ul>
   ${!busy&&!notice&&!connections.length?chatsStartActionHtml('coach'):''}`
  element.querySelector<HTMLButtonElement>('[data-coach-chat-refresh]')!.disabled=busy
  const filters=element.querySelector<HTMLDetailsElement>('[data-coach-chat-filters]')!
  filters.hidden=!connections.length
  filters.open=filtersOpen
  filters.addEventListener('toggle',()=>{if(filters.isConnected)filtersOpen=filters.open})
  element.querySelector('[data-coach-chat-refresh]')!.addEventListener('click',()=>void refresh(true))
  const invite=element.querySelector<HTMLButtonElement>('[data-chats-coach-invite]')
  if(invite)invite.onclick=()=>{
   if(!active()||overlayOpen()||!invite.isConnected)return
   invite.focus({preventScroll:true})
   invitation=openCoachConnection(client,owner,active,invite,undefined,'',{
    connectedMessage:'Close this invitation to see your coach in Chats.',
    onClose:connected=>{
     invitation=null
     if(connected&&element.isConnected)void refresh(true)
    },
   })
  }
  const input=element.querySelector<HTMLInputElement>('[data-coach-chat-search]')!;input.value=query;input.addEventListener('input',()=>{query=input.value.slice(0,160);paintRows()})
  element.querySelector<HTMLButtonElement>('[data-clear-chat-filters]')!.onclick=()=>{
   if(!active()||busy||!element.isConnected)return
   query=input.value=''
   unreadOnly=false
   paintRows()
   filterTarget()?.focus()
  }
  element.querySelectorAll<HTMLButtonElement>('[data-coach-filter]').forEach(button=>button.addEventListener('click',()=>{unreadOnly=button.dataset.coachFilter==='unread';paintRows()}))
  paintRows()
 }
 const refresh=async(checkCounts=false)=>{
  if(!active()||busy||overlayOpen())return
  if(checkCounts)refreshCounts()
  const restoreFocus=element.contains(document.activeElement),version=++epoch;busy=true;notice='Loading conversations…';render()
  searchChanged()
  try{const result=await loadCoachChatConnections(client,owner,active);if(!active()||version!==epoch)return;connections=result.connections;more=result.more;notice=''}
  catch{if(active()&&version===epoch){connections=[];notice='Coach conversations are unavailable. Refresh to try again.'}}
  finally{if(active()&&version===epoch){busy=false;render();searchChanged();if(restoreFocus&&element.isConnected)element.querySelector<HTMLButtonElement>('[data-coach-chat-refresh]')?.focus({preventScroll:true})}}
 }
 return {
  mount(host:HTMLElement){if(!active())return;host.append(element);if(!started){started=true;void refresh()}},
  update(value:ChatUnread|null){if(!active())return;summary=value?.owner===owner?value:null;paintRows()},
  setPins(keys:readonly string[],toggle:(key:string)=>void){
   togglePin=toggle
   if(pinnedKeys===keys)return
   pinnedKeys=keys
   paintRows()
  },
  searchSnapshot():CoachInboxSearch{return {connections,status:busy||!started?'loading':notice?'unavailable':'ready',more}},
  openConnection,
  refresh,
  isOpen:overlayOpen,
  back(){if(invitation?.isOpen())return invitation.back();if(!conversation?.isOpen())return false;conversation.back();return true},
  dispose(){disposed=true;epoch++;conversation?.dispose();conversation=null;invitation?.dispose();invitation=null;connections=[];summary=null;query='';element.replaceChildren();element.remove()},
 }
}
