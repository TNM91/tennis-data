import {html} from './match-details'
import type {NativeTeamData,TeamScope} from './team-room-data'
import {paintTeamUnread,type ChatUnread} from './chat-unread'
import websiteUi from '../generated/website-ui.json'

export type ChatsInboxFilter={query:string;unreadOnly:boolean;filtersOpen:boolean}
const sameTeam=(a:TeamScope,b:TeamScope)=>a.teamName===b.teamName&&a.leagueName===b.leagueName&&a.flight===b.flight
const findText=(text:string)=>text.normalize('NFKC').toLocaleLowerCase().trim()
const unreadLabel=(count:number)=>(count===100?'99+':String(count))+' unread messages'
const inboxShortcuts=[
 {target:'chats-team-inbox',label:'Team chats',description:'Team rooms',icon:websiteUi.icons.teams},
 {target:'chats-coach-inbox',label:'Coach & player',description:'Private chats',icon:websiteUi.icons.coach},
] as const
const chatStartActions={
 team:{title:'Use a team invite',detail:'Use the link from your captain.',icon:websiteUi.icons.teams},
 coach:{title:'Accept coach invitation',detail:'Start a private chat with your coach.',icon:websiteUi.icons.coach},
} as const

export function chatsFilterFeedbackHtml(kind:'team'|'coach'){
 const status=kind==='team'?'data-chats-status':'data-coach-chat-status'
 return `<div class="chats-filter-feedback">
  <p class="chats-inbox-status" role="status" ${status}></p>
  <button type="button" class="secondary" data-clear-chat-filters hidden>Clear filters</button>
 </div>`
}

export function chatsFilterStatus(kind:'team'|'coach',query:string,unreadOnly:boolean,matched:number,visible:number,unknown:boolean){
 if(!query&&!unreadOnly)return ''
 const noun=kind==='team'?'team':'conversation'
 if(!matched)return `No ${noun}s match your search.`
 if(!visible){
  if(unknown)return kind==='team'?'Unread counts unavailable. Refresh teams to try again.':'Unread counts unavailable for some conversations. Refresh to try again.'
  return query?`No unread messages in matching ${noun}s.`:'You’re all caught up.'
 }
 const count=`${visible} ${noun}${visible===1?'':'s'}`
 return unreadOnly?count+' with unread messages'+(unknown?' · Some unread counts are unavailable.':''):count+' found'
}

export function chatsStartActionHtml(kind:keyof typeof chatStartActions){
 const action=chatStartActions[kind],id='chats-'+kind+'-start'
 return `<div class="native-entry-list chats-start-action">
  <button type="button" class="secondary app-tool${kind==='team'?' native-entry-featured':''}" ${kind==='team'?'id="join-team"':'data-chats-coach-invite'}
   aria-labelledby="${id}-title" aria-describedby="${id}-detail">
   <span class="app-tool-icon" aria-hidden="true">${action.icon}</span>
   <span class="app-tool-copy"><strong id="${id}-title">${action.title}</strong><span id="${id}-detail">${action.detail}</span></span>
   <span aria-hidden="true">›</span>
  </button>
 </div>`
}

