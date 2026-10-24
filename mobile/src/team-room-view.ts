import {teamChatCursor} from '../../lib/team-chat-cursor'
import {showCaptainWorkspace} from './captain-view'
import {openChatPostEditor} from './chat-post-editor'
import {TeamMatchActions,matchActionsHtml,type MatchAction} from './team-match-actions'
import {chatPhotoPreviews} from './chat-photo-previews'
import {chooseChatPhoto,privatePhotoData} from './chat-photos'
import {chatReactionButtons,type ChatReactionKind} from './chat-reactions'
import {watchTeamChat,type TeamLiveStatus} from './team-chat-live'
import {newerChatTime} from './team-chat-read'
import type {SupabaseClient} from '@supabase/supabase-js'
import {loadTeamRoom,loadTeamChatUpdate,TeamRoomAccessError,type NativeTeamData,type NativeTeamRoom,type TeamScope} from './team-room-data'
import {ChatActionError,TeamChatDraft,postTeamChat,type ChatAction} from './team-chat-send'
import {html} from './match-details'
import {matchDate} from './recent-results'

function messageTime(value:string) {
 const date=new Date(value)
 return value && Number.isFinite(date.getTime())?date.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Time unavailable'
}
export function teamConversationHtml(room:NativeTeamRoom,earlier=false) {
 const byId=new Map(room.messages.map(message=>[message.id,message]))
 return `<div class="chat-history-heading"><p class="rating-context">${earlier?'Earlier messages':`Latest ${room.messages.length} messages`}</p><button type="button" class="secondary" id="chat-earlier">Earlier messages</button><button type="button" class="secondary" id="chat-latest">Latest ↓</button></div><ol class="team-conversation" aria-label="Team conversation" tabindex="0">${room.messages.map(message=>{
  const reply=byId.get(message.replyToMessageId)
  return `<li data-chat-message="${html(message.id)}" class="team-bubble ${message.isMine?'team-bubble-mine':''}"><div class="team-message-meta"><strong>${html(message.senderName)}</strong><span>${html(messageTime(message.createdAt))}${message.editedAt && !message.deletedAt?' · edited':''}</span></div>${message.kind==='announcement'?'<small class="chat-announcement">Captain announcement</small>':''}${message.replyToMessageId?`<blockquote>${reply && !reply.deletedAt?`<strong>${html(reply.senderName)}</strong><span>${html(reply.body.slice(0,160))}</span>`:'Earlier or removed message'}</blockquote>`:''}<p>${html(message.body)}</p>${message.hasPhoto && !message.deletedAt?`<button type="button" class="secondary chat-photo-open" data-chat-photo="${html(message.id)}" aria-label="Open team photo full screen"><span data-photo-preview>Loading photo…</span></button>`:message.hasAttachment && !message.deletedAt?'<small>Attachment available on the website.</small>':''}${message.card?'<small>Match-day card · open Match day for the shared court plan.</small>':''}${room.chatReady && !message.deletedAt?`<div class="chat-message-actions"><button type="button" class="secondary" data-chat-reply="${html(message.id)}" aria-label="Reply to ${html(message.senderName)}">Reply</button>${message.canManageOwn && message.isMine?`<button type="button" class="secondary" data-chat-edit="${html(message.id)}">Edit</button><button type="button" class="secondary" data-chat-remove="${html(message.id)}">Remove</button>`:''}${!message.isMine?`<button type="button" class="secondary" data-chat-report="${html(message.id)}" aria-label="Report message from ${html(message.senderName)}">Report</button>${message.senderUserId?`<button type="button" class="secondary" data-chat-block="${html(message.senderUserId)}" aria-label="Block chat posts from ${html(message.senderName)}">Block</button>`:''}`:''}</div>${chatReactionButtons(message)}`:''}</li>`
 }).join('') || '<li class="rating-context">Start the team conversation.</li>'}</ol>`
}
export function teamMatchDayHtml(room:NativeTeamRoom) {
 const next=room.nextMatch,card=room.activeCard?.card
 return `<section><h2>Next scheduled match</h2>${next?`<dl><dt>Date</dt><dd>${html(matchDate(next.matchDate))}</dd><dt>Opponent</dt><dd>${html(next.opponent || 'Not recorded')}</dd><dt>Time</dt><dd>${html(next.matchTime || 'Not recorded')}</dd><dt>Facility</dt><dd>${html(next.facility || 'Not recorded')}</dd></dl>`:'<p>No upcoming match is recorded for this team.</p>'}</section><section><h2>Shared court plan</h2>${card?`<p>${html(matchDate(card.matchDate))} · ${html(card.opponent || 'Opponent unavailable')}</p><p class="rating-context">${html(card.state==='archived'?'Archived match card':card.state==='active'?'Active match card':'Upcoming match card')}. This is the plan shared in Team Room; check captain announcements for final changes.</p>${card.lineup.length?`<ul class="team-courts">${card.lineup.map(court=>`<li><h3>${html(court.label || 'Court')}</h3><p>${court.defaulted?'Defaulted court':court.players.length?court.players.map(html).join(' &amp; '):'Players not assigned'}</p></li>`).join('')}</ul>`:'<p>No court assignments are recorded on this card.</p>'}`:'<p>No active match card is available in the loaded conversation window.</p>'}</section>`
}
export function showTeamRoom(app:HTMLElement,client:SupabaseClient,userId:string,isCurrent:()=>boolean,initialScope?:TeamScope) {
 let disposed=false,revision=0,selected:TeamScope|undefined=initialScope,tab:'Match day'|'Conversation'|'Members'|'Captain'='Conversation',snapshot:NativeTeamData|null=null
 let busy=false,safetyNotice='',safetyChoice:{kind:'report'|'block';id:string;name:string}|null=null
 let live:ReturnType<typeof watchTeamChat>|null=null,watchedRoomId='',liveStatus:TeamLiveStatus='connecting',readRoomId='',matchDetailsDirty=false,readThrough='',lastAckAttempt='',readNotice='',historyScroll=0,needsLiveRefresh=false
 let historyBefore='',historyNext='',historyLoading=false,historyNotice=''
 let unread=new Set<string>(),fullLoads=0,reactionSending=false,reactionEpoch=0,reactionNotice=''
 const pendingReactions=new Map<string,Extract<ChatAction,{action:'set_chat_reaction'}>>()
 let captainView:ReturnType<typeof showCaptainWorkspace>|null=null
 let searchText='',postEditor:ReturnType<typeof openChatPostEditor>|null=null
 let muteSending=false,mutePending:boolean|null=null,muteNotice=''
 let photoChoosing=false,photoDialog:HTMLDialogElement|null=null,photoVersion=0,viewedPhotoId=''
 const closePhoto=()=>{photoVersion++;photoDialog?.remove();photoDialog=null;viewedPhotoId=''}
 const onVisibility=()=>{if(document.visibilityState!=='visible'){captainView?.dispose();captainView=null;if(tab==='Captain'){const panel=app.querySelector('#team-panel');if(panel)panel.innerHTML='<p role="status">Captain tools paused.</p>'}postEditor?.dispose();postEditor=null;closePhoto();previews.clear()}else if(snapshot?.room){if(tab==='Captain')render();else previews.attach(app.querySelector<HTMLElement>('.team-conversation'))}}
 document.addEventListener('visibilitychange',onVisibility)
 const valid=()=>!disposed && isCurrent()
 const previews=chatPhotoPreviews(async id=>{const data=await postTeamChat(client,userId,valid,{...currentScope()},{action:'read_chat_photo',messageId:id,photoPreview:true});if(data.messageId!==id || typeof data.base64!=='string' || data.base64.length>128000)throw Error('Photo preview unavailable');return privatePhotoData(data)},valid)
 const statusText=()=>liveStatus==='live'?'Live chat on':liveStatus==='connecting'?'Connecting to live chat…':liveStatus==='paused'?'Live updates paused. Refresh if needed.':'Live updates unavailable. Refresh to check for messages.'
 const updateLabels=()=>{
  const button=app.querySelector<HTMLButtonElement>('[data-team-tab="Conversation"]');if(button)button.textContent=`Conversation${unread.size?` (${unread.size})`:''}`
  const latest=app.querySelector<HTMLButtonElement>('#chat-latest');if(latest)latest.textContent=historyBefore?'Back to latest ↓':unread.size?`${unread.size} new · Latest ↓`:'Latest ↓'
  const earlier=app.querySelector<HTMLButtonElement>('#chat-earlier');if(earlier){earlier.disabled=historyLoading || !historyNext || busy || draft.sending;earlier.textContent=historyLoading?'Loading…':historyNext?'Earlier messages':'Beginning of conversation'}
  if(latest)latest.disabled=historyLoading
  const history=app.querySelector('#chat-history-status');if(history)history.textContent=historyNotice
  const status=app.querySelector('#chat-live-status');if(status)status.textContent=statusText()
  const reaction=app.querySelector('#chat-reaction-status');if(reaction)reaction.textContent=reactionNotice
  const read=app.querySelector('#chat-read-status');if(read)read.textContent=readNotice
 }
 const updateUnread=(room:NativeTeamRoom)=>{
  if(historyBefore)return
  if(readRoomId!==room.id){readRoomId=room.id;readThrough=room.lastReadAt;lastAckAttempt='';historyScroll=0}
  if(newerChatTime(room.lastReadAt,readThrough))readThrough=room.lastReadAt
  unread=new Set(room.messages.filter(message=>!message.isMine && !message.deletedAt && newerChatTime(message.createdAt,readThrough)).map(message=>message.id))
 }
 const nearLatest=()=>{const list=app.querySelector<HTMLElement>('.team-conversation');return Boolean(list && list.scrollHeight-list.scrollTop-list.clientHeight<40)}
 const markLatest=()=>{
  const room=snapshot?.room,list=app.querySelector<HTMLElement>('.team-conversation')
  if(historyBefore || historyLoading || searchText.trim() || postEditor?.isOpen() || photoDialog || !room || !room.chatReady || !selected || !valid() || document.visibilityState!=='visible' || live && !live.isForeground() || tab!=='Conversation' || !list || !nearLatest())return
  const latest=room.messages.at(-1)
  if(!latest)return
  if(newerChatTime(latest.createdAt,readThrough))readThrough=latest.createdAt
  unread.clear();updateLabels()
  if(lastAckAttempt===latest.id)return
  lastAckAttempt=latest.id
  const roomId=room.id
  void postTeamChat(client,userId,valid,{...selected},{action:'mark_chat_read',messageId:latest.id}).catch(()=>{if(valid() && snapshot?.room?.id===roomId){readNotice='Read position will retry when you refresh.';updateLabels()}})
 }
 const reconcileReactions=(room:NativeTeamRoom)=>{
  for(const [key,action] of pendingReactions){const message=room.messages.find(message=>message.id===action.messageId);if(!message || message.deletedAt || (message.reactions?.find(item=>item.reaction===action.reaction)?.reacted===true)===action.active)pendingReactions.delete(key)}
 }
 const applySearch=(room:NativeTeamRoom)=>{
  const query=searchText.trim().toLocaleLowerCase();let count=0
  for(const item of app.querySelectorAll<HTMLElement>('[data-chat-message]')){const message=room.messages.find(message=>message.id===item.dataset.chatMessage);const visible=!query || Boolean(message && !message.deletedAt && (message.body+' '+message.senderName).toLocaleLowerCase().includes(query));item.hidden=!visible;if(visible)count++}
  const status=app.querySelector('#chat-search-status');if(status)status.textContent=query?`${count} ${count===1?'match':'matches'} in these ${room.messages.length} messages.`:''
 }
 const bindMessageActions=(room:NativeTeamRoom)=>{
  applySearch(room)
  previews.attach(app.querySelector<HTMLElement>('.team-conversation'))
  app.querySelectorAll<HTMLButtonElement>('[data-chat-photo]').forEach(button=>{button.onclick=()=>{void (async()=>{
   const message=room.messages.find(item=>item.id===button.dataset.chatPhoto)
   if(!message?.hasPhoto || message.deletedAt || !valid())return
   closePhoto();viewedPhotoId=message.id
   const version=photoVersion,epoch=reactionEpoch,scope={...currentScope()}
   photoDialog=document.createElement('dialog');photoDialog.className='chat-photo-dialog';photoDialog.setAttribute('aria-label','Team photo')
   photoDialog.innerHTML='<button type="button" class="secondary">Close photo</button><p role="status">Opening photo…</p>'
   photoDialog.querySelector('button')!.onclick=()=>{closePhoto();button.focus({preventScroll:true})};photoDialog.oncancel=event=>{event.preventDefault();closePhoto()}
   document.body.append(photoDialog);if(typeof photoDialog.showModal==='function')photoDialog.showModal();else photoDialog.setAttribute('open','');photoDialog.querySelector('button')!.focus()
   try{const data=await postTeamChat(client,userId,valid,scope,{action:'read_chat_photo',messageId:message.id});if(!valid() || epoch!==reactionEpoch || version!==photoVersion || data.messageId!==message.id)return
    const image=document.createElement('img');image.alt='Photo shared with your team';image.src=privatePhotoData(data);photoDialog?.querySelector('p')?.replaceWith(image)
   }catch{if(valid() && version===photoVersion && photoDialog)photoDialog.querySelector('p')!.textContent='Photo unavailable. Close and try again.'}
  })()}})

  app.querySelectorAll<HTMLButtonElement>('[data-chat-edit],[data-chat-remove]').forEach(button=>{button.disabled=busy || draft.sending;button.onclick=()=>{
   const message=room.messages.find(item=>item.id===(button.dataset.chatEdit || button.dataset.chatRemove));if(!message?.canManageOwn || !message.isMine || busy || draft.sending)return
   postEditor?.dispose();const epoch=reactionEpoch,scope={...currentScope()},current=()=>valid() && epoch===reactionEpoch
   postEditor=openChatPostEditor(message,room.id,Boolean(button.dataset.chatRemove),action=>postTeamChat(client,userId,current,scope,action),()=>{if(current()){postEditor=null;void refreshLive().catch(()=>{})}},current)
  }})
  app.querySelectorAll<HTMLButtonElement>('[data-chat-reaction]').forEach(button=>{
   const key=`${button.dataset.reactionMessage}:${button.dataset.chatReaction}`
   button.disabled=reactionSending || busy || draft.sending
   if(pendingReactions.has(key))button.setAttribute('aria-label',`Retry ${button.dataset.chatReaction} reaction`)
   button.onclick=()=>{void (async()=>{
    if(reactionSending || busy || draft.sending)return
    const message=room.messages.find(message=>message.id===button.dataset.reactionMessage),reaction=button.dataset.chatReaction as ChatReactionKind
    if(!message || message.deletedAt || !['helpful','celebrate'].includes(reaction))return
    const action=pendingReactions.get(key) || {action:'set_chat_reaction' as const,messageId:message.id,reaction,active:!message.reactions?.find(item=>item.reaction===reaction)?.reacted}
    const epoch=reactionEpoch,roomId=room.id
    reactionSending=true;reactionNotice='Saving reaction…';bindMessageActions(room);updateLabels()
    try{await postTeamChat(client,userId,valid,currentScope(),action);if(!valid() || epoch!==reactionEpoch || snapshot?.room?.id!==roomId)return;pendingReactions.delete(key);reactionNotice='Reaction saved.'}
    catch(cause){if(!valid() || epoch!==reactionEpoch || snapshot?.room?.id!==roomId)return;if(!(cause instanceof ChatActionError) || cause.uncertain){pendingReactions.set(key,action);reactionNotice='Couldn’t confirm the reaction. Tap it again to retry the same choice.'}else{pendingReactions.delete(key);reactionNotice='Reaction wasn’t saved. Refresh the team and try again.'}}
    finally{if(valid() && epoch===reactionEpoch && snapshot?.room?.id===roomId){reactionSending=false;await refreshLive().catch(()=>{});if(snapshot?.room){reconcileReactions(snapshot.room);bindMessageActions(snapshot.room)}updateLabels()}}
   })()}
  })
  app.querySelectorAll<HTMLButtonElement>('[data-chat-reply]').forEach(button=>{button.disabled=Boolean(draft.pending || draft.sending || busy);button.onclick=()=>{const message=room.messages.find(message=>message.id===button.dataset.chatReply);if(!message || draft.pending || draft.sending)return;draft.reply={id:message.id,name:message.senderName,body:message.body,senderUserId:message.senderUserId};render();app.querySelector<HTMLTextAreaElement>('#chat-draft')?.focus()}})
  app.querySelectorAll<HTMLButtonElement>('[data-chat-report],[data-chat-block]').forEach(button=>{button.disabled=busy || draft.sending;button.onclick=()=>{if(busy || draft.sending)return;const report=button.dataset.chatReport;const message=room.messages.find(message=>report?message.id===report:message.senderUserId===button.dataset.chatBlock);if(!message)return;safetyChoice={kind:report?'report':'block',id:report || message.senderUserId,name:message.senderName};render();app.querySelector<HTMLElement>('[aria-label="Chat safety"]')?.scrollIntoView({block:'nearest'})}})
 }
 const renderLiveHistory=(room:NativeTeamRoom,latest:boolean)=>{
  const list=app.querySelector<HTMLElement>('.team-conversation')
  if(!list)return
  const previous=list.scrollTop,top=list.getBoundingClientRect().top
  const first=Array.from(list.children).find(child=>child.getBoundingClientRect().bottom>top+1) as HTMLElement|undefined
  const anchor=first?{id:first.dataset.chatMessage,delta:first.getBoundingClientRect().top-top}:null
  const fragment=document.createElement('template');fragment.innerHTML=teamConversationHtml(room,Boolean(historyBefore))
  const next=fragment.content.querySelector('.team-conversation')!
  list.replaceChildren(...Array.from(next.childNodes))
  list.scrollTop=latest?list.scrollHeight:previous
  if(!latest && anchor){const target=Array.from(list.children).find(child=>(child as HTMLElement).dataset.chatMessage===anchor.id);if(target)list.scrollTop+=target.getBoundingClientRect().top-list.getBoundingClientRect().top-anchor.delta}
  historyScroll=list.scrollTop
  if(!draft.reply){const context=app.querySelector('#chat-reply-context');if(context)context.replaceChildren()}
  bindMessageActions(room);updateLabels();markLatest()
 }
 const refreshLive=async()=>{
  if(!snapshot?.room || !selected || !valid())return
  if(historyLoading || busy || draft.sending || fullLoads>0){needsLiveRefresh=true;return}
  const room=snapshot.room,scope={...selected},version=++revision,followLatest=tab==='Conversation' && nearLatest()
  try{
   const update=await loadTeamChatUpdate(client,userId,valid,scope,room.id,undefined,historyBefore)
   if(!valid() || version!==revision || snapshot?.room?.id!==room.id)return
   historyNext=update.nextCursor
   const {blockedUserIds,...fields}=update,blocked=new Set(blockedUserIds)
   if(draft.reply && blocked.has(draft.reply.senderUserId || ''))draft.reply=null
   snapshot={...snapshot,room:{...room,...fields,activeCard:room.activeCard && !blocked.has(room.activeCard.senderUserId)?room.activeCard:null,blockedMembers:blockedUserIds.map(id=>({id,name:room.messages.find(message=>message.senderUserId===id)?.senderName || room.blockedMembers.find(member=>member.id===id)?.name || 'Team member'}))}};matchDetailsDirty=true;if(viewedPhotoId && !snapshot.room!.messages.some(message=>message.id===viewedPhotoId && !message.deletedAt && message.hasPhoto))closePhoto();reconcileReactions(snapshot.room!);updateUnread(snapshot.room!);if(tab==='Conversation' && !safetyChoice)renderLiveHistory(snapshot.room!,followLatest);else updateLabels()
  }catch(cause){
   if(valid() && version===revision && cause instanceof TeamRoomAccessError){freshDraft();snapshot=null;app.innerHTML='<h1>Team unavailable</h1><p role="alert">Your team access changed. Open My teams again to check your connections.</p>'}
   if(valid() && version===revision){liveStatus='paused';updateLabels()}
   throw cause
  }
 }
 const navigateHistory=async(before:string)=>{
  if(historyLoading || busy || draft.sending || !snapshot?.room || !selected || !valid())return
  const room=snapshot.room,scope={...selected},version=++revision,epoch=reactionEpoch
  historyLoading=true;historyNotice='Loading conversation…';updateLabels()
  try{
   const update=await loadTeamChatUpdate(client,userId,valid,scope,room.id,undefined,before)
   if(!valid() || version!==revision || epoch!==reactionEpoch || snapshot?.room?.id!==room.id)return
   historyBefore=before;historyNext=update.nextCursor;historyNotice=before?(update.messages.length?'Earlier messages. Choose Back to latest to catch up.':'You’ve reached the beginning of this conversation.'):''
   const blocked=new Set(update.blockedUserIds)
   if(draft.reply && blocked.has(draft.reply.senderUserId || ''))draft.reply=null
   snapshot={...snapshot,room:{...snapshot.room,messages:update.messages,lastReadAt:update.lastReadAt,activeCard:room.activeCard && !blocked.has(room.activeCard.senderUserId)?room.activeCard:null,blockedMembers:update.blockedUserIds.map(id=>({id,name:room.blockedMembers.find(member=>member.id===id)?.name || 'Team member'}))}}
   closePhoto();previews.clear();historyScroll=0;matchDetailsDirty=true;updateUnread(snapshot.room!);render(!before)
   const list=app.querySelector<HTMLElement>('.team-conversation');if(list && before)list.scrollTop=0;list?.focus({preventScroll:true})
  }catch(cause){
   if(!valid() || version!==revision || epoch!==reactionEpoch)return
   if(cause instanceof TeamRoomAccessError){freshDraft();snapshot=null;app.innerHTML='<h1>Team unavailable</h1><p role="alert">Your team access changed. Open My teams again to check your connections.</p>'}
   else historyNotice='Couldn’t load that page. Your conversation and draft are still here. Try again.'
  }finally{
   if(valid() && epoch===reactionEpoch && version===revision){historyLoading=false;updateLabels();markLatest();if(needsLiveRefresh && fullLoads===0){needsLiveRefresh=false;void refreshLive().catch(()=>{})}}
  }
 }
 const ensureLive=(room:NativeTeamRoom)=>{
  if(watchedRoomId===room.id)return
  live?.dispose();watchedRoomId=room.id
  live=watchTeamChat(client,userId,room.id,valid,refreshLive,status=>{liveStatus=status;updateLabels();if(status==='live')markLatest()})
 }
 const currentScope=():TeamScope=>{if(!selected)throw Error('Open a team first.');return {...selected}}
 let draft=new TeamChatDraft(action=>postTeamChat(client,userId,valid,currentScope(),action))
 let matchActions=new TeamMatchActions(action=>postTeamChat(client,userId,valid,currentScope(),action))
 const freshDraft=()=>{historyBefore='';historyNext='';historyNotice='';historyLoading=false;captainView?.dispose();captainView=null;searchText='';postEditor?.dispose();postEditor=null;matchActions.dispose();matchActions=new TeamMatchActions(action=>postTeamChat(client,userId,valid,currentScope(),action));muteSending=false;mutePending=null;muteNotice='';previews.clear();closePhoto();photoChoosing=false;reactionEpoch++;reactionSending=false;reactionNotice='';pendingReactions.clear();live?.dispose();live=null;watchedRoomId='';readRoomId='';readThrough='';lastAckAttempt='';readNotice='';unread.clear();needsLiveRefresh=false;draft.dispose();draft=new TeamChatDraft(action=>postTeamChat(client,userId,valid,currentScope(),action))}
 const load=async(preserve=false,latest=false)=>{
  historyLoading=false
  fullLoads++
  const version=++revision
  if(!preserve){snapshot=null;app.innerHTML='<h1 tabindex="-1">My teams</h1><p role="status">Loading your linked team…</p>'}
  try{
   const result=await loadTeamRoom(client,userId,valid,selected)
   if(!valid() || version!==revision)return
   historyBefore='';historyNotice='';historyLoading=false;const first=result.room?.messages[0];historyNext=result.room?.messages.length===75 && first?teamChatCursor(first.createdAt,first.id):''
   snapshot=result;matchDetailsDirty=false;selected=result.room?{teamName:result.room.teamName,leagueName:result.room.leagueName,flight:result.room.flight}:undefined
   if(result.room)updateUnread(result.room)
   if(result.room)ensureLive(result.room)
   render(latest || !preserve)
  }catch(cause){
   if(!valid() || version!==revision)return
   if(cause instanceof TeamRoomAccessError){freshDraft();snapshot=null}
   if(preserve && snapshot){safetyNotice='Couldn’t refresh the conversation. Your draft is still here.';render();return}
   app.innerHTML='<h1 tabindex="-1">My teams</h1><p role="alert">Can’t open this team. Check your connection and team membership, then try again.</p><button type="button" class="secondary" id="retry-team">Retry team</button><button type="button" class="secondary" id="reset-team">Load my linked teams</button>'
   app.querySelector<HTMLButtonElement>('#retry-team')!.onclick=()=>{void load()}
   app.querySelector<HTMLButtonElement>('#reset-team')!.onclick=()=>{freshDraft();selected=undefined;void load()}
  }finally{fullLoads--;if(fullLoads===0 && needsLiveRefresh && valid() && snapshot?.room && !busy && !draft.sending){needsLiveRefresh=false;void refreshLive().catch(()=>{})}}
 }
 const safetyAction=async(action:ChatAction)=>{
  if(busy || draft.sending)return
  busy=true;safetyNotice='Saving…';render()
  try{await postTeamChat(client,userId,valid,currentScope(),action);if(!valid())return;safetyChoice=null;if(action.action==='block_chat_member' && draft.reply?.senderUserId===action.memberId)draft.reply=null;safetyNotice=action.action==='report_chat_message'?'Report saved for review.':action.action==='block_chat_member'?'Chat posts blocked. Your team still sees your posts.':'Chat posts unblocked.';await load(true)}
  catch{if(valid()){safetyNotice='Couldn’t confirm this action. Try again.';render()}}
  finally{busy=false;if(valid()){render();if(needsLiveRefresh){needsLiveRefresh=false;void refreshLive().catch(()=>{})}}}
 }
 const render=(latest=false)=>{
  if(!snapshot || !valid())return
  captainView?.dispose();captainView=null
  const oldList=app.querySelector<HTMLElement>('.team-conversation')
  if(oldList)historyScroll=oldList.scrollTop
  const oldTop=oldList?.getBoundingClientRect().top || 0,oldFirst=oldList?Array.from(oldList.children).find(child=>child.getBoundingClientRect().bottom>oldTop+1) as HTMLElement|undefined:undefined
  const anchor=oldFirst?{id:oldFirst.dataset.chatMessage,delta:oldFirst.getBoundingClientRect().top-oldTop}:null
  const previousScroll=historyScroll,oldInput=app.querySelector<HTMLTextAreaElement>('#chat-draft')
  const caret=oldInput && document.activeElement===oldInput?{start:oldInput.selectionStart,end:oldInput.selectionEnd}:null
  const room=snapshot.room
  if(viewedPhotoId && !room?.messages.some(message=>message.id===viewedPhotoId && !message.deletedAt && message.hasPhoto))closePhoto()
  if(!room){freshDraft();app.innerHTML='<h1 tabindex="-1">My teams</h1><p>No accepted team connection is available. Connect your team on the website, then refresh here.</p><button type="button" class="secondary">Refresh teams</button>';app.querySelector<HTMLButtonElement>('button')!.onclick=()=>{void load()};return}
  app.innerHTML=`<small>Team chat</small><h1 tabindex="-1">${html(room.teamName)}</h1><p>${html(room.leagueName)} · ${html(room.flight || 'Flight unavailable')}</p><label class="sr-only" for="linked-team">Linked team</label><select id="linked-team" ${draft.pending || busy || draft.sending || photoChoosing || muteSending || matchActions.sending?'disabled':''}>${snapshot.teams.map((team,index)=>`<option value="${index}" ${team.teamName===room.teamName && team.leagueName===room.leagueName && team.flight===room.flight?'selected':''}>${html(team.teamName)} · ${html(team.leagueName)} · ${html(team.flight)}</option>`).join('')}</select><div class="match-filters" role="group" aria-label="Team views">${(['Conversation','Match day','Members',...(room.canManage?['Captain' as const]:[])] as const).map(value=>`<button type="button" class="secondary" data-team-tab="${value}" aria-pressed="${tab===value}">${value}</button>`).join('')}</div><p class="rating-context">${room.muted?'Team alerts muted':'Team alerts on'}</p><p id="chat-live-status" role="status" class="rating-context"></p><p id="chat-reaction-status" role="status" class="rating-context"></p><div id="team-panel"></div><p id="chat-read-status" role="status" class="rating-context"></p><p role="status" class="chat-safety-status">${html(safetyNotice)}</p><button type="button" class="secondary" id="refresh-team" ${tab==='Captain'?'hidden':''} ${busy || draft.sending?'disabled':''}>Refresh team</button><p class="rating-context">Choose team alert settings in Members. Enable iPhone notifications in My Lab.</p>`
  const panel=app.querySelector<HTMLElement>('#team-panel')!
  if(tab==='Captain' && !room.canManage)tab='Conversation'
  panel.innerHTML=tab==='Captain'?'':tab==='Match day'?teamMatchDayHtml(room)+matchActionsHtml(room,userId):tab==='Conversation'?teamConversationHtml(room,Boolean(historyBefore)):`<section aria-label="Team alert settings"><h2>Team alerts</h2><p>${room.muted?'Alerts for this team are muted. Open Conversation whenever you want to catch up.':'Receive alerts for this team when your iPhone notifications are enabled.'}</p><button type="button" class="secondary" id="chat-mute" ${muteSending || busy?'disabled':''}>${muteSending?'Saving…':mutePending!==null?'Retry same alert setting':room.muted?'Turn team alerts on':'Mute team alerts'}</button><p role="status" id="chat-mute-status">${html(muteNotice)}</p><p class="rating-context">This setting applies only to ${html(room.teamName)} across your devices. It also silences this team’s match-day reminders. Other teams keep their own settings.</p></section><section><h2>Team members</h2><ul class="team-members">${room.members.map(member=>`<li><strong>${html(member.name)}</strong><span>${member.roles.includes('captain')?'Captain':member.roles.includes('co_captain')?'Co-captain':'Player'}</span></li>`).join('')}</ul></section>${room.blockedMembers.length?`<section><h2>Blocked chat posts</h2><p>These members’ posts are hidden from your team conversations. Blocking does not remove anyone from the team. Your posts remain visible to the group.</p><ul class="team-members">${room.blockedMembers.map(member=>`<li>${html(member.name)}<button type="button" class="secondary" data-chat-unblock="${html(member.id)}" ${busy?'disabled':''}>Unblock chat posts</button></li>`).join('')}</ul></section>`:''}`
  if(tab==='Captain'){const epoch=reactionEpoch;captainView=showCaptainWorkspace(panel,client,userId,{...currentScope()},()=>valid() && epoch===reactionEpoch && tab==='Captain',()=>{matchDetailsDirty=true;void refreshLive().catch(()=>{})})}
  if(tab==='Match day'){
   const updateMatchControls=()=>{const selector=app.querySelector<HTMLSelectElement>('#linked-team');if(selector)selector.disabled=Boolean(draft.pending || busy || draft.sending || photoChoosing || muteSending || matchActions.sending);const status=app.querySelector('#match-action-status');if(status)status.textContent=matchActions.notice;const retry=app.querySelector<HTMLButtonElement>('#match-action-retry');if(retry){retry.hidden=!matchActions.pending || matchActions.sending;retry.disabled=matchActions.sending}app.querySelectorAll<HTMLButtonElement>('[data-match-response],[data-lineup-ack],[data-final-ack],[data-match-arrival],[data-replacement-response]').forEach(button=>{button.disabled=Boolean(matchActions.pending || matchActions.sending) || button.hasAttribute('data-lineup-ack') && room.activeCard?.card?.acknowledged===true || button.hasAttribute('data-final-ack') && room.finalLineupReview?.currentUserSeen===true})}
   const submitMatch=(action?:MatchAction)=>{if(busy || draft.sending || matchActions.sending)return;const current=matchActions,epoch=reactionEpoch;const task=current.submit(action);updateMatchControls();void task.then(saved=>{if(!valid() || epoch!==reactionEpoch || current!==matchActions)return;updateMatchControls();if(saved)void load(true)})}
   const message=room.activeCard
   app.querySelectorAll<HTMLButtonElement>('[data-replacement-response]').forEach(button=>{button.onclick=()=>{const request=message?.card?.replacement;if(message&&request?.canRespond)submitMatch({action:'respond_lineup_change',messageId:message.id,response:button.dataset.replacementResponse as 'accepted'|'declined',replacementToken:request.token})}})
   app.querySelectorAll<HTMLButtonElement>('[data-match-response]').forEach(button=>{button.onclick=()=>{if(message)submitMatch({action:'respond',messageId:message.id,response:button.dataset.matchResponse as 'yes'|'maybe'|'no'})}})
   app.querySelector<HTMLButtonElement>('[data-lineup-ack]')?.addEventListener('click',()=>{if(message)submitMatch({action:'acknowledge_lineup',messageId:message.id,lineupVersion:message.card?.lineupVersion || 0})})
   app.querySelector<HTMLButtonElement>('[data-final-ack]')?.addEventListener('click',()=>{if(room.finalLineupReview)submitMatch({action:'ack_final_lineup',messageId:room.finalLineupReview.announcementMessageId})})
   app.querySelectorAll<HTMLButtonElement>('[data-match-arrival]').forEach(button=>{button.onclick=()=>{if(message)submitMatch({action:'set_arrival_status',messageId:message.id,arrivalStatus:button.dataset.matchArrival as 'on_my_way'|'here'|'running_late'})}})
   app.querySelector<HTMLButtonElement>('#match-action-retry')?.addEventListener('click',()=>submitMatch());updateMatchControls()
  }
  if(tab==='Conversation'){
   panel.insertAdjacentHTML('afterbegin',`<p role="status" id="chat-history-status">${html(historyNotice)}</p><div class="chat-search"><label class="sr-only" for="chat-search">Search loaded team messages</label><input id="chat-search" type="search" maxlength="120" placeholder="Search loaded messages" value="${html(searchText)}"><button type="button" class="secondary" id="chat-search-clear">Clear search</button><p class="rating-context" role="status" id="chat-search-status"></p></div>`)
   app.querySelector<HTMLInputElement>('#chat-search')!.oninput=event=>{searchText=(event.currentTarget as HTMLInputElement).value;applySearch(room)}
   app.querySelector<HTMLButtonElement>('#chat-search-clear')!.onclick=()=>{searchText='';const input=app.querySelector<HTMLInputElement>('#chat-search')!;input.value='';applySearch(room);input.focus()}
   if(room.chatReady){
    panel.insertAdjacentHTML('beforeend',`<form id="chat-composer" class="chat-composer"><div id="chat-reply-context">${draft.reply?`<div class="chat-reply-context"><strong>Replying to ${html(draft.reply.name)}</strong><p>${html(draft.reply.body.slice(0,160))}</p><button type="button" class="secondary" id="chat-cancel-reply" ${draft.pending || draft.sending?'disabled':''}>Cancel reply</button></div>`:''}</div>${draft.photo?`<figure class="chat-photo-preview"><img src="${draft.photo.preview}" alt="Photo ready to share"><figcaption>Photo ready to share</figcaption><button type="button" class="secondary" id="chat-photo-remove" ${draft.pending || draft.sending?'disabled':''}>Remove photo</button></figure>`:''}<div class="chat-photo-tools"><button type="button" class="secondary" data-photo-source="library" ${draft.pending || draft.sending || busy || photoChoosing?'disabled':''}>Choose photo</button><button type="button" class="secondary" data-photo-source="camera" ${draft.pending || draft.sending || busy || photoChoosing?'disabled':''}>Take photo</button></div><label class="sr-only" for="chat-draft">Message your team</label><textarea id="chat-draft" maxlength="2400" rows="2" placeholder="Message your team…" ${draft.pending || draft.sending || photoChoosing?'readonly':''}>${html(draft.text)}</textarea><div class="chat-compose-footer"><span id="chat-count">${draft.text.length}/2400</span><button type="submit" ${draft.sending || busy || photoChoosing || !draft.pending && !draft.text.trim() && !draft.photo?'disabled':''}>${photoChoosing?'Opening photos…':draft.sending?'Sending…':draft.pending?'Retry same message':draft.photo?'Send photo':'Send'}</button></div><p role="status" id="chat-send-status">${html(draft.notice)}</p>${draft.pending && !draft.sending?'<p class="rating-context">This message may already be posted. Retry checks the same send without creating another post.</p><button type="button" class="secondary" id="chat-discard">Discard retry</button>':''}</form>`)
    const textarea=app.querySelector<HTMLTextAreaElement>('#chat-draft')!
    textarea.oninput=()=>{draft.text=textarea.value;app.querySelector('#chat-count')!.textContent=`${draft.text.length}/2400`;app.querySelector<HTMLButtonElement>('#chat-composer button[type=submit]')!.disabled=busy || draft.sending || photoChoosing || !draft.text.trim() && !draft.photo}
    app.querySelector<HTMLFormElement>('#chat-composer')!.onsubmit=event=>{event.preventDefault();if(busy || photoChoosing)return;const task=draft.submit();render();void task.then(sent=>{if(!valid())return;render();if(sent)void load(true,true);else if(needsLiveRefresh){needsLiveRefresh=false;void refreshLive().catch(()=>{})}})}
    app.querySelectorAll<HTMLButtonElement>('[data-photo-source]').forEach(button=>{button.onclick=()=>{void (async()=>{
     if(draft.pending || draft.sending || busy || photoChoosing)return
     const epoch=reactionEpoch;photoChoosing=true;draft.notice='Choose a photo to preview before sending.';render()
     try{const photo=await chooseChatPhoto(button.dataset.photoSource as 'camera'|'library');if(valid() && epoch===reactionEpoch){draft.photo=photo;draft.notice='Add a caption or send your photo.'}}
     catch{if(valid() && epoch===reactionEpoch)draft.notice='No photo added. Try again and allow access when asked.'}
     finally{if(valid() && epoch===reactionEpoch){photoChoosing=false;render()}}
    })()}})
    app.querySelector<HTMLButtonElement>('#chat-photo-remove')?.addEventListener('click',()=>{if(!draft.pending && !draft.sending){draft.photo=null;draft.notice='';render()}})
    app.querySelector<HTMLButtonElement>('#chat-cancel-reply')?.addEventListener('click',()=>{draft.reply=null;render();app.querySelector<HTMLTextAreaElement>('#chat-draft')?.focus()})
    app.querySelector<HTMLButtonElement>('#chat-discard')?.addEventListener('click',()=>{draft.discard();render()})
   }else panel.insertAdjacentHTML('beforeend','<p class="rating-context">Team posting is not available yet. Refresh after the next chat update.</p>')
   const conversation=app.querySelector<HTMLElement>('.team-conversation')!
   conversation.scrollTop=latest?conversation.scrollHeight:previousScroll
   if(!latest && anchor){const target=Array.from(conversation.children).find(child=>(child as HTMLElement).dataset.chatMessage===anchor.id);if(target)conversation.scrollTop+=target.getBoundingClientRect().top-conversation.getBoundingClientRect().top-anchor.delta}
   conversation.onscroll=()=>{historyScroll=conversation.scrollTop;markLatest()}
   app.querySelector<HTMLButtonElement>('#chat-earlier')!.onclick=()=>{if(historyNext)void navigateHistory(historyNext)}
   app.querySelector<HTMLButtonElement>('#chat-latest')!.onclick=()=>{if(historyBefore)void navigateHistory('');else{conversation.scrollTop=conversation.scrollHeight;markLatest()}}
  }
  if(safetyChoice){
   const choice=safetyChoice
   panel.insertAdjacentHTML('beforeend',`<section aria-label="Chat safety"><h2>${choice.kind==='report'?'Report message':'Block chat posts'}</h2><p>${choice.kind==='report'?'Send this message to TenAceIQ’s moderation queue. The report is private.':`Hide ${html(choice.name)}’s posts from your team conversations. The group can still see your posts. Match updates outside chat may still arrive.`}</p>${choice.kind==='report'?'<label>Reason<select id="chat-report-reason"><option value="harassment">Harassment or bullying</option><option value="spam">Spam</option><option value="inappropriate">Inappropriate content</option><option value="other">Other concern</option></select></label>':''}<button type="button" id="chat-safety-confirm" ${busy?'disabled':''}>${choice.kind==='report'?'Submit report':'Block chat posts'}</button><button type="button" class="secondary" id="chat-safety-cancel" ${busy?'disabled':''}>Cancel</button></section>`)
   app.querySelector<HTMLButtonElement>('#chat-safety-confirm')!.onclick=()=>{void safetyAction(choice.kind==='report'?{action:'report_chat_message',messageId:choice.id,reason:app.querySelector<HTMLSelectElement>('#chat-report-reason')!.value as 'harassment'|'spam'|'inappropriate'|'other'}:{action:'block_chat_member',memberId:choice.id})}
   app.querySelector<HTMLButtonElement>('#chat-safety-cancel')!.onclick=()=>{safetyChoice=null;render()}
  }
  app.querySelector<HTMLSelectElement>('#linked-team')!.onchange=event=>{const choice=snapshot?.teams[Number((event.currentTarget as HTMLSelectElement).value)];if(!choice || draft.pending || busy || draft.sending || photoChoosing || muteSending || matchActions.sending)return;freshDraft();selected=choice;tab='Conversation';safetyChoice=null;safetyNotice='';void load()}
  app.querySelectorAll<HTMLButtonElement>('[data-team-tab]').forEach(button=>{button.onclick=()=>{tab=button.dataset.teamTab as typeof tab;render();if(tab==='Match day' && matchDetailsDirty)void load(true);app.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus({preventScroll:true})}})
  app.querySelector<HTMLButtonElement>('#chat-mute')?.addEventListener('click',()=>{void (async()=>{
   if(muteSending || busy || !valid())return
   const epoch=reactionEpoch,roomId=room.id,scope={...currentScope()},desired=mutePending??!room.muted
   mutePending=desired;muteSending=true;muteNotice='Saving team alerts…';render()
   try{await postTeamChat(client,userId,valid,scope,{action:'set_chat_mute',conversationId:roomId,muted:desired});if(!valid() || epoch!==reactionEpoch || snapshot?.room?.id!==roomId)return;snapshot.room.muted=desired;mutePending=null;muteNotice=desired?'Team alerts muted.':'Team alerts are on. Check My Lab if iPhone notifications are off.'}
   catch{if(valid() && epoch===reactionEpoch)muteNotice='Couldn’t confirm your alert setting. Retry saves the same choice.'}
   finally{if(valid() && epoch===reactionEpoch){muteSending=false;render()}}
  })()})
  bindMessageActions(room)
  app.querySelectorAll<HTMLButtonElement>('[data-chat-unblock]').forEach(button=>{button.onclick=()=>{void safetyAction({action:'unblock_chat_member',memberId:button.dataset.chatUnblock!})}})
  app.querySelector<HTMLButtonElement>('#refresh-team')!.onclick=()=>{safetyNotice='';readNotice='';lastAckAttempt='';if(liveStatus==='offline' || liveStatus==='paused')live?.retry();void load(true,tab==='Conversation' && nearLatest())}
  updateLabels()
  if(caret){const input=app.querySelector<HTMLTextAreaElement>('#chat-draft');input?.focus({preventScroll:true});input?.setSelectionRange(caret.start,caret.end)}
  markLatest()
 }
 void load()
 return {hasDraft:()=>Boolean(postEditor?.isOpen() || matchActions.pending || matchActions.sending || draft.photo || photoChoosing || draft.text.trim() || draft.pending || draft.sending),dispose:()=>{captainView?.dispose();postEditor?.dispose();matchActions.dispose();previews.dispose();closePhoto();document.removeEventListener('visibilitychange',onVisibility);disposed=true;revision++;snapshot=null;live?.dispose();draft.dispose()},back:()=>false}
}
