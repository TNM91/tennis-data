import { App } from '@capacitor/app'
import { Capacitor,CapacitorHttp } from '@capacitor/core'
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
import { chatHitCard,groupPracticeCard,newGroupPracticeDraft,type ChatHitDraft,type GroupPracticeDraft } from './group-practice-card'
import { listedHittingClub } from '../../lib/hitting-clubs'
import { chatHitsHeader } from '../../lib/chat-hit-contract'
import { hittingPlanStart } from '../../lib/hitting-plan'
import { openCourtDirections } from './explore-court-directions'
import { readSavedCourts } from './explore-saved-courts'
import { firstPartyBuild } from './build-scope'
import { bindTeamChatAvatars,openChatIconEditor,teamChatAvatarHtml } from './team-chat-icon'
import { chatInboxOrder,playerInboxKey } from './chat-inbox-order'

type ComposerPage = 'new' | 'group'
const contactSearchKey = (value:string) => value.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase().trim()

export function playerChatsForAccount(client: SupabaseClient,owner: string,active: () => boolean,browser = false) {
  return playerChatTransport(owner,async ({query,action})=>{
    const {data,error} = await client.auth.getSession()
    if (error || data.session?.user.id !== owner || !active()) throw Error('Your chat session changed.')
    const path = playerChatApiUrl(query), method = action ? 'POST' : 'GET'
    const headers = {Authorization:'Bearer '+data.session.access_token,'Cache-Control':'no-store',
      ...(firstPartyBuild&&!browser&&query?.has('room')?{[chatHitsHeader]:'1'}:{}),
      ...(action?{'Content-Type':'application/json'}:{})}
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
  initial: { token?: string; room?: string; browser?: boolean; className?: string; compose?: boolean;
    preferences?: ReturnType<typeof chatInboxOrder>; closeToSource?: boolean } = {},
) {
  const dialog = document.createElement('dialog')
  dialog.className = 'team-invite-dialog player-chats-dialog'
  if (initial.className) dialog.classList.add(initial.className)
  dialog.setAttribute('aria-labelledby','player-chats-title')
  let disposed = false,busy = false,notice = '',draft = '',groupName = ''
  let page: 'inbox'|'room'|'invite'|'people'|ComposerPage = initial.token ? 'invite' : initial.room ? 'room' : initial.compose ? 'new' : 'inbox'
  let inviteReturn: ComposerPage | null = null
  let contactQuery = ''
  let inbox: PlayerChatInbox | null = null,room: PlayerChatRoom | null = null
  let invitation: { group: boolean; title: string } | null = null
  let token = initial.token ?? '',shared: { token: string; room?: string; expiresAt: string } | null = null
  let pending: PlayerChatAction | null = null
  let live: ReturnType<typeof watchTeamChat> | null = null
  let watchedRoom: string | null = null
  let historyAnchor = 0
  let practiceDraft: GroupPracticeDraft | null = null
  let hitDraft: ChatHitDraft | null = null
  let directions: ReturnType<typeof openCourtDirections> | undefined
  let contactTimer: ReturnType<typeof setTimeout> | undefined
  let contactWatchUntil = 0,contactRequest = 0,lastContactCheck = -Infinity,contactForeground = true
  let resumeHandle: Awaited<ReturnType<typeof App.addListener>> | undefined
  const listeners = new AbortController()
  const lastRead = new Map<string,string>()
  const selected = new Set<string>()
  const active = () => !disposed && current()
  const transport = playerChatsForAccount(client,owner,active,initial.browser)
  const preferences = initial.browser ? null : initial.preferences ?? chatInboxOrder(owner)
  let iconEditor: ReturnType<typeof openChatIconEditor> | null = null

  function dispose() {
    disposed = true
    listeners.abort()
    void resumeHandle?.remove()
    clearTimeout(contactTimer)
    iconEditor?.dispose()
    directions?.dispose()
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
    if (directions?.isOpen()) { directions.dispose(); return true }
    if (busy || !active()) return true
    if (page === 'people') {
      page='room'; notice=''; pending=null; contactQuery=''; selected.clear()
      if (room) watchRoom(room.id)
      render()
      ;(dialog.querySelector<HTMLElement>('[data-player-people]')??dialog.querySelector('h2'))?.focus({preventScroll:true})
    } else if (page === 'invite' && inviteReturn) {
      page=inviteReturn; inviteReturn=null; invitation=null; token=''; pending=null; notice=''; render(true)
    } else if (page === 'inbox' || initial.compose || initial.closeToSource) close()
    else { draft=''; pending=null; shared=null; void openInbox() }
    return true
  }
  function message(error: unknown) {
    return error instanceof Error ? error.message : 'Try again.'
  }
  async function run(work: () => Promise<void>,focus = true) {
    if (!active() || busy) return
    contactRequest++
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
      if (busy || iconEditor || directions?.isOpen() || draft || practiceDraft || hitDraft || readingHistory || dialog.contains(document.activeElement) && document.activeElement?.matches('input,textarea,select,summary')) {
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
    hitDraft=null
    page='inbox'; room=null; invitation=null; token=''; shared=null; inviteReturn=null
    return run(async ()=>{ inbox=await transport.inbox() })
  }
  function refreshContacts() {
    return run(async ()=>{
      inbox=await transport.inbox()
      const available = new Set(inbox.contacts.map(contact=>contact.id))
      for (const id of selected) if (!available.has(id)) selected.delete(id)
    })
  }
  function isComposing() { return page==='new'||page==='group' }
  function canCheckContactInvite() {
    return active() && contactForeground && isComposing() && shared && !shared.room && document.visibilityState==='visible'
  }
  function scheduleContactCheck() {
    clearTimeout(contactTimer)
    if (canCheckContactInvite() && Date.now()<contactWatchUntil) contactTimer=setTimeout(()=>{
      void checkForNewContacts().finally(scheduleContactCheck)
    },15_000)
  }
  async function checkForNewContacts() {
    if (!canCheckContactInvite() || busy || pending || Date.now()-lastContactCheck<2000) return
    lastContactCheck=Date.now()
    const request = ++contactRequest, invite = shared?.token
    try {
      const latest = await transport.inbox()
      if (!canCheckContactInvite() || request!==contactRequest || shared?.token!==invite) return
      const previous = inbox?.contacts ?? []
      if (latest.contacts.length===previous.length &&
        latest.contacts.every((contact,index)=>contact.id===previous[index]?.id&&contact.name===previous[index]?.name)) return
      const added = latest.contacts.some(contact=>!previous.some(old=>old.id===contact.id))
      inbox=latest
      paintSavedPlayers()
      if (added) {
        contactWatchUntil=0
        const status = dialog.querySelector<HTMLElement>('[data-contact-update]')
        if (status) status.textContent='New contact available.'
      }
    } catch { /* The picker stays usable and Refresh contacts can report a connection error. */ }
  }
  function resumeContactCheck() {
    if (canCheckContactInvite()) void checkForNewContacts()
    scheduleContactCheck()
  }
  function openComposer(next: ComposerPage) {
    if (page === next) return
    if (page !== 'new' && page !== 'group') {
      selected.clear(); groupName=''; contactQuery=''; shared=null
    } else if (next === 'new' && selected.size > 1) selected.clear()
    page=next; notice=''
    if (inbox) render(true)
    else void refreshContacts()
  }
  function openPeople() {
    if (!room?.manage || busy || pending) return
    const id=room.id
    selected.clear(); contactQuery=''; page='people'; stopLive()
    void run(async ()=>{
      const [latest,contacts] = await Promise.all([transport.room(id),transport.inbox()])
      if (!active()) return
      if (!latest.manage) { room=latest; page='room'; watchRoom(id); throw Error('Only the group owner can add people.') }
      room=latest; inbox=contacts
    })
  }
  function addPeople() {
    const target=room
    if (!target?.manage || !selected.size) return
    const choices=savedPlayers().filter(contact=>selected.has(contact.id))
    if (!choices.length || choices.length>31-target.members.length) {
      notice='Choose up to '+Math.max(0,31-target.members.length)+' more players.'
      render(true)
      return
    }
    void run(async ()=>{
      let reason = ''
      const added: typeof choices = []
      for (const contact of choices) {
        if (!active()) return
        try {
          await transport.act({action:'add',room:target.id,target:contact.id})
          selected.delete(contact.id)
          added.push(contact)
        } catch (error) {
          if (error instanceof PlayerChatError && error.status===403) {
            reason='Check that the remaining players are still in your contacts.'
            continue
          }
          reason=error instanceof PlayerChatError && error.status===409
            ? 'The group may be full.' : 'Check your connection and try again.'
          break
        }
      }
      if (!active()) return
      room=await transport.room(target.id).catch(()=>({...target,members:[...target.members,...added]}))
      for (const member of room.members) selected.delete(member.id)
      const result=added.length===1?'1 player added.':`${added.length} players added.`
      notice=reason?(added.length?result+' ':'')+'Some players couldn’t be added. '+reason:result
    })
  }
  function openRoom(id: string) {
    stopLive()
    hitDraft=null
    draft=''; room=null; shared=null; page='room'
    return run(()=>loadRoom(id))
  }
  function preview(code: string) {
    if (!code) { notice='Paste a TenAceIQ chat invite link.'; render(true); return }
    inviteReturn=page==='new'||page==='group'?page:null
    token=code; page='invite'; invitation=null
    return run(async ()=>{ invitation = await transport.preview(code) })
  }

  function act(input: PlayerChatAction) {
    const hitChange = input.action==='hit_propose' || input.action==='hit_reply' || input.action==='hit_cancel'
    return run(async ()=>{
      pending=input
      let result
      try { result=await transport.act(input) }
      catch (error) {
        if (error instanceof PlayerChatError && error.status >= 400 && error.status < 500) {
          pending=null
          if (error.status===403 && page==='room' && !hitChange) room=null
          if (hitChange && (error.status===403 || error.status===409) && room) {
            hitDraft=null
            await loadRoom(room.id).catch(()=>undefined)
          }
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
        if (!input.room && isComposing()) {
          contactWatchUntil=Date.now()+90_000
          scheduleContactCheck()
        }
        return
      }
      if (input.action === 'group' || input.action === 'direct' || input.action === 'join') {
        shared=null
        if (result.roomId) {
          if (input.action === 'join') { token=''; invitation=null; inviteReturn=null }
          page='room'
          await loadRoom(result.roomId)
        } else if (input.action==='join' && result.contact) {
          token=''; invitation=null; page=inviteReturn??'inbox'; inviteReturn=null
          inbox=await transport.inbox()
          if ((page==='new'||page==='group') && inbox.contacts.some(contact=>contact.id===result.contact)) {
            if (page==='new') selected.clear()
            selected.add(result.contact)
            contactQuery=''
          }
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
      if (hitChange) {
        hitDraft=null
        notice=input.action==='hit_propose'?'Proposal sent.':
          input.action==='hit_cancel'?'Hitting plan cancelled.':
            input.response==='accepted'?'Confirmed. Added to both calendars.':'Proposal declined.'
      }
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
      <p>Expires ${html(new Date(shared.expiresAt).toLocaleDateString())}. ${shared.room?'Anyone you share this link with can sign in and join.':'Share this link with one player. When they accept, you’ll appear in each other’s contacts.'}</p>
      <div class="player-chat-actions">${simpleButton('Share invite','data-player-share')}${simpleButton('Copy link','data-player-copy')}
      ${simpleButton('Revoke link','data-player-revoke')}</div></section>`
  }
  function inboxMarkup() {
    const conversations = inbox?.rooms.map(item=>`<li>${simpleButton(teamChatAvatarHtml(item.title,item.logo)+html(item.title)+(item.unread?' <small>New</small>':''),'data-player-room',item.id)}</li>`).join('')
    return `<div class="player-chat-actions">${initial.browser?'':simpleButton('New chat','data-player-new')}${simpleButton('New group','data-player-group')}${simpleButton(initial.browser?'Connect a player':'Add contact','data-player-invite')}</div>
      ${sharedMarkup()}<form data-player-join><label>Have an invite link?<input name="invite" type="url" autocomplete="off" placeholder="Paste invite link" required></label>
      <button class="secondary" type="submit">Review invite</button></form>
      <section class="player-chat-section"><h3>Conversations</h3><ul>${conversations||'<li>No conversations yet.</li>'}</ul></section>
      <section class="player-chat-section"><h3>My players</h3><ul>${inbox?.contacts.length?contactRows(inbox.contacts):'<li>Share a contact invite to save your first player.</li>'}</ul></section>`
  }
  function savedPlayers() {
    const contacts = inbox?.contacts ?? []
    return page==='people' ? contacts.filter(contact=>!room?.members.some(member=>member.id===contact.id)) : contacts
  }
  function contactPicker() {
    return `<fieldset class="player-chat-contact-picker"><legend>Saved players</legend>
      <label for="player-contact-search" class="sr-only">Find a saved player</label>
      <input id="player-contact-search" type="search" value="${html(contactQuery)}" maxlength="100" placeholder="Find a saved player" autocomplete="off">
      <div class="player-chat-contact-list"></div><p data-no-contact-match hidden></p>
      <p data-contact-update role="status"></p>
    </fieldset>`
  }
  function paintSavedPlayers() {
    const list = dialog.querySelector<HTMLElement>('.player-chat-contact-list')
    const empty = dialog.querySelector<HTMLElement>('[data-no-contact-match]')
    if (!list || !empty) return
    const choices = savedPlayers()
    const available = new Set(choices.map(contact=>contact.id))
    for (const id of selected) if (!available.has(id)) selected.delete(id)
    const focused = list.contains(document.activeElement) ? (document.activeElement as HTMLInputElement).value : ''
    list.innerHTML=choices.map(contact=>
      `<label class="player-chat-contact" data-contact-name="${html(contact.name)}">
        ${teamChatAvatarHtml(contact.name)}<span>${html(contact.name)}</span>
        <input type="${page==='new'?'radio':'checkbox'}" name="players" value="${html(contact.id)}"${selected.has(contact.id)?' checked':''}>
      </label>`).join('')
    filterSavedPlayers()
    if (focused) [...list.querySelectorAll('input')].find(input=>input.value===focused)?.focus({preventScroll:true})
    updatePlayerSubmit()
  }
  function filterSavedPlayers() {
    const rows = [...dialog.querySelectorAll<HTMLLabelElement>('[data-contact-name]')]
    const empty = dialog.querySelector<HTMLElement>('[data-no-contact-match]')
    if (!empty) return
    const query=contactSearchKey(contactQuery)
    for (const row of rows) row.hidden = !contactSearchKey(row.dataset.contactName??'').includes(query)
    empty.hidden = !inbox || rows.some(row=>!row.hidden)
    empty.textContent = rows.length ? 'No saved players match.' : page==='people'
      ? 'No saved players to add. Share an invite link to bring someone in.'
      : 'No saved players yet. Add a contact to start chatting.'
  }
  function updatePlayerSubmit() {
    const submit=dialog.querySelector<HTMLButtonElement>('[data-player-pick] button[type="submit"]')
    if (submit) submit.disabled=!inbox || page!=='group'&&!selected.size
  }
  function composerMarkup(group: boolean) {
    const contacts = inbox?.contacts ?? []
    const name = `<label>Group name<input name="name" maxlength="80" value="${html(groupName)}" placeholder="Friday practice" required></label>`
    if (initial.browser) return `<form data-player-create>${name}
      ${contacts.length?`<fieldset><legend>Add saved players</legend>${contacts.map(contact=>
        `<label class="entry-check"><input type="checkbox" name="players" value="${html(contact.id)}"${selected.has(contact.id)?' checked':''}>${html(contact.name)}</label>`).join('')}</fieldset>`:
        '<p>Create the group, then share its invite link with your players.</p>'}
      <button type="submit">Create group</button></form>`
    const typeButton = (label: string, target: ComposerPage) =>
      `<button class="secondary" type="button" data-player-mode="${target}" aria-pressed="${page===target}">${label}</button>`
    return `<div class="player-chat-modes" role="group" aria-label="Chat type">${typeButton('One player','new')}${typeButton('Group','group')}</div>
      <form data-player-create data-player-pick>
        ${group?name:''}
        ${contactPicker()}
        <button type="submit">${group?'Create group':'Start chat'}</button>
      </form>
      <div class="player-chat-actions">${simpleButton('Add contact','data-player-invite')}${simpleButton('Refresh contacts','data-player-refresh-contacts')}</div>
      ${sharedMarkup()}
      <details class="player-chat-paste-invite"><summary>Use a contact invite</summary>
        <form data-player-join><label>Invite link<input name="invite" type="url" autocomplete="off" placeholder="Paste invite link" required></label>
        <button class="secondary" type="submit">Review invite</button></form>
      </details>`
  }
  function peopleMarkup() {
    return `<form data-player-add-many data-player-pick>
      ${contactPicker()}
      <button type="submit">Add selected players</button>
    </form>
    <section class="player-chat-invite">
      <h3>Invite by link</h3>
      <p>Players can sign in or create a free account, then join this group.</p>
      ${shared&&shared.room===room?.id?sharedMarkup():simpleButton('Create invite link','data-player-group-invite')}
    </section>`
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
    const isPinned = preferences?.read().pinned.includes(playerInboxKey(value.id))
    return `<div class="player-chat-actions">
      ${preferences?`<button type="button" class="secondary" data-player-pin aria-label="${html((isPinned?'Unpin ':'Pin ')+value.title)}" aria-pressed="${isPinned}">${isPinned?'Unpin chat':'Pin chat'}</button>`:''}
      ${value.manage&&initial.browser?simpleButton(shared?'Replace invite link':'Invite players','data-player-group-invite'):''}</div>
      ${value.practice!==undefined?groupPracticeCard(value.practice,value.manage,practiceDraft):''}
      ${value.hit!==undefined?chatHitCard(value.hit,owner,hitDraft,readSavedCourts(owner)):''}
      ${sharedMarkup()}
      <details class="player-chat-options"><summary>${value.group?'Group settings':'Player settings'}</summary>
      ${value.manage?`${initial.browser?'':simpleButton(value.logo?'Edit group icon':'Add group icon','data-player-icon')}
      ${simpleButton('Turn off invite links','data-player-revoke-links')}
      ${initial.browser&&choices.length?`<form data-player-add><label>Add a saved player<select name="player">${choices.map(contact=>`<option value="${html(contact.id)}">${html(contact.name)}</option>`).join('')}</select></label>
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
    const title = page==='room' ? room?.title ?? 'Conversation' : page==='group' ? 'New group' : page==='new' ? 'New chat' : page==='people' ? 'Add people' : page==='invite' ? 'Chat invitation' : 'Players & groups'
    const contents = page==='inbox' ? inboxMarkup() : isComposing() ? composerMarkup(page==='group') : page==='people' ? peopleMarkup() : page==='room' && room ? roomMarkup(room) :
      page==='invite' && invitation ? `<p>${invitation.group?'Join':'Connect with'} <strong>${html(invitation.title)}</strong>.</p>
      <button type="button" data-player-accept>${invitation.group?'Join group':'Save player'}</button>` : ''
    const backLabel = page==='inbox'||(initial.compose||initial.closeToSource)&&page!=='invite'&&page!=='people'?'Close':'Back'
    const backName = backLabel==='Close'?'Close':page==='people'?'Back to group':page==='invite'&&inviteReturn?'Back to new chat':'Back to players &amp; groups'
    dialog.innerHTML = `<header class="team-invite-heading"><h2 id="player-chats-title" tabindex="-1">${page==='room'&&room?.logo?teamChatAvatarHtml(title,room.logo):''}${html(title)}</h2>
      <div class="player-chat-header-actions">${page==='room'&&room?.manage&&!initial.browser?simpleButton('Add people','data-player-people'):''}
      <button class="secondary" type="button" data-player-back aria-label="${backName}">${backLabel}</button></div></header>
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
    click('[data-player-people]',openPeople)
    click('[data-player-refresh]',()=>{if(page==='room'&&room)void run(()=>loadRoom(room!.id));else void openInbox()})
    click('[data-player-new]',()=>{openComposer('new')})
    click('[data-player-group]',()=>{openComposer('group')})
    click('[data-player-mode]',button=>{const next=button.dataset.playerMode;if(next==='new'||next==='group')openComposer(next)})
    click('[data-player-refresh-contacts]',()=>{void refreshContacts()})
    click('[data-player-pin]',button=>{
      if (!room || !preferences) return
      const key=playerInboxKey(room.id)
      preferences.toggle(key)
      const pinned=preferences.read().pinned.includes(key)
      button.textContent=pinned?'Unpin chat':'Pin chat'
      button.setAttribute('aria-pressed',String(pinned))
      button.setAttribute('aria-label',(pinned?'Unpin ':'Pin ')+room.title)
    })
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
    click('[data-chat-hit-start]',()=>{
      const home=listedHittingClub(readSavedCourts(owner).home)
      hitDraft={date:'',time:'',clubId:home?.id??''}
      render()
      dialog.querySelector<HTMLInputElement>('[data-chat-hit-form] input')?.focus()
    })
    click('[data-chat-hit-dismiss]',()=>{
      hitDraft=null;render()
      dialog.querySelector<HTMLButtonElement>('[data-chat-hit-start]')?.focus()
    })
    click('[data-chat-hit-reply]',button=>{
      const response=button.dataset.chatHitReply
      if (room?.hit && (response==='accepted'||response==='declined')) void act({action:'hit_reply',room:room.id,id:room.hit.id,response})
    })
    click('[data-chat-hit-cancel]',()=>{
      if (room?.hit && confirm(room.hit.status==='proposed'?'Withdraw this proposal?':'Cancel this hit for both players?')) {
        void act({action:'hit_cancel',room:room.id,id:room.hit.id})
      }
    })
    click('[data-chat-hit-directions]',button=>{
      const court=listedHittingClub(room?.hit?.clubId)
      if (court && !directions?.isOpen()) directions=openCourtDirections(court,button,active)
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
        room={...previous,more:older.more,messages:[...older.messages.filter(post=>!seen.has(post.id)),...previous.messages]}
      },false).finally(()=>{historyAnchor=0;dialog.querySelector<HTMLElement>('.player-chat-messages')?.focus({preventScroll:true})})
    })
    form('[data-player-join]',fields=>{void preview(playerChatInviteToken(fields.get('invite')))})
    const composer = dialog.querySelector<HTMLFormElement>('[data-player-create],[data-player-add-many]')
    const search = composer?.querySelector<HTMLInputElement>('#player-contact-search')
    if (search) {
      search.oninput=()=>{
        contactQuery = search.value
        filterSavedPlayers()
      }
      search.onkeydown=event=>{if(event.key==='Enter'&&!event.isComposing)event.preventDefault()}
      paintSavedPlayers()
    }
    composer?.addEventListener('input',event=>{
      const input = event.target
      if (!(input instanceof HTMLInputElement)) return
      if (input.name==='name') groupName=input.value
      if (input.name!=='players') return
      if (page==='new') selected.clear()
      if (input.checked) selected.add(input.value)
      else selected.delete(input.value)
      updatePlayerSubmit()
    })
    form('[data-player-create]',fields=>{
      if (page==='new') {
        const [target] = selected
        if (target) void act({action:'direct',target})
        return
      }
      groupName=String(fields.get('name')??'').trim()
      if (!groupName) { notice='Enter a group name.';render(true);return }
      if (selected.size>20) { notice='Choose up to 20 players.';render(true);return }
      void act({action:'group',id:crypto.randomUUID(),text:groupName,members:[...selected]})
    })
    form('[data-player-add]',fields=>{if(room)void act({action:'add',room:room.id,target:String(fields.get('player'))})})
    form('[data-player-add-many]',addPeople)
    const hitFields = (fields:FormData) => ({
      date:String(fields.get('date')??''),time:String(fields.get('time')??''),clubId:String(fields.get('clubId')??''),
    })
    dialog.querySelector<HTMLFormElement>('[data-chat-hit-form]')?.addEventListener('input',event=>{
      hitDraft=hitFields(new FormData(event.currentTarget as HTMLFormElement))
    })
    form('[data-chat-hit-form]',fields=>{
      if (!room || room.group || !hitDraft) return
      const next=hitFields(fields), start=hittingPlanStart(next)
      if (!listedHittingClub(next.clubId) || !start || start.getTime()<=Date.now()) {
        notice='Choose a listed club and an upcoming Central start time.'
        render(true)
        return
      }
      void act({action:'hit_propose',room:room.id,id:crypto.randomUUID(),...next})
    })
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

  if (!initial.browser) {
    document.addEventListener('visibilitychange',resumeContactCheck,{signal:listeners.signal})
    window.addEventListener('focus',resumeContactCheck,{signal:listeners.signal})
    if (Capacitor.isNativePlatform()) void App.addListener('appStateChange',state=>{
      contactForeground=state.isActive
      if (state.isActive) resumeContactCheck()
      else clearTimeout(contactTimer)
    }).then(handle=>{if(disposed)void handle.remove();else resumeHandle=handle}).catch(()=>{})
  }
  dialog.oncancel = event=>{event.preventDefault();back()}
  document.body.append(dialog); render(); dialog.showModal()
  if (initial.token) void preview(initial.token)
  else if (initial.room) void run(async ()=>{inbox=await transport.inbox();await loadRoom(initial.room!)})
  else if (initial.compose) void refreshContacts()
  else void openInbox()
  return {isOpen:active,close:back,dispose,keepWhileHidden:true}
}