export function chatsInboxHtml(data:NativeTeamData){
 return `<header class="chats-intro"><h1 tabindex="-1">Chats</h1></header>
 <div class="chats-inbox-shortcuts" role="group" aria-label="Chat inbox shortcuts">${inboxShortcuts.map(({target,label,description,icon})=>`
  <button type="button" class="secondary chats-inbox-shortcut" aria-controls="${target}" data-chats-jump="${target}">
   <span class="chats-shortcut-icon" aria-hidden="true">${icon}</span>
   <span class="chats-shortcut-copy"><strong>${html(label)}</strong><small data-chats-jump-status>${description}</small></span>
  </button>`).join('')}</div>
 <section id="chats-team-inbox" aria-labelledby="chats-teams-title"><div class="chats-section-heading"><h2 id="chats-teams-title" tabindex="-1">Your teams</h2>${data.teams.length?'<button type="button" class="secondary" id="join-team">Join team</button>':''}</div>
 <details class="chats-filter-drawer" data-team-chat-filters ${data.teams.length?'':'hidden'}>
  <summary>Search &amp; filter teams<span class="chats-filter-active" data-team-filter-active hidden>Active</span></summary>
  <div class="chats-inbox-tools">
   <label for="chats-team-search">Find a team<input id="chats-team-search" type="search" maxlength="160" placeholder="Team or league" autocomplete="off"></label>
   <div class="chats-inbox-filters" role="group" aria-label="Show teams"><button type="button" class="secondary" data-chats-filter="all" aria-pressed="true">All</button><button type="button" class="secondary" data-chats-filter="unread" aria-pressed="false">Unread</button></div>
  </div>
 </details>
 ${chatsFilterFeedbackHtml('team')}
 ${data.teams.length?`<ul class="chats-team-list">${data.teams.map((team,index)=>`<li data-chat-team-row="${index}"><button type="button" class="secondary chats-team-card" data-open-team-chat="${index}"><span class="chats-team-avatar" aria-hidden="true">${html(team.teamName.trim().slice(0,1).toUpperCase())}</span><span class="chats-team-copy"><strong>${html(team.teamName)}</strong><span>${html(team.leagueName)}${team.flight?' · '+html(team.flight):''}</span><span class="chats-room-name">Team rooms</span></span><span class="chat-unread-badge chat-team-unread" data-team-unread aria-hidden="true" hidden></span><span aria-hidden="true">›</span></button><ul class="chats-unread-rooms" data-unread-rooms aria-label="${html('Unread rooms in '+team.teamName)}" hidden></ul></li>`).join('')}</ul>`:chatsStartActionHtml('team')}
 <button type="button" class="secondary" id="refresh-team">Refresh teams</button></section><div id="chats-coach-inbox" data-coach-chats></div><section class="chat-notification-settings" data-chat-notifications aria-label="Chat notifications"></section>`
}

