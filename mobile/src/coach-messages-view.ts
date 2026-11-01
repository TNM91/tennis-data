import type {SupabaseClient} from '@supabase/supabase-js'
import {CapacitorHttp,Capacitor,type PluginListenerHandle} from '@capacitor/core'
import {App} from '@capacitor/app'
import {scenarioOwner} from './captain-scenarios-data'
import {coachId,coachRecord} from '../../lib/native-coach-contract'
import {html} from './match-details'
import type {CoachSend} from './coach-workspace-data'
import {readCoachChatConnections,markCoachChatRead} from './coach-chats-data'
import {createCoachMessageChangeTracker,watchCoachMessageCounts} from './coach-message-catchup'
import type {ChatUnread} from './chat-unread'
import {coachMessageHistory,coachMessageRanges,coachMessageText,type CoachHistoryMessage} from './coach-message-history'
import {createCoachAutoCatchup} from './coach-auto-catchup'
import {openChatLink} from './chat-links'
import {readAppLink} from './app-links'
import './coach-premium.css'
type ChatMessage=CoachHistoryMessage
class CoachAutoCatchupCancelled extends Error{}
export function openCoachMessages(client:SupabaseClient,owner:string,current:()=>boolean,trigger?:HTMLElement,send?:CoachSend,initialStudent?:string,onClose?:()=>void,onRead?:()=>void){
 const dialog=document.createElement('dialog');dialog.className='native-coach-screen coach-messages-screen';dialog.setAttribute('aria-label','Coach messages')
 let disposed=false,busy=false,selected='',notice='',text='',leaving=false,leaveAction:(()=>void)|null=null,pending:{id:string;body:string}|null=null,messages:ChatMessage[]=[],connections:{id:string;name:string}[]=[],more=false,checked=false
 let readPending=false,readTried='',readNotice='',nativeActive=true,readObserver:IntersectionObserver|null=null,appHandle:PluginListenerHandle|null=null
 let summary:ChatUnread|null=null,refreshing=false,stopCounts=()=>{},refreshFocus:HTMLTextAreaElement|null=null
 let searching=false,query='',matchId='',searchReturn:HTMLElement|null=null
 let link:ReturnType<typeof openChatLink>|null=null
 const changes=createCoachMessageChangeTracker()
 const active=()=>!disposed&&current(),focus=()=>dialog.querySelector<HTMLElement>('h1')?.focus({preventScroll:true})
 const nearLatest=()=>{
  const last=dialog.querySelector<HTMLElement>('[data-coach-message-id]:last-child');if(!last)return false
  const bounds=last.getBoundingClientRect(),viewport=dialog.getBoundingClientRect(),top=Math.max(0,viewport.top,dialog.querySelector('header')?.getBoundingClientRect().bottom||0)
  return bounds.height>0&&bounds.bottom<=Math.min(innerHeight,viewport.bottom)+4&&(bounds.bottom>top||dialog.scrollHeight-dialog.scrollTop-dialog.clientHeight<=64)
 }
 // WebKit rounds scroll offsets; following tolerates four pixels, while reads stay strict.
 const scrollLatest=()=>{
  const last=dialog.querySelector<HTMLElement>('[data-coach-message-id]:last-child');if(!last)return null
  last.scrollIntoView({block:'end',behavior:'instant'})
  const overflow=last.getBoundingClientRect().bottom-Math.min(innerHeight,dialog.getBoundingClientRect().bottom)
  if(overflow>0)dialog.scrollTop+=Math.ceil(overflow)
  return last
 }
 const canAutoLoad=()=>active()&&dialog.isConnected&&Boolean(selected)&&!pending&&!leaving&&!searching&&!link?.isOpen()&&nativeActive&&document.visibilityState==='visible'&&summary?.owner===owner&&summary.coach?.available===true&&summary.coach.connections.some(connection=>connection.id===selected)&&nearLatest()
 const autoCatchup=createCoachAutoCatchup(()=>!busy&&canAutoLoad(),()=>run(false,true,true))
 const dispose=()=>{if(disposed)return;disposed=true;link?.dispose();link=null;autoCatchup.dispose();stopCounts();summary=null;refreshFocus=null;searchReturn=null;query='';matchId='';readObserver?.disconnect();readObserver=null;document.removeEventListener('visibilitychange',readVisibility);void appHandle?.remove();pending=null;messages=[];connections=[];text='';dialog.close();dialog.remove();if(current()){if(trigger?.isConnected)trigger.focus({preventScroll:true});onClose?.()}}
 const requestLeave=(next?:()=>void)=>{if(busy&&!refreshing)return;if(text||pending){leaving=true;leaveAction=()=>{dispose();next?.()};render();focus()}else{dispose();next?.()}}
 const back=()=>{if(link?.isOpen())link.dispose();else if(leaving){leaving=false;render()}else if(searching)closeSearch();else requestLeave();return true}
 const request=async(write:boolean,automatic=false)=>{
  const session=await scenarioOwner(client,owner,active)
  if(automatic){
   if(Capacitor.isNativePlatform()){try{nativeActive=(await App.getState()).isActive}catch{throw new CoachAutoCatchupCancelled()}}
   if(!canAutoLoad())throw new CoachAutoCatchupCancelled()
  }
  const options={url:'https://www.tenaceiq.com/api/mobile/coach/messages'+(selected?'?'+new URLSearchParams({student:coachId(selected),...(pending?{message:pending.id}:{})}):''),headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json','Cache-Control':'no-store'},disableRedirects:true,responseType:'json' as const,webFetchExtra:{cache:'no-store' as const},connectTimeout:12000,readTimeout:30000,...(write&&pending?{data:pending}:{})};const r=send?await send(write?'POST':'GET',options):write?await CapacitorHttp.post(options):await CapacitorHttp.get(options);await scenarioOwner(client,owner,active);const body=coachRecord(r.data);if(r.status!==200||body.ok!==true||body.owner!==owner||JSON.stringify(body).length>500000)throw Error('Messages could not be confirmed. Refresh before trying again.');return body}
 const run=async(write=false,preserve=false,automatic=false)=>{
  if(!active()||busy||write&&pending&&!checked)return
  if(!write&&!automatic){readTried='';readNotice=''}
  const stable=preserve&&!write&&!pending&&!leaving&&Boolean(selected&&dialog.querySelector('[data-chat-form]'))
  const originalFocus=stable&&refreshFocus?refreshFocus:dialog.contains(document.activeElement)?document.activeElement as HTMLElement:null,ticket=changes.ticket()
  refreshFocus=null
  if(selected)autoCatchup.started(selected+':'+ticket)
  busy=true;refreshing=stable;let follow=false
  notice=write?'Sending message…':automatic?'Updating conversation…':'Refreshing messages…'
  if(stable)paintActivity();else render()
  try{
   const reply=await request(write,automatic);if(!active())return
   if(!selected){
    connections=readCoachChatConnections(reply,owner).connections
    selected=initialStudent?(connections.some(c=>c.id===initialStudent)?initialStudent:''):connections[0]?.id||''
    follow=!!selected;notice=selected?'':initialStudent?'This conversation is no longer available. Choose a current connection.':'No active coach connections yet.'
   }else{
    if(reply.student!==selected||!Array.isArray(reply.messages)||reply.messages.length>100)throw Error()
    messages=reply.messages;more=reply.more===true;changes.loaded(ticket)
    const hit=reply.checked as ChatMessage|null
    if(pending&&hit?.id===pending.id&&hit.mine&&hit.body===pending.body){pending=null;text='';notice='Message sent.'}
    else if(pending){checked=true;notice='This message was not found. Retry the same message or discard it.'}else notice=automatic?'Conversation updated.':''
   }
  }catch(error){if(active()){if(error instanceof CoachAutoCatchupCancelled)notice='';else{checked=false;notice=error instanceof Error?error.message:'Messages are unavailable.'}}}
  finally{
   if(active()){
    busy=false;refreshing=false
    if(stable&&!leaving&&dialog.querySelector('[data-chat-form]')){
     const followLatest=automatic&&canAutoLoad()&&document.activeElement!==dialog.querySelector('[name=body]')
     preservePosition(()=>{dialog.querySelector('.coach-direct-history')!.innerHTML=history();dialog.querySelector('[data-coach-history-hint]')!.textContent=more?'Latest 100 messages':'Private coach and player messages';paintSearch();paintActivity();observeRead()})
     if(originalFocus&&(!document.activeElement||document.activeElement===document.body||document.activeElement===dialog||document.activeElement===originalFocus)){
      if(originalFocus.isConnected&&!originalFocus.closest('[hidden]'))originalFocus.focus({preventScroll:true})
      else{
       const messageId=originalFocus.closest<HTMLElement>('[data-coach-message-id]')?.dataset.coachMessageId,sameMessage=messageId?Array.from(dialog.querySelectorAll<HTMLElement>('[data-coach-message-id]')).find(item=>item.dataset.coachMessageId===messageId):null
       const sameLink=originalFocus.dataset.coachMessageUrl&&sameMessage?Array.from(sameMessage.querySelectorAll<HTMLButtonElement>('[data-coach-message-url]')).find(item=>item.dataset.coachMessageUrl===originalFocus.dataset.coachMessageUrl):null
       const target=sameLink||sameMessage||dialog.querySelector<HTMLElement>(text?'[name=body]':'h1');target?.focus({preventScroll:true})
      }
     }
     if(followLatest){scrollLatest();void maybeRead()}
    }else{render();if(follow)void run();else focus()}
   }
  }
 }
 const paintReadNotice=()=>{const target=dialog.querySelector<HTMLElement>('[data-coach-read-notice]');if(target){target.textContent=readNotice;target.hidden=!readNotice}}
 const maybeRead=async()=>{
  const last=messages.at(-1),student=selected
  if(!active()||readPending||busy||leaving||searching||link?.isOpen()||!nativeActive||document.visibilityState!=='visible'||!last||!student||!dialog.isConnected||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(last.id))return
  const key=student+':'+last.id;if(readTried===key)return
  const item=Array.from(dialog.querySelectorAll<HTMLElement>('[data-coach-message-id]')).find(item=>item.dataset.coachMessageId===last.id);if(!item)return
  const bounds=item.getBoundingClientRect(),viewport=dialog.getBoundingClientRect(),bottom=Math.min(innerHeight,viewport.bottom),top=Math.max(0,viewport.top,dialog.querySelector('header')?.getBoundingClientRect().bottom||0)
  if(bounds.height<=0||bounds.bottom>bottom+1||bounds.bottom<=top||bounds.top>=bottom)return
  readPending=true;readTried=key
  try{
   if(Capacitor.isNativePlatform()){nativeActive=(await App.getState()).isActive;if(!nativeActive){readTried='';return}}
   if(link?.isOpen()){readTried='';return}
   if(!active()||selected!==student||document.visibilityState!=='visible')return
   await markCoachChatRead(client,owner,()=>active()&&selected===student&&!link?.isOpen(),student,last.id,send)
   if(active()&&selected===student){readNotice='';onRead?.()}
  }catch{if(active()&&selected===student)readNotice='Couldn’t update your read status. Refresh messages to try again.'}
  finally{readPending=false;if(active()){paintReadNotice();if(selected+':'+(messages.at(-1)?.id||'')!==readTried)void maybeRead()}}
 }
 const readVisibility=()=>{paintCatchup();if(document.visibilityState==='visible')void maybeRead()}
 const history=()=>coachMessageHistory(messages,connections.find(c=>c.id===selected)?.name||'Coach',searching?query:'')
 const preservePosition=(change:()=>void)=>{
  const body=dialog.querySelector('.coach-premium-body'),focused=document.activeElement as HTMLElement|null,top=dialog.querySelector('header')?.getBoundingClientRect().bottom||0
  const anchor=focused&&body?.contains(focused)?focused.closest<HTMLElement>('[data-coach-message-id]')||focused:Array.from(dialog.querySelectorAll<HTMLElement>('[data-coach-message-id]')).find(item=>{const b=item.getBoundingClientRect();return b.bottom>top&&b.top<innerHeight})
  const id=anchor?.dataset.coachMessageId,before=anchor?.getBoundingClientRect().top,scroll=dialog.scrollTop
  change()
  const after=anchor?.isConnected?anchor:id?Array.from(dialog.querySelectorAll<HTMLElement>('[data-coach-message-id]')).find(item=>item.dataset.coachMessageId===id):null
  if(before!==undefined&&after)dialog.scrollTop+=after.getBoundingClientRect().top-before
  else dialog.scrollTop=scroll
 }
 const paintSearch=()=>{
  const panel=dialog.querySelector<HTMLElement>('[data-coach-search-panel]');if(!panel)return
  const matches=messages.filter(message=>coachMessageRanges(message.body,query).length>0)
  if(!matches.some(message=>message.id===matchId))matchId=''
  panel.hidden=!searching||leaving
  dialog.querySelector('[data-coach-search-toggle]')?.setAttribute('aria-expanded',String(searching&&!leaving))
  const index=matches.findIndex(message=>message.id===matchId),status=panel.querySelector('[data-coach-search-status]')!
  const label=!query.trim()?'Search the messages loaded in this conversation.':!matches.length?'No matches in loaded messages.':index<0?`${matches.length} matching ${matches.length===1?'message':'messages'}`:`${index+1} of ${matches.length} matching ${matches.length===1?'message':'messages'}`
  if(status.textContent!==label)status.textContent=label
  panel.querySelector('[data-coach-search-scope]')!.textContent=more?'Searching the latest 100 messages.':'Searching loaded messages only.'
  panel.querySelectorAll<HTMLButtonElement>('[data-coach-search-step]').forEach(button=>{button.disabled=!matches.length})
  for(const item of dialog.querySelectorAll<HTMLElement>('[data-coach-message-id]')){
   const message=messages.find(message=>message.id===item.dataset.coachMessageId);if(!message)continue
   item.querySelector('[data-coach-message-text]')!.innerHTML=coachMessageText(message.body,searching?query:'')
   item.classList.toggle('is-search-current',searching&&message.id===matchId)
  }
 }
 const closeSearch=(restore=true)=>{
  if(!searching)return
  preservePosition(()=>{searching=false;query='';matchId='';const input=dialog.querySelector<HTMLInputElement>('[data-coach-search-input]');if(input)input.value='';paintSearch()})
  if(restore){const target=searchReturn?.isConnected&&!searchReturn.closest('[hidden]')?searchReturn:dialog.querySelector<HTMLElement>('[data-coach-search-toggle]');target?.focus({preventScroll:true})}
  searchReturn=null;paintCatchup();void maybeRead()
 }
 const searchStep=(direction:number)=>{
  const matches=messages.filter(message=>coachMessageRanges(message.body,query).length>0);if(!matches.length)return
  const currentIndex=matches.findIndex(message=>message.id===matchId)
  matchId=matches[currentIndex<0?(direction>0?0:matches.length-1):(currentIndex+direction+matches.length)%matches.length].id
  paintSearch()
  const item=Array.from(dialog.querySelectorAll<HTMLElement>('[data-coach-message-id]')).find(item=>item.dataset.coachMessageId===matchId)
  item?.scrollIntoView({block:'start',behavior:'instant'})
  if(item)dialog.scrollTop-=dialog.querySelector('header')?.getBoundingClientRect().height||0
 }
 const jumpLatest=()=>{
  closeSearch(false)
  const last=scrollLatest();if(!last)return
  last.focus({preventScroll:true});void maybeRead()
 }
 const paintCatchup=()=>{
  if(!active()||!dialog.isConnected)return
  const value=summary?.owner===owner&&summary.coach?.available?summary.coach.connections.find(c=>c.id===selected):undefined
  changes.update(selected,value)
  const banner=dialog.querySelector<HTMLElement>('[data-coach-catchup]');if(!banner)return
  const hidden=leaving||!selected||!changes.waiting()
  autoCatchup.signal(!hidden&&value?selected+':'+changes.ticket():null)
  banner.querySelector<HTMLButtonElement>('button')!.disabled=busy
  if(banner.hidden===hidden)return
  const restore=!banner.hidden&&hidden&&banner.contains(document.activeElement)
  preservePosition(()=>{banner.hidden=hidden;banner.querySelector('[data-coach-catchup-status]')!.textContent=hidden?'':'Conversation updated'})
  if(restore)dialog.querySelector<HTMLElement>(text?'[name=body]':'h1')?.focus({preventScroll:true})
 }
 const paintActivity=()=>{
  const status=dialog.querySelector<HTMLElement>('[data-coach-message-status]');if(status)status.textContent=notice
  const refresh=dialog.querySelector<HTMLButtonElement>('[data-refresh]');if(refresh)refresh.disabled=busy
  const select=dialog.querySelector<HTMLSelectElement>('[data-connection]');if(select)select.disabled=Boolean(busy||pending||text)
  const textarea=dialog.querySelector<HTMLTextAreaElement>('[name=body]');if(textarea)textarea.disabled=Boolean(pending||busy&&!refreshing)
  const submit=dialog.querySelector<HTMLButtonElement>('[data-chat-form] button[type=submit]');if(submit)submit.disabled=busy
  dialog.querySelectorAll<HTMLButtonElement>('[data-coach-message-url]').forEach(button=>{button.disabled=Boolean(pending||leaving)})
  dialog.querySelectorAll<HTMLButtonElement>('[data-coach-search-toggle],[data-coach-latest]').forEach(button=>{button.disabled=!selected||leaving||busy&&!refreshing})
  paintReadNotice();paintCatchup()
 }
 const observeRead=()=>{
  readObserver?.disconnect();readObserver=null
  const last=dialog.querySelector('[data-coach-message-id]:last-child')
  if(last&&typeof IntersectionObserver!=='undefined'){readObserver=new IntersectionObserver(()=>{void maybeRead()},{threshold:[0,0.5,1]});readObserver.observe(last)}
 }
 const render=()=>{if(!active())return;refreshFocus=null;readObserver?.disconnect();readObserver=null;dialog.innerHTML=`<header class="native-coach-header"><div><small>Private conversation</small><h1 tabindex="-1">Coach messages</h1></div><nav class="coach-conversation-actions" aria-label="Conversation tools"><button type="button" class="secondary" data-coach-search-toggle aria-expanded="false" aria-label="Find in conversation">Find</button><button type="button" class="secondary" data-coach-latest aria-label="Jump to latest messages">Latest</button><button class="secondary" data-close>Close</button></nav><form class="coach-conversation-search" data-coach-search-panel hidden role="search" aria-label="Find in conversation"><label for="coach-conversation-query">Find a message</label><div class="coach-search-input-row"><input id="coach-conversation-query" type="search" data-coach-search-input maxlength="120" value="${html(query)}" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Search messages"/><button type="button" class="secondary" data-coach-search-close aria-label="Close message search">Done</button></div><div class="coach-search-navigation"><p role="status" data-coach-search-status></p><div><button type="button" class="secondary" data-coach-search-step="-1" aria-label="Previous matching message">↑</button><button type="submit" class="secondary" data-coach-search-step="1" aria-label="Next matching message">↓</button></div></div><p data-coach-search-scope></p></form><aside class="coach-message-catchup" data-coach-catchup hidden><p role="status" data-coach-catchup-status></p><button type="button" class="secondary" data-coach-catchup-load aria-label="Load updated messages">Load</button></aside></header><div class="coach-premium-body">${leaving?'<section class="coach-decision"><h2>Leave this message?</h2><p>Your draft will be discarded. An interrupted send may already be saved; refresh this conversation before composing it again.</p><button data-keep>Keep writing</button><button class="secondary" data-discard>Discard and leave</button></section>':`<label>Conversation<select data-connection ${busy||pending||text?'disabled':''}><option value="">Choose a connection</option>${connections.map(c=>`<option value="${html(c.id)}" ${c.id===selected?'selected':''}>${html(c.name)}</option>`).join('')}</select></label><p data-coach-history-hint>${more?'Latest 100 messages':'Private coach and player messages'}</p><div class="coach-direct-history" aria-label="Conversation">${history()}</div>${selected?`<form data-chat-form><label>Message<textarea name="body" maxlength="4000" required ${busy||pending?'disabled':''}>${html(text)}</textarea></label>${pending?`<p>Send not confirmed. Refresh messages before retrying.</p><button type="button" data-retry ${busy||!checked?'disabled':''}>Retry same message</button><button type="button" class="secondary" data-clear ${busy?'disabled':''}>Discard pending message</button>`:`<button type="submit" ${busy?'disabled':''}>Send message</button>`}</form>`:''}`}<p role="status" data-coach-message-status>${html(notice)}</p><p role="status" data-coach-read-notice hidden></p><button class="secondary" data-refresh ${busy?'disabled':''}>Refresh messages</button></div>`
  dialog.querySelector('[data-close]')?.addEventListener('click',()=>requestLeave());dialog.querySelector('[data-keep]')?.addEventListener('click',()=>{leaving=false;render()});dialog.querySelector('[data-discard]')?.addEventListener('click',()=>leaveAction?.());dialog.querySelectorAll('[data-refresh],[data-coach-catchup-load]').forEach(button=>{button.addEventListener('pointerdown',()=>{const input=dialog.querySelector<HTMLTextAreaElement>('[name=body]');refreshFocus=document.activeElement===input?input:null});button.addEventListener('pointercancel',()=>{refreshFocus=null});button.addEventListener('keydown',()=>{refreshFocus=null});button.addEventListener('click',()=>void run(false,true))});dialog.querySelector('[data-retry]')?.addEventListener('click',()=>void run(true));dialog.querySelector('[data-clear]')?.addEventListener('click',()=>{pending=null;text='';checked=false;render()})
  dialog.querySelector<HTMLSelectElement>('[data-connection]')?.addEventListener('change',e=>{if(text||pending){(e.target as HTMLSelectElement).value=selected;notice='Send or discard this draft before switching conversations.';render();return}selected=(e.target as HTMLSelectElement).value;messages=[];searching=false;query='';matchId='';searchReturn=null;void run()});dialog.querySelector<HTMLTextAreaElement>('[name=body]')?.addEventListener('input',e=>{text=(e.target as HTMLTextAreaElement).value;paintActivity()});dialog.querySelector<HTMLFormElement>('[data-chat-form]')?.addEventListener('submit',e=>{e.preventDefault();if(!text.trim()||pending||busy)return;pending={id:crypto.randomUUID(),body:text.trim()};checked=true;void run(true)})
  dialog.querySelector('[data-coach-search-toggle]')?.addEventListener('click',()=>{
   if(searching){closeSearch();return}
   searchReturn=dialog.contains(document.activeElement)?document.activeElement as HTMLElement:null
   preservePosition(()=>{searching=true;paintSearch()});paintCatchup();dialog.querySelector<HTMLInputElement>('[data-coach-search-input]')?.focus({preventScroll:true})
  })
  dialog.querySelector('[data-coach-search-close]')?.addEventListener('click',()=>closeSearch())
  dialog.querySelector('[data-coach-latest]')?.addEventListener('click',jumpLatest)
  dialog.querySelector('[data-coach-search-input]')?.addEventListener('input',event=>{query=(event.target as HTMLInputElement).value;matchId='';preservePosition(paintSearch)})
  dialog.querySelector('[data-coach-search-input]')?.addEventListener('keydown',event=>{if((event as KeyboardEvent).key==='Escape'){event.preventDefault();event.stopPropagation();closeSearch()}})
  dialog.querySelector('[data-coach-search-step="-1"]')?.addEventListener('click',()=>searchStep(-1))
  dialog.querySelector('[data-coach-search-panel]')?.addEventListener('submit',event=>{event.preventDefault();searchStep(1)})
  paintSearch();paintActivity();observeRead()
 }
 dialog.addEventListener('click',event=>{
  const button=event.target instanceof Element?event.target.closest<HTMLButtonElement>('[data-coach-message-url]'):null
  if(!button||!dialog.contains(button)||!active()||leaving||pending)return
  const student=selected,url=button.dataset.coachMessageUrl||'',messageId=button.closest<HTMLElement>('[data-coach-message-id]')?.dataset.coachMessageId
  link?.dispose()
  link=openChatLink(url,()=>active()&&selected===student,undefined,()=>{
   if(!active()||selected!==student)return
   const source=button.isConnected?button:Array.from(dialog.querySelectorAll<HTMLButtonElement>('[data-coach-message-url]')).find(item=>item.dataset.coachMessageUrl===url&&item.closest<HTMLElement>('[data-coach-message-id]')?.dataset.coachMessageId===messageId)
   ;(source||dialog.querySelector<HTMLElement>('h1'))?.focus({preventScroll:true});paintCatchup();void maybeRead()
  })
  if(!link.isOpen()&&readAppLink(url)){notice='Close this conversation to open the shared link. Your draft stays here until you leave.';paintActivity()}
  paintCatchup()
 })
 stopCounts=watchCoachMessageCounts(owner,value=>{if(!active())return;summary=value;paintCatchup()})
 document.addEventListener('visibilitychange',readVisibility);dialog.addEventListener('scroll',()=>{paintCatchup();void maybeRead()},true);if(Capacitor.isNativePlatform())void App.addListener('appStateChange',state=>{nativeActive=state.isActive;paintCatchup();if(nativeActive)void maybeRead()}).then(handle=>{if(disposed)void handle.remove();else appHandle=handle}).catch(()=>{});document.body.append(dialog);dialog.showModal();dialog.oncancel=e=>{e.preventDefault();back()};render();void run()
 return {dispose,requestLeave,back,isOpen:()=>!disposed}
}
