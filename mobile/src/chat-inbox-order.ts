import type { TeamChatOption,TeamScope } from './team-room-data'
import type { PlayerChatSummary } from '../../lib/player-chats-contract'
import { html } from './html'
import { bindTeamChatAvatars,teamChatAvatarHtml } from './team-chat-icon'
import { teamLeagueLabel } from '../../lib/private-team-contract'
import type { ChatUnread } from './chat-unread'
import type { CoachInboxSearch } from './coach-chats-inbox'
import { coachChatInitials } from './coach-chats-data'
import websiteUi from '../generated/website-ui.json'
import { nativeActionIcon } from './native-action-icons'
import { chatTimestamp } from '../../lib/chat-timestamp'

type Entry = {
  key: string; title: string; subtitle: string; icon?: string; activity?: string
  unread?: boolean; searchText?: string; searchSubtitle?: string; initials?: string
  open: (trigger:HTMLButtonElement) => void
}
type Preferences = { sort: 'sections' | 'recent'; pinned: string[] }
export type ChatInboxFilters = { query: string; unreadOnly: boolean }
type CoachSearch = { snapshot: () => CoachInboxSearch; open: (id:string,trigger:HTMLButtonElement) => void;
  setPins: (keys:readonly string[],toggle:(key:string)=>void) => void }
const searchWords = (value:string) => value.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean)
const activityTime = new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'})
const activityDay = new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'})
const activityPastYear = new Intl.DateTimeFormat(undefined,{year:'numeric',month:'short',day:'numeric'})

function recentActivityTime(value:string|undefined,today:Date,yesterday:Date){
  if(!value)return ''
  const date=new Date(value)
  if(!Number.isFinite(date.getTime()))return ''
  let label:string
  if(date.toDateString()===today.toDateString())label=activityTime.format(date)
  else if(date.toDateString()===yesterday.toDateString())label='Yesterday'
  else label=(date.getFullYear()===today.getFullYear()?activityDay:activityPastYear).format(date)
  const exact=date.toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})
  return `<time datetime="${html(value)}" title="${html(exact)}"><span class="sr-only">Last message: </span>${html(label)}</time>`
}

export const teamInboxKey = (scope: TeamScope) => JSON.stringify(['team',scope.teamName,scope.leagueName,scope.flight])
export const playerInboxKey = (id: string) => 'chat:'+id
const teamRoomInboxKey = (id: string) => 'team-chat:'+id
export const coachInboxKey = (id: string) => 'coach:'+id

export function chatInboxOrder(owner: string) {
  const key = 'tenaceiq:chat-inbox-order:v1:'+owner
  let current: Preferences = {sort:'sections',pinned:[]}
  try {
    const saved = JSON.parse(localStorage.getItem(key)??'null')
    if (saved?.sort==='sections'||saved?.sort==='recent') {
      const savedPins: unknown[] = Array.isArray(saved.pinned) ? saved.pinned : []
      const pinned = savedPins.filter((id):id is string=>typeof id==='string'&&id.length<=640)
      current = {sort:saved.sort,pinned:[...new Set(pinned)].slice(0,30)}
    }
  } catch { /* A blocked device store still allows in-session preferences. */ }
  function save() {
    try { localStorage.setItem(key,JSON.stringify(current)) } catch { /* Preferences remain available in the current session. */ }
  }
  return {
    read:()=>current,
    sort(value:Preferences['sort']) { current={...current,sort:value}; save() },
    toggle(id:string) {
      current={...current,pinned:current.pinned.includes(id)?current.pinned.filter(item=>item!==id):[id,...current.pinned].slice(0,30)}
      save()
    },
  }
}

export function orderedChatInbox(entries: Entry[], order: Preferences) {
  const index = new Map(entries.map(entry=>[entry.key,entry]))
  const pinned = order.pinned.flatMap(key=>index.get(key)??[])
  const pinnedKeys = new Set(order.pinned)
  const recent = entries.filter(entry=>!pinnedKeys.has(entry.key)).map(entry=>({
    entry, time:entry.activity ? chatTimestamp(entry.activity) : null,
  })).sort((a,b)=>{
    if(a.time===b.time)return a.entry.title.localeCompare(b.entry.title)
    if(a.time===null)return 1
    if(b.time===null)return -1
    return a.time>b.time?-1:1
  }).map(({entry})=>entry)
  return {pinned,recent}
}