/** Filters and room jumps use the current authorized count snapshot; opening still reloads room access. */
export function bindChatsInbox(host:HTMLElement,teams:TeamScope[],filter:ChatsInboxFilter,initial:ChatUnread|null,onOpen:(scope:TeamScope)=>void,current:()=>boolean){
 let summary=initial,disposed=false
 const events=new AbortController(),search=host.querySelector<HTMLInputElement>('#chats-team-search')!
 const filters=host.querySelector<HTMLDetailsElement>('[data-team-chat-filters]')!
 const filtersSummary=filters.querySelector<HTMLElement>('summary')!
 const filtersActive=filters.querySelector<HTMLElement>('[data-team-filter-active]')!
 const clear=host.querySelector<HTMLButtonElement>('#chats-team-inbox [data-clear-chat-filters]')!
 const status=host.querySelector<HTMLElement>('[data-chats-status]')!
 filters.open=filter.filtersOpen
 filters.addEventListener('toggle',()=>{if(filters.isConnected)filter.filtersOpen=filters.open},{signal:events.signal})
 search.value=filter.query
 const active=()=>!disposed&&current()&&host.isConnected
 const counts=(team:TeamScope)=>summary?.teams.find(item=>sameTeam(item,team))
 const open=(team:TeamScope,roomId?:string)=>{if(active())onOpen({teamName:team.teamName,leagueName:team.leagueName,flight:team.flight,...(roomId?{chatRoomId:roomId}:{})})}
 const shortcuts=inboxShortcuts.map(({target,description})=>{
  const button=host.querySelector<HTMLButtonElement>('[data-chats-jump="'+target+'"]')!
  const status=button.querySelector<HTMLElement>('[data-chats-jump-status]')!
  button.addEventListener('click',()=>{
   if(!active())return
   const heading=host.querySelector<HTMLElement>('#'+target+' h2')
   heading?.focus({preventScroll:true})
   heading?.scrollIntoView({block:'start'})
  },{signal:events.signal})
  return {target,description,status}
 })
 const paint=()=>{
  if(!active())return
  paintTeamUnread(host,summary,teams)
  const unreadCounts={
   'chats-team-inbox':summary?.total,
   'chats-coach-inbox':summary?.coach?.available?summary.coach.total:undefined,
  }
  for(const {target,description,status} of shortcuts){
   const count=unreadCounts[target]
   const noTeams=target==='chats-team-inbox'&&!teams.length
   const label=noTeams?'No teams yet':count===undefined?description:count?(count===100?'99+':count)+' unread':'Caught up'
   if(status.textContent!==label)status.textContent=label
   status.toggleAttribute('data-has-unread',!noTeams&&Boolean(count))
  }
  const query=findText(filter.query);let matched=0,visible=0,unknown=false
  filtersActive.hidden=clear.hidden=!teams.length||(!query&&!filter.unreadOnly)
  for(const button of host.querySelectorAll<HTMLButtonElement>('[data-chats-filter]'))button.setAttribute('aria-pressed',String((button.dataset.chatsFilter==='unread')===filter.unreadOnly))
  for(const row of host.querySelectorAll<HTMLElement>('[data-chat-team-row]')){
   const team=teams[Number(row.dataset.chatTeamRow)],teamCounts=counts(team),card=row.querySelector<HTMLButtonElement>('[data-open-team-chat]')!,rooms=row.querySelector<HTMLUListElement>('[data-unread-rooms]')!
   const matches=findText([team.teamName,team.leagueName,team.flight].join(' ')).includes(query)
   if(matches){matched++;unknown||=!teamCounts}
   const shown=matches&&(!filter.unreadOnly||Boolean(teamCounts?.unread))
   const wasFocused=row.contains(document.activeElement);row.hidden=!shown;if(shown)visible++
   const destinations=[...(teamCounts?.generalUnread?[{id:'',name:'General',unread:teamCounts.generalUnread}]:[]),...(teamCounts?.rooms||[]).filter(room=>room.unread>0)]
   const remaining=new Set(destinations.map(room=>room.id));let removedFocus=false
   for(const button of rooms.querySelectorAll<HTMLButtonElement>('[data-inbox-room]'))if(!remaining.has(button.dataset.inboxRoom!)){removedFocus||=button===document.activeElement;button.closest('li')!.remove()}
   for(const room of destinations){
    let button=Array.from(rooms.querySelectorAll<HTMLButtonElement>('[data-inbox-room]')).find(item=>item.dataset.inboxRoom===room.id)
    if(!button){const item=document.createElement('li');button=document.createElement('button');button.type='button';button.className='secondary chats-unread-room';button.dataset.inboxRoom=room.id;button.innerHTML='<span data-room-label></span><span class="chat-unread-badge" data-room-count aria-hidden="true"></span>';item.append(button);rooms.append(item)
     button.addEventListener('click',()=>{const latest=counts(team);if(room.id?latest?.rooms?.some(value=>value.id===room.id&&value.unread>0):latest?.generalUnread)open(team,room.id||undefined)},{signal:events.signal})
    }
    button.querySelector('[data-room-label]')!.textContent=room.name;button.querySelector('[data-room-count]')!.textContent=room.unread===100?'99+':String(room.unread)
    button.setAttribute('aria-label',room.name+', '+unreadLabel(room.unread)+', '+[team.teamName,team.leagueName,team.flight].filter(Boolean).join(' · '))
   }
   rooms.hidden=!destinations.length
   if(wasFocused&&!shown){
    const target=filters.open?filters.querySelector<HTMLButtonElement>('[data-chats-filter="'+(filter.unreadOnly?'unread':'all')+'"]'):filtersSummary
    target?.focus({preventScroll:true})
   }
   else if(removedFocus)card.focus({preventScroll:true})
  }
  const message=teams.length?chatsFilterStatus('team',query,filter.unreadOnly,matched,visible,unknown):''
  if(status.textContent!==message)status.textContent=message
 }
 clear.addEventListener('click',()=>{
  if(!active())return
  filter.query=search.value=''
  filter.unreadOnly=false
  paint()
  const target=filters.open?filters.querySelector<HTMLButtonElement>('[data-chats-filter="all"]'):filtersSummary
  target?.focus()
 },{signal:events.signal})
 search.addEventListener('input',()=>{filter.query=search.value.slice(0,160);paint()},{signal:events.signal})
 host.querySelectorAll<HTMLButtonElement>('[data-chats-filter]').forEach(button=>button.addEventListener('click',()=>{filter.unreadOnly=button.dataset.chatsFilter==='unread';paint()},{signal:events.signal}))
 host.querySelectorAll<HTMLButtonElement>('[data-open-team-chat]').forEach(button=>button.addEventListener('click',()=>{const team=teams[Number(button.dataset.openTeamChat)];if(team)open(team)},{signal:events.signal}))
 paint()
 return {update(value:ChatUnread|null){summary=value;paint()},dispose(){disposed=true;summary=null;events.abort()}}
}
