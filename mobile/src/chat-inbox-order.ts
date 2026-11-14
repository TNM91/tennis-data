import type { TeamChatOption,TeamScope } from './team-room-data'
import type { PlayerChatSummary } from '../../lib/player-chats-contract'
import { html } from './html'
import { bindTeamChatAvatars,teamChatAvatarHtml } from './team-chat-icon'
import { teamLeagueLabel } from '../../lib/private-team-contract'
import type { ChatUnread } from './chat-unread'
import type { CoachInboxSearch } from './coach-chats-inbox'
import websiteUi from '../generated/website-ui.json'
import { nativeActionIcon } from './native-action-icons'

type Entry = {
  key: string; title: string; subtitle: string; icon?: string; activity?: string
  unread?: boolean; pinnable?: boolean; searchText?: string; searchSubtitle?: string
  open: (trigger:HTMLButtonElement) => void
}
type Preferences = { sort: 'sections' | 'recent'; pinned: string[] }
export type ChatInboxFilters = { query: string; unreadOnly: boolean }
type CoachSearch = { snapshot: () => CoachInboxSearch; open: (id:string,trigger:HTMLButtonElement) => void }
const searchWords = (value:string) => value.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean)

export const teamInboxKey = (scope: TeamScope) => JSON.stringify(['team',scope.teamName,scope.leagueName,scope.flight])
export const playerInboxKey = (id: string) => 'chat:'+id
const teamRoomInboxKey = (id: string) => 'team-chat:'+id

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
  const remaining = entries.filter(entry=>!order.pinned.includes(entry.key))
  const recent = remaining.sort((a,b)=>(Date.parse(b.activity??'')||0)-(Date.parse(a.activity??'')||0) ||
    a.title.localeCompare(b.title))
  return {pinned,recent}
}