export function mountChatInboxOrder(
  host: HTMLElement, teamOptions: TeamChatOption[], preferences: ReturnType<typeof chatInboxOrder>,
  load: () => Promise<PlayerChatSummary[]>, openPlayer: (id:string,trigger:HTMLButtonElement) => void,
  openTeam: (scope:TeamScope) => void,
  filters: ChatInboxFilters, coach: CoachSearch, refreshSources: () => Promise<unknown>,
) {
  const pinned = host.querySelector<HTMLElement>('[data-chats-pinned]')!
  const recent = host.querySelector<HTMLElement>('[data-chats-recent]')!
  const recentList = recent.querySelector('ul')!
  const recentRefresh = recent.querySelector<HTMLButtonElement>('[data-recent-refresh]')!
  const recentStatus = recent.querySelector<HTMLElement>('[role="status"]')!
  const conversations = host.querySelector<HTMLElement>('[data-chats-players]')!
  const teamsSection = host.querySelector<HTMLElement>('#chats-team-inbox')!
  const coachSection = host.querySelector<HTMLElement>('[data-coach-chats]')!
  const results = host.querySelector<HTMLElement>('[data-chats-find]')!
  const heading = results.querySelector<HTMLElement>('h2')!
  const search = host.querySelector<HTMLInputElement>('#chat-inbox-search')!
  const unreadOnly = host.querySelector<HTMLButtonElement>('[data-inbox-unread]')!
  const retry = results.querySelector<HTMLButtonElement>('[data-inbox-retry]')!
  const status = results.querySelector<HTMLElement>('[role="status"]')!
  const sort = host.querySelector<HTMLSelectElement>('[data-chat-inbox-order]')!
  const toolbar = sort.closest<HTMLElement>('.chats-inbox-toolbar')!
  const signal = new AbortController()
  const alive = () => sort.isConnected && !signal.signal.aborted
  const teamRows = Array.from(teamsSection.querySelectorAll<HTMLElement>('[data-chat-team-row]'))
  const teamEntries = teamOptions.map((team):Entry=>({
    key:teamInboxKey(team),title:team.teamName,
    subtitle:[teamLeagueLabel(team),team.flight].filter(Boolean).join(' · '),searchText:'General',
    searchSubtitle:['General',teamLeagueLabel(team),team.flight].filter(Boolean).join(' · '),icon:team.teamLogoUrl,
    open:()=>openTeam(team),
  }))
  let players: Entry[] = []
  let teamChats: Entry[][] = []
  let playerRequest:Promise<void>|null = null
  let refreshRequest:Promise<void>|null = null
  let pendingPlayerRefresh=false
  let playerStatus: 'loading'|'ready'|'unavailable' = 'loading'
  let refreshing = false
  let summary: ChatUnread|null = null
  let teamUnread = new Map<string, number>()
  let generalUnread = new Map<string, number>()
  const renderedLists = new WeakMap<HTMLElement,string>()
  search.value=filters.query
  function pinButton(entry:Entry){
    const isPinned = preferences.read().pinned.includes(entry.key)
    return `<button type="button" class="secondary chat-pin" data-organized-pin aria-label="${html((isPinned?'Unpin ':'Pin ')+entry.title)}" aria-pressed="${isPinned}">${nativeActionIcon('pin')}</button>`
  }
  function fillList(list:HTMLElement,entries:Entry[],nested=false){
    const today=new Date(),yesterday=new Date(today)
    yesterday.setDate(today.getDate()-1)
    const markup=entries.map(entry=>{
      let avatar=teamChatAvatarHtml(entry.title,entry.icon)
      if(entry.initials)avatar=`<span class="chats-team-avatar" aria-hidden="true">${html(entry.initials)}</span>`
      else if(nested&&!entry.icon)avatar=`<span class="chats-team-avatar chat-team-channel-icon" aria-hidden="true">${websiteUi.icons.teams}</span>`
      const timestamp=list===recentList?recentActivityTime(entry.activity,today,yesterday):''
      const subtitle=nested?'':`<span class="chats-row-meta"><span>${html(entry.subtitle)}</span>${timestamp}</span>`
      return `<li class="chat-organized-row"><button type="button" class="secondary chats-team-card" data-organized-open>
        ${avatar}<span class="chats-team-copy"><strong>${html(entry.title)}</strong>${subtitle}</span>
        <span class="chat-unread-badge" data-organized-unread hidden></span><span aria-hidden="true">›</span>
        </button>${pinButton(entry)}</li>`
    }).join('')
    const unchanged=renderedLists.get(list)===markup
    if(!unchanged){list.innerHTML=markup;renderedLists.set(list,markup)}
    list.querySelectorAll<HTMLLIElement>('li').forEach((row,index)=>{
      const open = row.querySelector<HTMLButtonElement>('[data-organized-open]')!
      const entry=entries[index]
      open.dataset.focusKey=entry.key
      open.onclick=()=>entry.open(open)
      const pin=row.querySelector<HTMLButtonElement>('[data-organized-pin]')
      if(pin){pin.dataset.focusKey=entry.key;pin.onclick=()=>toggle(entry.key)}
    })
    if(!unchanged)bindTeamChatAvatars(list)
  }
  function section(element:HTMLElement,entries:Entry[]){
    element.hidden=entries.length===0
    fillList(element.querySelector('ul')!,entries)
  }
  function paintUnread(){
    const unread=new Map(players.filter(entry=>entry.unread).map(entry=>[entry.key,'New']))
    for(const [key,count] of teamUnread) if(count)unread.set(key,count===100?'99+':String(count))
    if(summary?.coach?.available){
      for(const {id,unread:count} of summary.coach.connections)if(count)unread.set(coachInboxKey(id),count===100?'99+':String(count))
    }
    for(const button of host.querySelectorAll<HTMLButtonElement>('[data-organized-open]')){
      const badge=button.querySelector<HTMLElement>('[data-organized-unread]')!
      const key=button.dataset.focusKey!
      const count=button.closest('[data-chats-find]')?generalUnread.get(key):undefined
      badge.textContent=count===undefined?unread.get(key)??'':count===100?'99+':String(count||'')
      badge.hidden=!badge.textContent
      if(badge.textContent && badge.textContent!=='New')badge.setAttribute('aria-label',badge.textContent+' unread messages')
      else badge.removeAttribute('aria-label')
    }
  }
  function coachEntries(snapshot:CoachInboxSearch):Entry[]{
    const counts=new Map(summary?.coach?.connections.map(connection=>[connection.id,connection]))
    return snapshot.connections.map(connection=>({
      key:coachInboxKey(connection.id),title:connection.name,initials:coachChatInitials(connection.name),
      subtitle:connection.role==='coach'?'Your player':connection.name==='Your coach'?'Coach chat':'Your coach',
      searchText:'coach player',activity:counts.get(connection.id)?.activityAt,
      unread:Boolean(counts.get(connection.id)?.unread),
      open:trigger=>coach.open(connection.id,trigger),
    }))
  }
  function searchResults(entries:Entry[],query:string[]){
    const matches=entries.flatMap(entry=>{
      const title=searchWords([entry.title,entry.subtitle,entry.searchText].filter(Boolean).join(' ')).join(' ')
      const unreadCount=generalUnread.get(entry.key)??teamUnread.get(entry.key)
      if(!query.every(word=>title.includes(word))||filters.unreadOnly&&!entry.unread&&!unreadCount)return []
      return [{...entry,subtitle:entry.searchSubtitle??entry.subtitle}]
    })
    const ordered=orderedChatInbox(matches,preferences.read())
    return [...ordered.pinned,...ordered.recent]
  }
  const pinSelector='[data-organized-pin],[data-chat-pin-team]'
  const openSelector='[data-organized-open],[data-coach-chat]'
  function toggle(key:string) {
    if (!alive()) return
    preferences.toggle(key)
    paint()
    Array.from(host.querySelectorAll<HTMLButtonElement>(pinSelector))
      .find(button=>button.dataset.focusKey===key&&button.getClientRects().length)?.focus()
  }
  function paint(){
    if(!alive())return
    const focused=document.activeElement
    const focusedKey=focused instanceof HTMLButtonElement&&host.contains(focused)?focused.dataset.focusKey:null
    const focusedSelector=focused instanceof HTMLButtonElement&&focused.matches(openSelector)?openSelector:pinSelector
    const words=searchWords(filters.query)
    const finding=words.length>0||filters.unreadOnly
    const order=preferences.read(), grouped=order.sort==='sections'
    const coachSnapshot=coach.snapshot()
    const entries=[...teamEntries,...teamChats.flat(),...players,...coachEntries(coachSnapshot)]
    const {pinned:favorite,recent:available}=orderedChatInbox(entries,order)
    teamsSection.hidden=finding||!grouped
    coachSection.hidden=finding||!grouped&&coachSnapshot.connections.length>0
    results.hidden=!finding
    toolbar.hidden=finding
    unreadOnly.setAttribute('aria-pressed',String(filters.unreadOnly))
    sort.value=order.sort
    section(pinned,finding?[]:favorite)
    recent.hidden=finding||grouped
    fillList(recentList,recent.hidden?[]:available)
    const loading=playerStatus==='loading'||coachSnapshot.status==='loading'
    const incomplete=playerStatus==='unavailable'||coachSnapshot.status==='unavailable'||summary===null||summary.coach?.available===false
    recentRefresh.disabled=refreshing
    let recentMessage=''
    if(refreshing)recentMessage='Refreshing chats…'
    else if(loading&&!available.length)recentMessage='Loading chats…'
    else if(!loading&&incomplete)recentMessage='Some chats couldn’t be checked.'
    else if(!loading&&!available.length)recentMessage='No unpinned chats.'
    if(recentStatus.textContent!==recentMessage)recentStatus.textContent=recentMessage
    section(conversations,!finding&&grouped?players.filter(entry=>!order.pinned.includes(entry.key)):[])
    coach.setPins(order.pinned,toggle)
    if(finding){
      const matched=searchResults(entries,words)
      heading.textContent=words.length?'Search results':'Unread chats'
      const count=matched.length===1?'1 chat found':`${matched.length} chats found`
      const message=loading?(matched.length?`${count} · Checking more chats…`:'Finding chats…')
        :incomplete?(matched.length?`${count} · Some chats couldn’t be checked.`:'Some chats couldn’t be checked.')
        :matched.length?(coachSnapshot.more?`${count} · Search includes your latest coach connections.`:count)
        :coachSnapshot.more?'No matches in the chats loaded here.':words.length?'No chats match your search.':'You’re all caught up.'
      if(status.textContent!==message)status.textContent=message
      retry.hidden=!incomplete||loading
      fillList(results.querySelector('ul')!,matched)
    }
    teamRows.forEach((row,index)=>{
      const entry=teamEntries[index], pin=row.querySelector<HTMLButtonElement>('[data-chat-pin-team]')!
      const isPinned=order.pinned.includes(entry.key)
      pin.parentElement!.toggleAttribute('data-team-pinned',isPinned)
      pin.setAttribute('aria-label',(isPinned?'Unpin ':'Pin ')+entry.title)
      pin.setAttribute('aria-pressed',String(isPinned))
      pin.dataset.focusKey=entry.key
      pin.onclick=()=>toggle(entry.key)
      const chats=teamChats[index]??[]
      const nested=row.querySelector<HTMLUListElement>('[data-team-channels]')!
      const visibleChats=chats.filter(chat=>!order.pinned.includes(chat.key))
      nested.parentElement!.hidden=visibleChats.length===0
      nested.parentElement!.querySelector('summary')!.textContent=isPinned?`${entry.title} chats`:'Team chats'
      fillList(nested,visibleChats,true)
      row.toggleAttribute('data-team-pinned',isPinned&&visibleChats.length===0)
    })
    paintUnread()
    if(focusedKey&&(document.activeElement!==focused||!focused?.getClientRects().length)){
      const replacement=Array.from(host.querySelectorAll<HTMLButtonElement>(focusedSelector))
        .find(button=>button.dataset.focusKey===focusedKey&&button.getClientRects().length)
      ;(replacement??search).focus({preventScroll:true})
    }
  }
  function paintActivity(){
   if(!alive())return
   // Leave the newest row in view when the reader is at the top of Recent.
   if(recent.hidden||recentList.getBoundingClientRect().top>=0){paint();return}
   const rows=Array.from(recentList.querySelectorAll<HTMLButtonElement>('[data-organized-open]'))
   const visible=rows.flatMap(row=>{
    const bounds=row.getBoundingClientRect()
    return bounds.bottom>0&&bounds.top<window.innerHeight?[{key:row.dataset.focusKey,top:bounds.top}]:[]
   })
   paint()
   const updated=new Map(Array.from(recentList.querySelectorAll<HTMLButtonElement>('[data-organized-open]'),row=>[row.dataset.focusKey,row]))
   for(const anchor of visible){
    const row=updated.get(anchor.key)
    if(!row)continue
    const delta=row.getBoundingClientRect().top-anchor.top
    if(Math.abs(delta)>=1)window.scrollBy(0,delta)
    break
   }
  }
  const refresh=()=>{
   if(playerRequest)return playerRequest
   playerStatus='loading'
   paint()
   playerRequest=load().then(rooms=>{
    if(!alive())return
    playerStatus='ready'
    players=rooms.map(room=>({
      key:playerInboxKey(room.id),title:room.title,subtitle:room.group?'Group chat':'Direct message',
      icon:room.logo,unread:room.unread,activity:room.activityAt,open:button=>openPlayer(room.id,button),
    }))
    paintActivity()
   }).catch(()=>{
    if(!alive())return
    playerStatus='unavailable'
    paintActivity()
   }).finally(()=>{
    playerRequest=null
    if(pendingPlayerRefresh&&alive()){
     pendingPlayerRefresh=false
     void refresh()
    }
   })
   return playerRequest
  }
  sort.addEventListener('change',()=>{preferences.sort(sort.value==='recent'?'recent':'sections');paint()}, {signal:signal.signal})
  search.addEventListener('input',()=>{filters.query=search.value.slice(0,160);paint()},{signal:signal.signal})
  search.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing)search.blur()},{signal:signal.signal})
  unreadOnly.addEventListener('click',()=>{filters.unreadOnly=!filters.unreadOnly;paint()},{signal:signal.signal})
  results.querySelector<HTMLButtonElement>('[data-inbox-clear]')!.addEventListener('click',()=>{
    filters.query=search.value=''
    filters.unreadOnly=false
    paint()
    search.focus()
  },{signal:signal.signal})
  function refreshAll(manual=false){
    if(!alive())return
    if(refreshRequest)return refreshRequest
    const returnFocus=manual&&document.activeElement===recentRefresh
    refreshing=manual
    refreshRequest=Promise.allSettled([refreshSources(),refresh()]).then(()=>{
     refreshing=false
     refreshRequest=null
     paintActivity()
     if(returnFocus&&alive()&&!recent.hidden&&document.activeElement===document.body)recentRefresh.focus({preventScroll:true})
    })
    return refreshRequest
  }
  retry.addEventListener('click',()=>{search.focus();void refreshAll(true)},{signal:signal.signal})
  recentRefresh.addEventListener('click',()=>void refreshAll(true),{signal:signal.signal})
  paint()
  void refresh()
  return {
   dispose:()=>signal.abort(),
   refreshAfterConversation(){
    if(playerRequest)pendingPlayerRefresh=true
    else void refresh()
   },
   refreshAll,refreshCoach:paintActivity,updateUnread(value:ChatUnread|null){
    if(!alive())return
    summary=value
    const counts=new Map(value?.teams.map(team=>[teamInboxKey(team),team]))
    for(const entry of teamEntries){
      const activity=counts.get(entry.key)?.activityAt
      if(activity!==undefined)entry.activity=activity??undefined
    }
    teamUnread=new Map(Array.from(counts,([key,team])=>[key,team.unread]))
    generalUnread=new Map(Array.from(counts,([key,team])=>[key,team.generalUnread??team.unread]))
    teamChats=teamOptions.map((team,index)=>{
      const detail=counts.get(teamEntries[index].key)
      return (detail?.rooms??[]).map(chat=>{
        const key=teamRoomInboxKey(chat.id)
        teamUnread.set(key,chat.unread)
        return {
          key,title:chat.name,subtitle:team.teamName,
          searchText:[teamLeagueLabel(team),team.flight].join(' '),
          searchSubtitle:[team.teamName,teamLeagueLabel(team),team.flight].filter(Boolean).join(' · '),
          icon:chat.logo??team.teamLogoUrl,activity:chat.activityAt,
          open:()=>openTeam({...team,chatRoomId:chat.id}),
        }
      })
    })
    paintActivity()
  } }
}
