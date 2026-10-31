import {html} from './match-details'
import type {NativeTeamData,TeamScope} from './team-room-data'
import {paintTeamUnread,type ChatUnread} from './chat-unread'

export type ChatsInboxFilter={query:string;unreadOnly:boolean}
const sameTeam=(a:TeamScope,b:TeamScope)=>a.teamName===b.teamName&&a.leagueName===b.leagueName&&a.flight===b.flight
const findText=(text:string)=>text.normalize('NFKC').toLocaleLowerCase().trim()
const unreadLabel=(count:number)=>(count===100?'99+':String(count))+' unread messages'

export function chatsInboxHtml(data:NativeTeamData){
 return `<header class="chats-intro"><small class="stat-eyebrow">Your tennis circle</small><h1 tabindex="-1">Chats</h1><p>Team talk, coach conversations and match plans.</p></header>
 <section aria-labelledby="chats-teams-title"><div class="chats-section-heading"><h2 id="chats-teams-title">Your teams</h2><button type="button" class="secondary" id="join-team">Join team</button></div>
 <div class="chats-inbox-tools" ${data.teams.length?'':'hidden'}><label for="chats-team-search">Find a team<input id="chats-team-search" type="search" maxlength="160" placeholder="Team or league" autocomplete="off"></label><div class="chats-inbox-filters" role="group" aria-label="Show teams"><button type="button" class="secondary" data-chats-filter="all" aria-pressed="true">All</button><button type="button" class="secondary" data-chats-filter="unread" aria-pressed="false">Unread</button></div></div>
 <p class="chats-inbox-status" role="status" data-chats-status></p>
 ${data.teams.length?`<ul class="chats-team-list">${data.teams.map((team,index)=>`<li data-chat-team-row="${index}"><button type="button" class="secondary chats-team-card" data-open-team-chat="${index}"><span class="chats-team-avatar" aria-hidden="true">${html(team.teamName.trim().slice(0,1).toUpperCase())}</span><span class="chats-team-copy"><strong>${html(team.teamName)}</strong><span>${html(team.leagueName)}${team.flight?' · '+html(team.flight):''}</span><span class="chats-room-name">Team rooms</span></span><span class="chat-unread-badge chat-team-unread" data-team-unread aria-hidden="true" hidden></span><span aria-hidden="true">›</span></button><ul class="chats-unread-rooms" data-unread-rooms aria-label="${html('Unread rooms in '+team.teamName)}" hidden></ul></li>`).join('')}</ul>`:'<p>Join your team with an invite from your captain.</p>'}
 <button type="button" class="secondary" id="refresh-team">Refresh teams</button></section><div data-coach-chats></div><section class="chat-notification-settings" data-chat-notifications aria-label="Chat notifications"></section>`
}

/** Filters and room jumps use the current authorized count snapshot; opening still reloads room access. */
export function bindChatsInbox(host:HTMLElement,teams:TeamScope[],filter:ChatsInboxFilter,initial:ChatUnread|null,onOpen:(scope:TeamScope)=>void,current:()=>boolean){
 let summary=initial,disposed=false
 const events=new AbortController(),search=host.querySelector<HTMLInputElement>('#chats-team-search')!
 search.value=filter.query
 const active=()=>!disposed&&current()&&host.isConnected
 const counts=(team:TeamScope)=>summary?.teams.find(item=>sameTeam(item,team))
 const open=(team:TeamScope,roomId?:string)=>{if(active())onOpen({teamName:team.teamName,leagueName:team.leagueName,flight:team.flight,...(roomId?{chatRoomId:roomId}:{})})}
 const paint=()=>{
  if(!active())return
  paintTeamUnread(host,summary,teams)
  const query=findText(filter.query);let visible=0,unknown=0
  for(const button of host.querySelectorAll<HTMLButtonElement>('[data-chats-filter]'))button.setAttribute('aria-pressed',String((button.dataset.chatsFilter==='unread')===filter.unreadOnly))
  for(const row of host.querySelectorAll<HTMLElement>('[data-chat-team-row]')){
   const team=teams[Number(row.dataset.chatTeamRow)],teamCounts=counts(team),card=row.querySelector<HTMLButtonElement>('[data-open-team-chat]')!,rooms=row.querySelector<HTMLUListElement>('[data-unread-rooms]')!
   if(!teamCounts)unknown++
   const shown=findText([team.teamName,team.leagueName,team.flight].join(' ')).includes(query)&&(!filter.unreadOnly||Boolean(teamCounts?.unread))
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
   if(wasFocused&&!shown)host.querySelector<HTMLButtonElement>('[data-chats-filter="'+(filter.unreadOnly?'unread':'all')+'"]')?.focus({preventScroll:true})
   else if(removedFocus)card.focus({preventScroll:true})
  }
  const status=host.querySelector<HTMLElement>('[data-chats-status]')!
  status.textContent=!teams.length?'':!visible?(filter.unreadOnly&&unknown?'Unread counts unavailable. Refresh teams to try again.':query?'No teams match your search.':filter.unreadOnly?'You’re all caught up.':'No teams to show.'):`${visible} ${visible===1?'team':'teams'}${filter.unreadOnly?' with unread messages':''}${filter.unreadOnly&&unknown?' · Some unread counts are unavailable.':''}`
 }
 search.addEventListener('input',()=>{filter.query=search.value.slice(0,160);paint()},{signal:events.signal})
 host.querySelectorAll<HTMLButtonElement>('[data-chats-filter]').forEach(button=>button.addEventListener('click',()=>{filter.unreadOnly=button.dataset.chatsFilter==='unread';paint()},{signal:events.signal}))
 host.querySelectorAll<HTMLButtonElement>('[data-open-team-chat]').forEach(button=>button.addEventListener('click',()=>{const team=teams[Number(button.dataset.openTeamChat)];if(team)open(team)},{signal:events.signal}))
 paint()
 return {update(value:ChatUnread|null){summary=value;paint()},dispose(){disposed=true;summary=null;events.abort()}}
}