export function mountChatInboxOrder(
  host: HTMLElement, teamOptions: TeamChatOption[], preferences: ReturnType<typeof chatInboxOrder>,
  load: () => Promise<PlayerChatSummary[]>, openPlayer: (id:string,trigger:HTMLButtonElement) => void,
  openTeam: (scope:TeamScope) => void,
  filters: ChatInboxFilters, coach: CoachSearch, refreshSources: () => void,
) {
  const pinned = host.querySelector<HTMLElement>('[data-chats-pinned]')!
  const recent = host.querySelector<HTMLElement>('[data-chats-recent]')!
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
    searchSubtitle:['General',teamLeagueLabel(team),team.flight].filter(Boolean).join(' · '),icon:team.teamLogoUrl,activity:team.activityAt,
    open:()=>openTeam(team),
  }))
  let players: Entry[] = []
  let teamChats: Entry[][] = []
  let loadId = 0
  let playerStatus: 'loading'|'ready'|'unavailable' = 'loading'
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
    const markup=entries.map(entry=>`<li class="chat-organized-row${entry.pinnable===false?' chat-organized-row-single':''}"><button type="button" class="secondary chats-team-card" data-organized-open>
      ${nested&&!entry.icon?`<span class="chats-team-avatar chat-team-channel-icon" aria-hidden="true">${websiteUi.icons.teams}</span>`:teamChatAvatarHtml(entry.title,entry.icon)}<span class="chats-team-copy"><strong>${html(entry.title)}</strong>${nested?'':'<span>'+html(entry.subtitle)+'</span>'}</span>
      <span class="chat-unread-badge" data-organized-unread hidden></span><span aria-hidden="true">›</span></button>${entry.pinnable===false?'':pinButton(entry)}</li>`).join('')
    const unchanged=renderedLists.get(list)===markup
    if(!unchanged){list.innerHTML=markup;renderedLists.set(list,markup)}
    list.querySelectorAll<HTMLLIElement>('li').forEach((row,index)=>{
      const open = row.querySelector<HTMLButtonElement>('[data-organized-open]')!
      const entry=entries[index]
      open.dataset.focusKey=entry.key
      open.onclick=()=>entry.open(open)
      const pin=row.querySelector<HTMLButtonElement>('[data-organized-pin]')
      if(pin){pin.dataset.focusKey=entry.key;pin.onclick=()=>toggle(entry)}
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
      for(const {id,unread:count} of summary.coach.connections)if(count)unread.set('coach:'+id,count===100?'99+':String(count))
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
  function searchResults(entries:Entry[],query:string[],coachSnapshot:CoachInboxSearch){
    const coaches:Entry[]=coachSnapshot.connections.map(connection=>({
      key:'coach:'+connection.id,title:connection.name,
      subtitle:connection.role==='coach'?'Your player':connection.name==='Your coach'?'Coach chat':'Your coach',
      searchText:'coach player',pinnable:false,
      unread:summary?.coach?.available&&Boolean(summary.coach.connections.find(chat=>chat.id===connection.id)?.unread),
      open:trigger=>coach.open(connection.id,trigger),
    }))
    const matches=[...entries,...coaches].flatMap(entry=>{
      const title=searchWords([entry.title,entry.subtitle,entry.searchText].filter(Boolean).join(' ')).join(' ')
      const unreadCount=generalUnread.get(entry.key)??teamUnread.get(entry.key)
      if(!query.every(word=>title.includes(word))||filters.unreadOnly&&!entry.unread&&!unreadCount)return []
      return [{...entry,subtitle:entry.searchSubtitle??entry.subtitle}]
    })
    const ordered=orderedChatInbox(matches,preferences.read())
    return [...ordered.pinned,...ordered.recent]
  }
  function toggle(entry:Entry) {
    if (!alive()) return
    preferences.toggle(entry.key)
    paint()
    Array.from(host.querySelectorAll<HTMLButtonElement>('[data-organized-pin],[data-chat-pin-team]'))
      .find(button=>button.dataset.focusKey===entry.key&&!button.closest('[hidden],[data-team-pinned]')&&button.getClientRects().length)?.focus()
  }
  function paint(){
    if(!alive())return
    const focused=document.activeElement
    const focusedKey=focused instanceof HTMLButtonElement&&host.contains(focused)?focused.dataset.focusKey:null
    const focusedSelector=focused instanceof HTMLButtonElement&&focused.matches('[data-organized-open]')
      ?'[data-organized-open]':'[data-organized-pin],[data-chat-pin-team]'
    const words=searchWords(filters.query)
    const finding=words.length>0||filters.unreadOnly
    const order=preferences.read(), grouped=order.sort==='sections'
    const entries=[...teamEntries,...teamChats.flat(),...players]
    const {pinned:favorite,recent:available}=orderedChatInbox(entries,order)
    teamsSection.hidden=finding||!grouped
    coachSection.hidden=finding
    results.hidden=!finding
    toolbar.hidden=finding
    unreadOnly.setAttribute('aria-pressed',String(filters.unreadOnly))
    sort.value=order.sort
    section(pinned,finding?[]:favorite)
    section(recent,finding||grouped?[]:available)
    section(conversations,!finding&&grouped?players.filter(entry=>!order.pinned.includes(entry.key)):[])
    if(finding){
      const coachSnapshot=coach.snapshot()
      const matched=searchResults(entries,words,coachSnapshot)
      const loading=playerStatus==='loading'||coachSnapshot.status==='loading'
      const incomplete=playerStatus==='unavailable'||coachSnapshot.status==='unavailable'||summary===null||summary.coach?.available===false
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
      pin.onclick=()=>toggle(entry)
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
  const refresh=()=>{
   const request=++loadId
   playerStatus='loading'
   paint()
   return load().then(rooms=>{
    if(!alive()||request!==loadId)return
    playerStatus='ready'
    players=rooms.map(room=>({
      key:playerInboxKey(room.id),title:room.title,subtitle:room.group?'Group chat':'Direct message',
      icon:room.logo,unread:room.unread,activity:room.activityAt,open:button=>openPlayer(room.id,button),
    }))
    paint()
   }).catch(()=>{
    if(!alive()||request!==loadId)return
    players=[]
    playerStatus='unavailable'
    paint()
   })
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
  retry.addEventListener('click',()=>{search.focus();refreshSources();void refresh()},{signal:signal.signal})
  paint()
  void refresh()
  return { dispose:()=>signal.abort(),refresh,refreshCoach:paint,updateUnread(value:ChatUnread|null){
    if(!alive())return
    summary=value
    const counts=new Map(value?.teams.map(team=>[teamInboxKey(team),team]))
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
    paint()
  } }
}
