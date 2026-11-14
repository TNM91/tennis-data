import { CapacitorHttp } from '@capacitor/core'
import { Clipboard } from '@capacitor/clipboard'
import { Share } from '@capacitor/share'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  newPlayerChatInvite,playerChatInviteHref,playerChatInviteToken,type PlayerChatAction,type PlayerChatInbox,type PlayerChatRoom,
} from '../../lib/player-chats-contract'
import { playerChatApiUrl,PlayerChatError,playerChatTransport } from '../../lib/player-chats-transport'
import { teamChatCursor } from '../../lib/team-chat-cursor'
import { html } from './html'
import { watchTeamChat } from './team-chat-live'
import { groupPracticeStart } from '../../lib/group-practice-contract'
import { groupPracticeCard,newGroupPracticeDraft,type GroupPracticeDraft } from './group-practice-card'
import { bindTeamChatAvatars,openChatIconEditor,teamChatAvatarHtml } from './team-chat-icon'

export function playerChatsForAccount(client: SupabaseClient,owner: string,active: () => boolean,browser = false) {
  return playerChatTransport(owner,async ({query,action})=>{
    const {data,error} = await client.auth.getSession()
    if (error || data.session?.user.id !== owner || !active()) throw Error('Your chat session changed.')
    const path = playerChatApiUrl(query), method = action ? 'POST' : 'GET'
    const headers = {Authorization:'Bearer '+data.session.access_token,'Cache-Control':'no-store',...(action?{'Content-Type':'application/json'}:{})}
    const response = browser
      ? await fetch(path,{method,headers,body:action?JSON.stringify(action):undefined,cache:'no-store',redirect:'error',
        signal:AbortSignal.timeout(20000)}).then(async res=>({status:res.status,data:await res.json()}))
      : await CapacitorHttp.request({url:'https://www.tenaceiq.com'+path,method,headers,
        ...(action?{data:action}:{}),responseType:'json',disableRedirects:true,connectTimeout:12000,readTimeout:20000})
    if (!active() || (await client.auth.getSession()).data.session?.user.id !== owner) throw Error('Your chat session changed.')
    return response
  })
}

