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
export function teamConversationHtml(room:NativeTeamRoom) {
 const byId=new Map(room.messages.map(message=>[message.id,message]))
 return `<div class="chat-history-heading"><p class="rating-context">Latest 75 messages</p><button type="button" class="secondary" id="chat-latest">Latest ↓</button></div><ol class="team-conversation" aria-label="Team conversation" tabindex="0">${room.messages.map(message=>{
  const reply=byId.get(message.replyToMessageId)
  return `<li data-chat-message="${html(message.id)}" class="team-bubble ${message.isMine?'team-bubble-mine':''}"><div class="team-message-meta"><strong>${html(message.senderName)}</strong><span>${html(messageTime(message.createdAt))}</span></div>${message.kind==='announcement'?'<small class="chat-announcement">Captain announcement</small>':''}${message.replyToMessageId?`<blockquote>${reply && !reply.deletedAt?`<strong>${html(reply.senderName)}</strong><span>${html(reply.body.slice(0,160))}</span>`:'Earlier or removed message'}</blockquote>`:''}<p>${html(message.body)}</p>${message.hasAttachment && !message.deletedAt?'<small>Attachment available on the website.</small>':''}${message.card?'<small>Match-day card · open Match day for the shared court plan.</small>':''}${room.chatReady && !message.deletedAt?`<div class="chat-message-actions"><button type="button" class="secondary" data-chat-reply="${html(message.id)}" aria-label="Reply to ${html(message.senderName)}">Reply</button>${!message.isMine?`<button type="button" class="secondary" data-chat-report="${html(message.id)}" aria-label="Report message from ${html(message.senderName)}">Report</button>${message.senderUserId?`<button type="button" class="secondary" data-chat-block="${html(message.senderUserId)}" aria-label="Block chat posts from ${html(message.senderName)}">Block</button>`:''}`:''}</div>${chatReactionButtons(message)}`:''}</li>`
 }).join('') || '<li class="rating-context">Start the team conversation.</li>'}</ol>`
}
export function teamMatchDayHtml(room:NativeTeamRoom) {
 const next=room.nextMatch,card=room.activeCard?.card
 return `<section><h2>Next scheduled match</h2>${next?`<dl><dt>Date</dt><dd>${html(matchDate(next.matchDate))}</dd><dt>Opponent</dt><dd>${html(next.opponent || 'Not recorded')}</dd><dt>Time</dt><dd>${html(next.matchTime || 'Not recorded')}</dd><dt>Facility</dt><dd>${html(next.facility || 'Not recorded')}</dd></dl>`:'<p>No upcoming match is recorded for this team.</p>'}</section><section><h2>Shared court plan</h2>${card?`<p>${html(matchDate(card.matchDate))} · ${html(card.opponent || 'Opponent unavailable')}</p><p class="rating-context">${html(card.state==='archived'?'Archived match card':card.state==='active'?'Active match card':'Upcoming match card')}. This is the plan shared in Team Room; check captain announcements for final changes.</p>${card.lineup.length?`<ul class="team-courts">${card.lineup.map(court=>`<li><h3>${html(court.label || 'Court')}</h3><p>${court.defaulted?'Defaulted court':court.players.length?court.players.map(html).join(' &amp; '):'Players not assigned'}</p></li>`).join('')}</ul>`:'<p>No court assignments are recorded on this card.</p>'}`:'<p>No active match card is available in the loaded conversation window.</p>'}</section>`
}
export function showTeamRoom(app:HTMLElement,client:SupabaseClient,userId:string,isCurrent:()=>boolean,initialScope?:TeamScope) {
 let disposed=false,revision=0,selected:TeamScope|undefined=initialScope,tab:'Match day'|'Conversation'|'Members'='Conversation',snapshot:NativeTeamData|null=null
 let busy=false,safetyNotice='',safetyChoice:{kind:'report'|'block';id:string;name:string}|null=null
 let live:ReturnType<typeof watchTeamChat>|null=null,watchedRoomId='',liveStatus:TeamLiveStatus='connecting',readRoomId='',matchDetailsDirty=false,readThrough='',lastAckAttempt='',readNotice='',historyScroll=0,needsLiveRefresh=false
 let unread=new Set<string>(),fullLoads=0,reactionSending=false,reactionEpoch=0,reactionNotice=''
 const pendingReactions=new Map<string,Extract<ChatAction,{action:'set_chat_reaction'}>>()
 const valid=()=>!disposed && isCurrent()
 const statusText=()=>liveStatus==='live'?'Live chat on':liveStatus==='connecting'?'Connecting to live chat…':liveStatus==='paused'?'Live updates paused. Refresh if needed.':'Live updates unavailable. Refresh to check for messages.'
 const updateLabels=()=>{
  const button=app.querySelector<HTMLButtonElement>('[data-team-tab="Conversation"]');if(button)button.textContent=`Conversation${unread.size?` (${unread.size})`:''}`
  const latest=app.querySelector<HTMLButtonElement>('#chat-latest');if(latest)latest.textContent=unread.size?`${unread.size} new · Latest ↓`:'Latest ↓'
  const status=app.querySelector('#chat-live-status');if(status)status.textContent=statusText()
  const reaction=app.querySelector('#chat-reaction-status');if(reaction)reaction.textContent=reactionNotice
  const read=app.querySelector('#chat-read-status');if(read)read.textContent=readNotice
 }
 const updateUnread=(room:NativeTeamRoom)=>{
  if(readRoomId!==room.id){readRoomId=room.id;readThrough=room.lastReadAt;lastAckAttempt='';historyScroll=0}
  if(newerChatTime(room.lastReadAt,readThrough))readThrough=room.lastReadAt
  unread=new Set(room.messages.filter(message=>!message.isMine && !message.deletedAt && newerChatTime(message.createdAt,readThrough)).map(message=>message.id))
 }
 const nearLatest=()=>{const list=app.querySelector<HTMLElement>('.team-conversation');return Boolean(list && list.scrollHeight-list.scrollTop-list.clientHeight<40)}
 const markLatest=()=>{
  const room=snapshot?.room,list=app.querySelector<HTMLElement>('.team-conversation')
  if(!room || !room.chatReady || !selected || !valid() || document.visibilityState!=='visible' || live && !live.isForeground() || tab!=='Conversation' || !list || !nearLatest())return
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
 const bindMessageActions=(room:NativeTeamRoom)=>{
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
  app.querySelectorAll<HTMLButtonElement>('[data-chat-reply]').forEach(button=>{button.disabled=Boolean(draft.pending || draft.sending || busy);button.onclick=()=>{const message=room.messages.find(message=>message.id===button.dataset.chatReply);if(!message || draft.pending || draft.sending)return;draft.reply={id:message.id,name:message.senderName,body:message.body};render();app.querySelector<HTMLTextAreaElement>('#chat-draft')?.focus()}})
  app.querySelectorAll<HTMLButtonElement>('[data-chat-report],[data-chat-block]').forEach(button=>{button.disabled=busy || draft.sending;button.onclick=()=>{if(busy || draft.sending)return;const report=button.dataset.chatReport;const message=room.messages.find(message=>report?message.id===report:message.senderUserId===button.dataset.chatBlock);if(!message)return;safetyChoice={kind:report?'report':'block',id:report || message.senderUserId,name:message.senderName};render();app.querySelector<HTMLElement>('[aria-label="Chat safety"]')?.scrollIntoView({block:'nearest'})}})
 }
 const renderLiveHistory=(room:NativeTeamRoom,latest:boolean)=>{
  const list=app.querySelector<HTMLElement>('.team-conversation')
  if(!list)return
  const previous=list.scrollTop,top=list.getBoundingClientRect().top
  const first=Array.from(list.children).find(child=>child.getBoundingClientRect().bottom>top+1) as HTMLElement|undefined
  const anchor=first?{id:first.dataset.chatMessage,delta:first.getBoundingClientRect().top-top}:null
  const fragment=document.createElement('template');fragment.innerHTML=teamConversationHtml(room)
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
  if(busy || draft.sending || fullLoads>0){needsLiveRefresh=true;return}
  const room=snapshot.room,scope={...selected},version=++revision,followLatest=tab==='Conversation' && nearLatest()
  try{
   const update=await loadTeamChatUpdate(client,userId,valid,scope,room.id)
   if(!valid() || version!==revision || snapshot?.room?.id!==room.id)return
   const {blockedUserIds,...fields}=update,blocked=new Set(blockedUserIds)
   if(draft.reply && room.messages.some(message=>message.id===draft.reply?.id && blocked.has(message.senderUserId)))draft.reply=null
   snapshot={...snapshot,room:{...room,...fields,activeCard:room.activeCard && !blocked.has(room.activeCard.senderUserId)?room.activeCard:null,blockedMembers:blockedUserIds.map(id=>({id,name:room.messages.find(message=>message.senderUserId===id)?.senderName || room.blockedMembers.find(member=>member.id===id)?.name || 'Team member'}))}};matchDetailsDirty=true;reconcileReactions(snapshot.room!);updateUnread(snapshot.room!);if(tab==='Conversation' && !safetyChoice)renderLiveHistory(snapshot.room!,followLatest);else updateLabels()
  }catch(cause){
   if(valid() && version===revision && cause instanceof TeamRoomAccessError){freshDraft();snapshot=null;app.innerHTML='<h1>Team unavailable</h1><p role="alert">Your team access changed. Open My teams again to check your connections.</p>'}
   if(valid() && version===revision){liveStatus='paused';updateLabels()}
   throw cause
  }
 }
 const ensureLive=(room:NativeTeamRoom)=>{
  if(watchedRoomId===room.id)return
  live?.dispose();watchedRoomId=room.id
  live=watchTeamChat(client,userId,room.id,valid,refreshLive,status=>{liveStatus=status;updateLabels();if(status==='live')markLatest()})
 }
 const currentScope=():TeamScope=>{if(!selected)throw Error('Open a team first.');return {...selected}}
 let draft=new TeamChatDraft(action=>postTeamChat(client,userId,valid,currentScope(),action))
 const freshDraft=()=>{reactionEpoch++;reactionSending=false;reactionNotice='';pendingReactions.clear();live?.dispose();live=null;watchedRoomId='';readRoomId='';readThrough='';lastAckAttempt='';readNotice='';unread.clear();needsLiveRefresh=false;draft.dispose();draft=new TeamChatDraft(action=>postTeamChat(client,userId,valid,currentScope(),action))}
 const load=async(preserve=false,latest=false)=>{
  fullLoads++
  const version=++revision
  if(!preserve){snapshot=null;app.innerHTML='<h1 tabindex="-1">My teams</h1><p role="status">Loading your linked team…</p>'}
  try{
   const result=await loadTeamRoom(client,userId,valid,selected)
   if(!valid() || version!==revision)return
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
  try{await postTeamChat(client,userId,valid,currentScope(),action);if(!valid())return;safetyChoice=null;if(action.action==='block_chat_member' && snapshot?.room?.messages.some(message=>message.id===draft.reply?.id && message.senderUserId===action.memberId))draft.reply=null;safetyNotice=action.action==='report_chat_message'?'Report saved for review.':action.action==='block_chat_member'?'Chat posts blocked. Your team still sees your posts.':'Chat posts unblocked.';await load(true)}
  catch{if(valid()){safetyNotice='Couldn’t confirm this action. Try again.';render()}}
  finally{busy=false;if(valid()){render();if(needsLiveRefresh){needsLiveRefresh=false;void refreshLive().catch(()=>{})}}}
 }
 const render=(latest=false)=>{
  if(!snapshot || !valid())return
  const oldList=app.querySelector<HTMLElement>('.team-conversation')
  if(oldList)historyScroll=oldList.scrollTop
  const oldTop=oldList?.getBoundingClientRect().top || 0,oldFirst=oldList?Array.from(oldList.children).find(child=>child.getBoundingClientRect().bottom>oldTop+1) as HTMLElement|undefined:undefined
  const anchor=oldFirst?{id:oldFirst.dataset.chatMessage,delta:oldFirst.getBoundingClientRect().top-oldTop}:null
  const previousScroll=historyScroll,oldInput=app.querySelector<HTMLTextAreaElement>('#chat-draft')
  const caret=oldInput && document.activeElement===oldInput?{start:oldInput.selectionStart,end:oldInput.selectionEnd}:null
  const room=snapshot.room
  if(!room){freshDraft();app.innerHTML='<h1 tabindex="-1">My teams</h1><p>No accepted team connection is available. Connect your team on the website, then refresh here.</p><button type="button" class="secondary">Refresh teams</button>';app.querySelector<HTMLButtonElement>('button')!.onclick=()=>{void load()};return}
  app.innerHTML=`<small>Team chat</small><h1 tabindex="-1">${html(room.teamName)}</h1><p>${html(room.leagueName)} · ${html(room.flight || 'Flight unavailable')}</p><label class="sr-only" for="linked-team">Linked team</label><select id="linked-team" ${draft.pending || busy || draft.sending?'disabled':''}>${snapshot.teams.map((team,index)=>`<option value="${index}" ${team.teamName===room.teamName && team.leagueName===room.leagueName && team.flight===room.flight?'selected':''}>${html(team.teamName)} · ${html(team.leagueName)} · ${html(team.flight)}</option>`).join('')}</select><div class="match-filters" role="group" aria-label="Team views">${(['Conversation','Match day','Members'] as const).map(value=>`<button type="button" class="secondary" data-team-tab="${value}" aria-pressed="${tab===value}">${value}</button>`).join('')}</div><p id="chat-live-status" role="status" class="rating-context"></p><p id="chat-reaction-status" role="status" class="rating-context"></p><div id="team-panel"></div><p id="chat-read-status" role="status" class="rating-context"></p><p role="status" class="chat-safety-status">${html(safetyNotice)}</p><button type="button" class="secondary" id="refresh-team" ${busy || draft.sending?'disabled':''}>Refresh team</button><p class="rating-context">Manage team alerts in My Lab. Photos are coming next.</p>`
  const panel=app.querySelector<HTMLElement>('#team-panel')!
  panel.innerHTML=tab==='Match day'?teamMatchDayHtml(room):tab==='Conversation'?teamConversationHtml(room):`<section><h2>Team members</h2><ul class="team-members">${room.members.map(member=>`<li><strong>${html(member.name)}</strong><span>${member.roles.includes('captain')?'Captain':member.roles.includes('co_captain')?'Co-captain':'Player'}</span></li>`).join('')}</ul></section>${room.blockedMembers.length?`<section><h2>Blocked chat posts</h2><p>These members’ posts are hidden from your team conversations. Blocking does not remove anyone from the team. Your posts remain visible to the group.</p><ul class="team-members">${room.blockedMembers.map(member=>`<li>${html(member.name)}<button type="button" class="secondary" data-chat-unblock="${html(member.id)}" ${busy?'disabled':''}>Unblock chat posts</button></li>`).join('')}</ul></section>`:''}`
  if(tab==='Conversation'){
   if(room.chatReady){
    panel.insertAdjacentHTML('beforeend',`<form id="chat-composer" class="chat-composer"><div id="chat-reply-context">${draft.reply?`<div class="chat-reply-context"><strong>Replying to ${html(draft.reply.name)}</strong><p>${html(draft.reply.body.slice(0,160))}</p><button type="button" class="secondary" id="chat-cancel-reply" ${draft.pending || draft.sending?'disabled':''}>Cancel reply</button></div>`:''}</div><label class="sr-only" for="chat-draft">Message your team</label><textarea id="chat-draft" maxlength="2400" rows="2" placeholder="Message your team…" ${draft.pending || draft.sending?'readonly':''}>${html(draft.text)}</textarea><div class="chat-compose-footer"><span id="chat-count">${draft.text.length}/2400</span><button type="submit" ${draft.sending || busy || !draft.pending && !draft.text.trim()?'disabled':''}>${draft.sending?'Sending…':draft.pending?'Retry same message':'Send'}</button></div><p role="status" id="chat-send-status">${html(draft.notice)}</p>${draft.pending && !draft.sending?'<p class="rating-context">This message may already be posted. Retry checks the same send without creating another post.</p><button type="button" class="secondary" id="chat-discard">Discard retry</button>':''}</form>`)
    const textarea=app.querySelector<HTMLTextAreaElement>('#chat-draft')!
    textarea.oninput=()=>{draft.text=textarea.value;app.querySelector('#chat-count')!.textContent=`${draft.text.length}/2400`;app.querySelector<HTMLButtonElement>('#chat-composer button[type=submit]')!.disabled=busy || draft.sending || !draft.text.trim()}
    app.querySelector<HTMLFormElement>('#chat-composer')!.onsubmit=event=>{event.preventDefault();if(busy)return;const task=draft.submit();render();void task.then(sent=>{if(!valid())return;render();if(sent)void load(true,true);else if(needsLiveRefresh){needsLiveRefresh=false;void refreshLive().catch(()=>{})}})}
    app.querySelector<HTMLButtonElement>('#chat-cancel-reply')?.addEventListener('click',()=>{draft.reply=null;render();app.querySelector<HTMLTextAreaElement>('#chat-draft')?.focus()})
    app.querySelector<HTMLButtonElement>('#chat-discard')?.addEventListener('click',()=>{draft.discard();render()})
   }else panel.insertAdjacentHTML('beforeend','<p class="rating-context">Team posting is not available yet. Refresh after the next chat update.</p>')
   const conversation=app.querySelector<HTMLElement>('.team-conversation')!
   conversation.scrollTop=latest?conversation.scrollHeight:previousScroll
   if(!latest && anchor){const target=Array.from(conversation.children).find(child=>(child as HTMLElement).dataset.chatMessage===anchor.id);if(target)conversation.scrollTop+=target.getBoundingClientRect().top-conversation.getBoundingClientRect().top-anchor.delta}
   conversation.onscroll=()=>{historyScroll=conversation.scrollTop;markLatest()}
   app.querySelector<HTMLButtonElement>('#chat-latest')!.onclick=()=>{conversation.scrollTop=conversation.scrollHeight;markLatest()}
  }
  if(safetyChoice){
   const choice=safetyChoice
   panel.insertAdjacentHTML('beforeend',`<section aria-label="Chat safety"><h2>${choice.kind==='report'?'Report message':'Block chat posts'}</h2><p>${choice.kind==='report'?'Send this message to TenAceIQ’s moderation queue. The report is private.':`Hide ${html(choice.name)}’s posts from your team conversations. The group can still see your posts. Match updates outside chat may still arrive.`}</p>${choice.kind==='report'?'<label>Reason<select id="chat-report-reason"><option value="harassment">Harassment or bullying</option><option value="spam">Spam</option><option value="inappropriate">Inappropriate content</option><option value="other">Other concern</option></select></label>':''}<button type="button" id="chat-safety-confirm" ${busy?'disabled':''}>${choice.kind==='report'?'Submit report':'Block chat posts'}</button><button type="button" class="secondary" id="chat-safety-cancel" ${busy?'disabled':''}>Cancel</button></section>`)
   app.querySelector<HTMLButtonElement>('#chat-safety-confirm')!.onclick=()=>{void safetyAction(choice.kind==='report'?{action:'report_chat_message',messageId:choice.id,reason:app.querySelector<HTMLSelectElement>('#chat-report-reason')!.value as 'harassment'|'spam'|'inappropriate'|'other'}:{action:'block_chat_member',memberId:choice.id})}
   app.querySelector<HTMLButtonElement>('#chat-safety-cancel')!.onclick=()=>{safetyChoice=null;render()}
  }
  app.querySelector<HTMLSelectElement>('#linked-team')!.onchange=event=>{const choice=snapshot?.teams[Number((event.currentTarget as HTMLSelectElement).value)];if(!choice || draft.pending || busy || draft.sending)return;freshDraft();selected=choice;tab='Conversation';safetyChoice=null;safetyNotice='';void load()}
  app.querySelectorAll<HTMLButtonElement>('[data-team-tab]').forEach(button=>{button.onclick=()=>{tab=button.dataset.teamTab as typeof tab;render();if(tab==='Match day' && matchDetailsDirty)void load(true);app.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus({preventScroll:true})}})
  bindMessageActions(room)
  app.querySelectorAll<HTMLButtonElement>('[data-chat-unblock]').forEach(button=>{button.onclick=()=>{void safetyAction({action:'unblock_chat_member',memberId:button.dataset.chatUnblock!})}})
  app.querySelector<HTMLButtonElement>('#refresh-team')!.onclick=()=>{safetyNotice='';readNotice='';lastAckAttempt='';if(liveStatus==='offline' || liveStatus==='paused')live?.retry();void load(true,tab==='Conversation' && nearLatest())}
  updateLabels()
  if(caret){const input=app.querySelector<HTMLTextAreaElement>('#chat-draft');input?.focus({preventScroll:true});input?.setSelectionRange(caret.start,caret.end)}
  markLatest()
 }
 void load()
 return {hasDraft:()=>Boolean(draft.text.trim() || draft.pending || draft.sending),dispose:()=>{disposed=true;revision++;snapshot=null;live?.dispose();draft.dispose()},back:()=>false}
}