export function openPlayerChats(
  client: SupabaseClient,owner: string,current: () => boolean,onClose: () => void,
  initial: { token?: string; room?: string; browser?: boolean; className?: string } = {},
) {
  const dialog = document.createElement('dialog')
  dialog.className = 'team-invite-dialog player-chats-dialog'
  if (initial.className) dialog.classList.add(initial.className)
  dialog.setAttribute('aria-labelledby','player-chats-title')
  let disposed = false,busy = false,notice = '',draft = '',groupName = ''
  let page: 'inbox'|'room'|'group'|'invite' = initial.token ? 'invite' : initial.room ? 'room' : 'inbox'
  let inbox: PlayerChatInbox | null = null,room: PlayerChatRoom | null = null
  let invitation: { group: boolean; title: string } | null = null
  let token = initial.token ?? '',shared: { token: string; room?: string; expiresAt: string } | null = null
  let pending: PlayerChatAction | null = null
  let live: ReturnType<typeof watchTeamChat> | null = null
  let watchedRoom: string | null = null
  let historyAnchor = 0
  let practiceDraft: GroupPracticeDraft | null = null
  const lastRead = new Map<string,string>()
  const selected = new Set<string>()
  const active = () => !disposed && current()
  const transport = playerChatsForAccount(client,owner,active,initial.browser)
  let iconEditor: ReturnType<typeof openChatIconEditor> | null = null

  function dispose() {
    disposed = true
    iconEditor?.dispose()
    stopLive()
    room = null; inbox = null; pending = null; shared = null; invitation = null; token = ''; draft = ''
    dialog.remove()
  }
  function close() {
    if (busy || !active()) return
    dispose()
    onClose()
  }
  function back() {
    if (iconEditor?.isOpen()) { iconEditor.close(); return true }
    if (busy || !active()) return true
    if (page === 'inbox') close()
    else { draft=''; pending=null; shared=null; void openInbox() }
    return true
  }
  function message(error: unknown) {
    return error instanceof Error ? error.message : 'Try again.'
  }
  async function run(work: () => Promise<void>,focus = true) {
    if (!active() || busy) return
    busy = true; notice = ''; render()
    try { await work() }
    catch (error) { if (active()) notice = message(error) }
    finally { if (active()) { busy = false; render(focus) } }
  }
  function stopLive() {
    live?.dispose()
    live = null
    watchedRoom = null
  }
  function watchRoom(id: string) {
    if (watchedRoom === id) return
    stopLive()
    watchedRoom = id
    live = watchTeamChat(client,owner,id,()=>active() && page === 'room' && room?.id === id,async ()=>{
      const history = dialog.querySelector<HTMLElement>('.player-chat-messages')
      const readingHistory = history && history.scrollHeight - history.clientHeight - history.scrollTop > 24
      if (busy || iconEditor || draft || practiceDraft || readingHistory || dialog.contains(document.activeElement) && document.activeElement?.matches('input,textarea,select,summary')) {
        const refresh = dialog.querySelector('[data-player-refresh]')
        if (refresh) refresh.textContent = 'Check for updates'
        return
      }
      await run(()=>loadRoom(id),false)
    },()=>undefined)
  }
  async function loadRoom(id: string) {
    let next
    try { next = await transport.room(id) }
    catch (error) {
      if (error instanceof PlayerChatError && error.status === 403) {
        room = null
        stopLive()
      }
      throw error
    }
    if (!active()) return
    room = next; page = 'room'
    watchRoom(id)
    const newest = next.messages.findLast(post=>post.author!==owner)
    if (newest && lastRead.get(id)!==newest.id) {
      const result = await transport.act({action:'read',room:next.id,id:newest.id}).catch(()=>null)
      if (result && active()) lastRead.set(id,newest.id)
    }
  }
  function openInbox() {
    stopLive()
    practiceDraft=null
    page='inbox'; room=null; invitation=null; token=''; shared=null
    return run(async ()=>{ inbox=await transport.inbox() })
  }
  function openRoom(id: string) {
    stopLive()
    draft=''; room=null; shared=null; page='room'
    return run(()=>loadRoom(id))
  }
  function preview(code: string) {
    if (!code) { notice='Paste a TenAceIQ chat invite link.'; render(true); return }
    token=code; page='invite'; invitation=null
    return run(async ()=>{ invitation = await transport.preview(code) })
  }

  function act(input: PlayerChatAction) {
    return run(async ()=>{
      pending=input
      let result
      try { result=await transport.act(input) }
      catch (error) {
        if (error instanceof PlayerChatError && error.status >= 400 && error.status < 500) {
          pending=null
          if (error.status===403 && page==='room') room=null
          if (error.status===409 && input.action==='practice_edit' && room) {
            const attempted = practiceDraft
            await loadRoom(room.id).catch(()=>undefined)
            if (attempted?.revision !== room?.practice?.revision) practiceDraft=null
          }
        }
        throw error
      }
      if (!active()) return
      pending=null
      if (input.action === 'invite' && 'token' in input) {
        if (!result.expiresAt) throw Error('Invite unavailable.')
        shared={token:input.token,room:input.room,expiresAt:result.expiresAt}
        return
      }
      if (input.action === 'group' || input.action === 'direct' || input.action === 'join') {
        shared=null
        if (result.roomId) {
          if (input.action === 'join') { token=''; invitation=null }
          page='room'
          await loadRoom(result.roomId)
        } else if (input.action==='join' && result.contact) {
          token=''; invitation=null; page='inbox'; inbox=await transport.inbox()
          notice='Player saved to your contacts.'
        }
        return
      }
      if (input.action === 'leave' || input.action === 'forget') {
        stopLive()
        shared=null; room=null; page='inbox'; inbox=await transport.inbox()
        return
      }
      if (input.action === 'revoke' || input.action === 'revoke_links') {
        shared=null; notice='Invite link revoked.'; return
      }
      if (input.action === 'report') { notice='Message reported.'; return }
      if (input.action === 'send') draft=''
      if (input.action === 'practice_create') { practiceDraft=null; notice='Practice posted.' }
      if (input.action === 'practice_edit') { practiceDraft=null; notice='Practice updated.' }
      if (input.action === 'practice_reply') notice=input.response==='in'?'You’re on the practice list.':'Your reply is saved.'
      if (input.action === 'practice_cancel') notice='Practice cancelled.'
      if ('room' in input && input.room) {
        if (input.action==='block' && room?.group===false) { stopLive();room=null; page='inbox'; inbox=await transport.inbox() }
        else await loadRoom(input.room)
      }
    },input.action !== 'send')
  }

  function simpleButton(label: string,attribute: string,id?: string) {
    return `<button class="secondary" type="button" ${attribute}${id?`="${html(id)}"`:''}>${label}</button>`
  }
  const contactRows = (contacts: PlayerChatInbox['contacts']) => contacts.map(contact=>
    `<li><strong>${html(contact.name)}</strong><div class="player-chat-actions">
    ${simpleButton('Message<span class="sr-only"> '+html(contact.name)+'</span>','data-player-direct',contact.id)}
    ${simpleButton('Remove<span class="sr-only"> '+html(contact.name)+'</span>','data-player-forget',contact.id)}</div></li>`).join('')
  function sharedMarkup() {
    if (!shared) return ''
    return `<section class="player-chat-invite" aria-label="Share invitation"><label>Invite link<input readonly value="${html(playerChatInviteHref(shared.token))}"></label>
      <p>Expires ${html(new Date(shared.expiresAt).toLocaleDateString())}. ${shared.room?'Anyone you share this link with can sign in and join.':'One player can use this link to connect with you.'}</p>
      <div class="player-chat-actions">${simpleButton('Share invite','data-player-share')}${simpleButton('Copy link','data-player-copy')}
      ${simpleButton('Revoke link','data-player-revoke')}</div></section>`
  }
  function inboxMarkup() {
    const conversations = inbox?.rooms.map(item=>`<li>${simpleButton(teamChatAvatarHtml(item.title,item.logo)+html(item.title)+(item.unread?' <small>New</small>':''),'data-player-room',item.id)}</li>`).join('')
    return `<div class="player-chat-actions">${simpleButton('New group','data-player-group')}${simpleButton('Connect a player','data-player-invite')}</div>
      ${sharedMarkup()}<form data-player-join><label>Have an invite link?<input name="invite" type="url" autocomplete="off" placeholder="Paste invite link" required></label>
      <button class="secondary" type="submit">Review invite</button></form>
      <section class="player-chat-section"><h3>Conversations</h3><ul>${conversations||'<li>No conversations yet.</li>'}</ul></section>
      <section class="player-chat-section"><h3>My players</h3><ul>${inbox?.contacts.length?contactRows(inbox.contacts):'<li>Share a contact invite to save your first player.</li>'}</ul></section>`
  }
  function groupMarkup() {
    return `<form data-player-create><label>Group name<input name="name" maxlength="80" value="${html(groupName)}" placeholder="Friday practice" required></label>
      ${inbox?.contacts.length?`<fieldset><legend>Add saved players</legend>${inbox.contacts.map(contact=>
        `<label class="entry-check"><input type="checkbox" name="players" value="${html(contact.id)}"${selected.has(contact.id)?' checked':''}>${html(contact.name)}</label>`).join('')}</fieldset>`:
        '<p>Create the group, then share its invite link with your players.</p>'}
      <button type="submit">Create group</button></form>`
  }
  function roomMarkup(value: PlayerChatRoom) {
    const names = value.members.map(member=>`<li><strong>${html(member.name)}</strong><div class="player-chat-actions">
      ${simpleButton('Block<span class="sr-only"> '+html(member.name)+'</span>','data-player-block',member.id)}
      ${value.manage?simpleButton('Remove<span class="sr-only"> '+html(member.name)+'</span>','data-player-remove',member.id):''}</div></li>`).join('')
    const messages = value.messages.map(post=>`<li class="player-chat-post" data-mine="${post.author===owner}">
      <div><strong>${post.author===owner?'You':html(post.name)}</strong><time datetime="${html(post.createdAt)}">${html(new Date(post.createdAt).toLocaleString())}</time></div>
      <p>${html(post.body)}</p>
      ${post.author!==owner?`<details><summary>Report message</summary><form data-player-report="${html(post.id)}">
      <label>Reason<select name="reason"><option value="harassment">Harassment</option><option value="spam">Spam</option>
      <option value="inappropriate">Inappropriate content</option><option value="other">Other</option></select></label>
      <button type="submit" class="secondary">Report</button></form></details>`:''}</li>`).join('')
    const choices = (inbox?.contacts??[]).filter(contact=>!value.members.some(member=>member.id===contact.id))
    return `${value.practice!==undefined?groupPracticeCard(value.practice,value.manage,practiceDraft):''}
      ${value.manage?simpleButton(shared?'Replace invite link':'Invite players','data-player-group-invite'):''}
      ${sharedMarkup()}
      <details class="player-chat-options"><summary>${value.group?'Group settings':'Player settings'}</summary>
      ${value.manage?`${initial.browser?'':simpleButton(value.logo?'Edit group icon':'Add group icon','data-player-icon')}
      ${simpleButton('Turn off invite links','data-player-revoke-links')}
      ${choices.length?`<form data-player-add><label>Add a saved player<select name="player">${choices.map(contact=>`<option value="${html(contact.id)}">${html(contact.name)}</option>`).join('')}</select></label>
      <button class="secondary" type="submit">Add to group</button></form>`:''}`:''}
      <ul aria-label="Chat members">${names}</ul>
      ${value.group?simpleButton(value.manage?'Close group':'Leave group','data-player-leave'):''}</details>
      ${value.more?simpleButton('Load earlier messages','data-player-earlier'):''}
      <ol class="player-chat-messages" role="list" aria-label="Messages" tabindex="0">${messages||'<li>Start the conversation.</li>'}</ol>
      <form data-player-send><label for="player-chat-message">Message</label><textarea id="player-chat-message" name="body" required maxlength="2400" rows="2">${html(draft)}</textarea>
      <button type="submit">Send</button></form>`
  }

  function render(focus = false) {
    if (!active()) return
    const settingsOpen = dialog.querySelector<HTMLDetailsElement>('.player-chat-options')?.open
    const practiceListOpen = dialog.querySelector<HTMLDetailsElement>('.group-practice-card details')?.open
    const title = page==='room' ? room?.title ?? 'Conversation' : page==='group' ? 'New group' : page==='invite' ? 'Chat invitation' : 'Players & groups'
    const contents = page==='inbox' ? inboxMarkup() : page==='group' ? groupMarkup() : page==='room' && room ? roomMarkup(room) :
      page==='invite' && invitation ? `<p>${invitation.group?'Join':'Connect with'} <strong>${html(invitation.title)}</strong>.</p>
      <button type="button" data-player-accept>${invitation.group?'Join group':'Save player'}</button>` : ''
    const backLabel = page==='inbox'?'Close':'Back'
    dialog.innerHTML = `<header class="team-invite-heading"><h2 id="player-chats-title" tabindex="-1">${room?.logo?teamChatAvatarHtml(title,room.logo):''}${html(title)}</h2>
      <button class="secondary" type="button" data-player-back aria-label="${page==='inbox'?'Close':'Back to players &amp; groups'}">${backLabel}</button></header>
      <p tabindex="-1" role="status">${html(busy?'Working…':notice)}</p>
      ${pending&&!busy?simpleButton('Retry same action','data-player-retry'):''}
      <fieldset class="player-chat-content"${busy||pending?' disabled':''}>${contents}
      ${page==='inbox'||page==='room'?simpleButton('Refresh','data-player-refresh'):''}</fieldset>`
    const click = (selector: string,handler: (button: HTMLButtonElement) => void) => {
      dialog.querySelectorAll<HTMLButtonElement>(selector).forEach(button=>{button.onclick=()=>handler(button)})
    }
    const form = (selector: string,handler: (fields: FormData,element: HTMLFormElement) => void) => {
      dialog.querySelectorAll<HTMLFormElement>(selector).forEach(element=>{
        element.onsubmit=event=>{event.preventDefault();handler(new FormData(element),element)}
      })
    }
    const settings = dialog.querySelector<HTMLDetailsElement>('.player-chat-options')
    if (settings && settingsOpen) settings.open = true
    const practiceList = dialog.querySelector<HTMLDetailsElement>('.group-practice-card details')
    if (practiceList && practiceListOpen) practiceList.open = true
    const history = dialog.querySelector<HTMLElement>('.player-chat-messages')
    if (history) history.scrollTop = history.scrollHeight - historyAnchor
    bindTeamChatAvatars(dialog)
    click('[data-player-back]',()=>{back()})
    click('[data-player-retry]',()=>{if(pending)void act(pending)})
    click('[data-player-refresh]',()=>{if(page==='room'&&room)void run(()=>loadRoom(room!.id));else void openInbox()})
    click('[data-player-group]',()=>{page='group';selected.clear();groupName='';notice='';render(true)})
    click('[data-player-invite]',()=>{void act({action:'invite',token:newPlayerChatInvite()})})
    click('[data-player-group-invite]',()=>{if(room)void act({action:'invite',room:room.id,token:newPlayerChatInvite()})})
    click('[data-player-icon]',button=>{
      const target=room
      if (!target?.manage || iconEditor) return
      iconEditor=openChatIconEditor({name:target.title,logo:target.logo,kind:'Group'},active,async photo=>{
        const {data}=await client.auth.getSession()
        if (!active() || data.session?.user.id!==owner) throw Error('Sign in again to update the icon.')
        const path=playerChatApiUrl()+'/branding', body={room:target.id,photo:photo?.base64??null}
        const headers={Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'}
        const response=await CapacitorHttp.post({url:'https://www.tenaceiq.com'+path,headers,data:body,responseType:'json',
          disableRedirects:true,connectTimeout:12000,readTimeout:20000})
        if (!active() || response.status!==200 || response.data?.ok!==true || response.data?.releaseScope!=='first-party' ||
          response.data?.owner!==owner || response.data?.roomId!==target.id || response.data?.hasLogo!==Boolean(photo)) {
          throw Error('The icon change could not be confirmed. Refresh your chat.')
        }
      },changed=>{
        iconEditor=null
        if (!active()) return
        if (changed) void run(()=>loadRoom(target.id))
        else button.focus()
      })
    })
    click('[data-practice-start]',()=>{practiceDraft=newGroupPracticeDraft();render();dialog.querySelector<HTMLElement>('[data-group-practice] input')?.focus()})
    click('[data-practice-edit]',()=>{
      if (!room?.practice?.revision) return
      practiceDraft=newGroupPracticeDraft(room.practice)
      render()
      dialog.querySelector<HTMLElement>('[data-group-practice] input')?.focus()
    })
    click('[data-practice-dismiss]',()=>{practiceDraft=null;render();dialog.querySelector<HTMLElement>('[data-practice-start],[data-practice-edit]')?.focus()})
    click('[data-practice-cancel]',()=>{
      if (room?.practice && confirm('Cancel this practice for everyone?')) void act({action:'practice_cancel',room:room.id,id:room.practice.id})
    })
    click('[data-practice-rsvp]',button=>{
      const response=button.dataset.practiceRsvp
      if (room?.practice && (response==='in'||response==='out')) void act({action:'practice_reply',room:room.id,id:room.practice.id,response})
    })
    click('[data-player-direct]',button=>{if(button.dataset.playerDirect)void act({action:'direct',target:button.dataset.playerDirect})})
    click('[data-player-forget]',button=>{
      if(button.dataset.playerForget && confirm('Remove this player from your contacts?'))void act({action:'forget',target:button.dataset.playerForget})
    })
    click('[data-player-room]',button=>{if(button.dataset.playerRoom)void openRoom(button.dataset.playerRoom)})
    click('[data-player-accept]',()=>{if(token)void act({action:'join',token})})
    click('[data-player-revoke]',()=>{if(shared)void act({action:'revoke',token:shared.token,...(shared.room?{room:shared.room}:{})})})
    click('[data-player-revoke-links]',()=>{if(room && confirm('Turn off links to this group?'))void act({action:'revoke_links',room:room.id})})
    click('[data-player-leave]',()=>{if(room&&confirm(room.manage?'Close this group for everyone?':'Leave this group?'))void act({action:'leave',room:room.id})})
    click('[data-player-block]',button=>{
      if(room&&button.dataset.playerBlock&&confirm('Block this player?'))void act({action:'block',room:room.id,target:button.dataset.playerBlock})
    })
    click('[data-player-remove]',button=>{
      if(room&&button.dataset.playerRemove&&confirm('Remove this player from the group?'))void act({action:'remove',room:room.id,target:button.dataset.playerRemove})
    })
    click('[data-player-copy]',()=>{if(shared)void run(async ()=>{
      await Clipboard.write({string:playerChatInviteHref(shared!.token)}); notice='Link copied.'
    })})
    click('[data-player-share]',()=>{if(shared)void run(async ()=>{
      await Share.share({title:'TenAceIQ invitation',url:playerChatInviteHref(shared!.token)})
    })})
    click('[data-player-earlier]',()=>{
      const previous=room,first=previous?.messages[0]
      if (!previous||!first) return
      if (history) historyAnchor = history.scrollHeight - history.scrollTop
      void run(async ()=>{
        const older=await transport.room(previous.id,teamChatCursor(first.createdAt,first.id))
        const seen=new Set(previous.messages.map(post=>post.id))
        room={...older,messages:[...older.messages.filter(post=>!seen.has(post.id)),...previous.messages]}
      },false).finally(()=>{historyAnchor=0;dialog.querySelector<HTMLElement>('.player-chat-messages')?.focus({preventScroll:true})})
    })
    form('[data-player-join]',fields=>{void preview(playerChatInviteToken(fields.get('invite')))})
    form('[data-player-create]',fields=>{
      groupName=String(fields.get('name')??'').trim(); selected.clear()
      for (const id of fields.getAll('players')) selected.add(String(id))
      if (selected.size>20) { notice='Choose up to 20 players.';render(true);return }
      void act({action:'group',id:crypto.randomUUID(),text:groupName,members:[...selected]})
    })
    form('[data-player-add]',fields=>{if(room)void act({action:'add',room:room.id,target:String(fields.get('player'))})})
    const practiceFields = (fields:FormData) => ({
      date:String(fields.get('date')??''),time:String(fields.get('time')??''),
      court:String(fields.get('court')??''),capacity:String(fields.get('capacity')??''),
    })
    dialog.querySelector<HTMLFormElement>('[data-group-practice]')?.addEventListener('input',event=>{
      practiceDraft={...practiceDraft,...practiceFields(new FormData(event.currentTarget as HTMLFormElement))}
    })
    form('[data-group-practice]',fields=>{
      if (!room?.manage) return
      const next=practiceFields(fields)
      try {
        const currentPractice = room.practice
        const original = currentPractice ? newGroupPracticeDraft(currentPractice) : null
        const startsAt = original?.date===next.date && original.time===next.time && original.startsAt
          ? original.startsAt : groupPracticeStart(next.date,next.time)
        const change = {room:room.id,startsAt,court:next.court.trim(),capacity:Number(next.capacity)}
        if (practiceDraft?.revision && practiceDraft.id) {
          void act({action:'practice_edit',...change,id:practiceDraft.id,revision:practiceDraft.revision,request:crypto.randomUUID()})
        } else void act({action:'practice_create',...change,id:crypto.randomUUID()})
      } catch (error) { notice=message(error);render(true) }
    })
    form('[data-player-report]',(fields,element)=>{
      if(room&&element.dataset.playerReport)void act({action:'report',room:room.id,id:element.dataset.playerReport,text:String(fields.get('reason'))})
    })
    form('[data-player-send]',fields=>{
      draft=String(fields.get('body')??'')
      if(room&&draft.trim())void act({action:'send',room:room.id,id:crypto.randomUUID(),text:draft.trim()})
    })
    dialog.querySelector<HTMLTextAreaElement>('#player-chat-message')?.addEventListener('input',event=>{
      draft=(event.currentTarget as HTMLTextAreaElement).value
    })
    if (focus) dialog.querySelector<HTMLElement>(notice?'[role=status]':'h2')?.focus({preventScroll:true})
  }

  dialog.oncancel = event=>{event.preventDefault();back()}
  document.body.append(dialog); render(); dialog.showModal()
  if (initial.token) void preview(initial.token)
  else if (initial.room) void run(async ()=>{inbox=await transport.inbox();await loadRoom(initial.room!)})
  else void openInbox()
  return {isOpen:active,close:back,dispose,keepWhileHidden:true}
}
