import type {SupabaseClient} from '@supabase/supabase-js'
import {loadTeamRoom,type NativeTeamData,type NativeTeamRoom,type TeamScope} from './team-room-data'
import {html} from './match-details'
import {matchDate} from './recent-results'

function messageTime(value:string) {
 const date=new Date(value)
 return value && Number.isFinite(date.getTime())?date.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Time unavailable'
}
export function teamConversationHtml(room:NativeTeamRoom) {
 return `<p class="rating-context">Up to 75 messages from the loaded conversation window. Refresh to check for updates. Sending, replies, reactions, and attachments remain on the website for now.</p>${room.messages.length?`<ol class="team-conversation">${room.messages.map(message=>`<li class="team-bubble ${message.isMine?'team-bubble-mine':''}"><div class="team-message-meta"><strong>${html(message.senderName)}</strong><span>${html(messageTime(message.createdAt))}</span></div>${message.kind==='announcement'?'<small>Captain announcement</small>':''}${message.replyToMessageId?'<small>Reply in the team conversation</small>':''}<p>${html(message.body)}</p>${message.hasAttachment && !message.deletedAt?'<small>Attachment available on the website.</small>':''}${message.card?'<small>Match-day card · see Match day for the active court plan.</small>':''}</li>`).join('')}</ol>`:'<p>No messages in the loaded conversation yet.</p>'}`
}
export function teamMatchDayHtml(room:NativeTeamRoom) {
 const next=room.nextMatch,card=room.activeCard?.card
 return `<section><h2>Next scheduled match</h2>${next?`<dl><dt>Date</dt><dd>${html(matchDate(next.matchDate))}</dd><dt>Opponent</dt><dd>${html(next.opponent || 'Not recorded')}</dd><dt>Time</dt><dd>${html(next.matchTime || 'Not recorded')}</dd><dt>Facility</dt><dd>${html(next.facility || 'Not recorded')}</dd></dl>`:'<p>No upcoming match is recorded for this team.</p>'}</section><section><h2>Shared court plan</h2>${card?`<p>${html(matchDate(card.matchDate))} · ${html(card.opponent || 'Opponent unavailable')}</p><p class="rating-context">${html(card.state==='archived'?'Archived match card':card.state==='active'?'Active match card':'Upcoming match card')}. This is the plan shared in Team Room; check captain announcements for final changes.</p>${card.lineup.length?`<ul class="team-courts">${card.lineup.map(court=>`<li><h3>${html(court.label || 'Court')}</h3><p>${court.defaulted?'Defaulted court':court.players.length?court.players.map(html).join(' &amp; '):'Players not assigned'}</p></li>`).join('')}</ul>`:'<p>No court assignments are recorded on this card.</p>'}`:'<p>No active match card is available in the loaded conversation window.</p>'}</section>`
}
export function showTeamRoom(app:HTMLElement,client:SupabaseClient,userId:string,isCurrent:()=>boolean) {
 let disposed=false,revision=0,selected:TeamScope|undefined,tab:'Match day'|'Conversation'|'Members'='Match day',snapshot:NativeTeamData|null=null
 const valid=()=>!disposed && isCurrent()
 const load=async()=>{
  const version=++revision
  snapshot=null;app.innerHTML='<h1 tabindex="-1">My teams</h1><p role="status">Loading your linked team…</p>'
  try{
   const result=await loadTeamRoom(client,userId,valid,selected)
   if(!valid() || version!==revision)return
   snapshot=result;selected=result.room?{teamName:result.room.teamName,leagueName:result.room.leagueName,flight:result.room.flight}:undefined
   render()
  }catch{
   if(!valid() || version!==revision)return
   app.innerHTML='<h1 tabindex="-1">My teams</h1><p role="alert">Can’t open this team. Check your connection and team membership, then try again.</p><button type="button" class="secondary" id="retry-team">Retry team</button><button type="button" class="secondary" id="reset-team">Load my linked teams</button>'
   app.querySelector<HTMLButtonElement>('#retry-team')!.onclick=()=>{void load()}
   app.querySelector<HTMLButtonElement>('#reset-team')!.onclick=()=>{selected=undefined;void load()}
  }
 }
 const render=()=>{
  if(!snapshot || !valid())return
  const room=snapshot.room
  if(!room){app.innerHTML='<h1 tabindex="-1">My teams</h1><p>No accepted team connection is available. Connect your team on the website, then refresh here.</p><button type="button" class="secondary">Refresh teams</button>';app.querySelector<HTMLButtonElement>('button')!.onclick=()=>{void load()};return}
  app.innerHTML=`<small>Team Room</small><h1 tabindex="-1">${html(room.teamName)}</h1><p>${html(room.leagueName)} · ${html(room.flight || 'Flight unavailable')}</p><label>Linked team<select id="linked-team">${snapshot.teams.map((team,index)=>`<option value="${index}" ${team.teamName===room.teamName && team.leagueName===room.leagueName && team.flight===room.flight?'selected':''}>${html(team.teamName)} · ${html(team.leagueName)} · ${html(team.flight)}</option>`).join('')}</select></label><div class="match-filters" role="group" aria-label="Team views">${(['Match day','Conversation','Members'] as const).map(value=>`<button type="button" class="secondary" data-team-tab="${value}" aria-pressed="${tab===value}">${value}</button>`).join('')}</div><div id="team-panel"></div><button type="button" class="secondary" id="refresh-team">Refresh team</button><p class="rating-context">Linked-team access is checked by TenAceIQ. Notifications ${room.muted?'are muted':'follow your existing team settings'}; push notifications are not available in the app yet.</p>`
  const panel=app.querySelector<HTMLElement>('#team-panel')!
  panel.innerHTML=tab==='Match day'?teamMatchDayHtml(room):tab==='Conversation'?teamConversationHtml(room):`<section><h2>Team members</h2><p class="rating-context">Showing up to 100 connected members.</p><ul class="team-members">${room.members.map(member=>`<li><strong>${html(member.name)}</strong><span>${member.roles.includes('captain')?'Captain':member.roles.includes('co_captain')?'Co-captain':'Player'}</span></li>`).join('')}</ul></section>`
  app.querySelector<HTMLSelectElement>('#linked-team')!.onchange=event=>{const choice=snapshot?.teams[Number((event.currentTarget as HTMLSelectElement).value)];if(!choice)return;selected=choice;tab='Match day';void load()}
  app.querySelectorAll<HTMLButtonElement>('[data-team-tab]').forEach(button=>{button.onclick=()=>{tab=button.dataset.teamTab as typeof tab;render();app.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus({preventScroll:true})}})
  app.querySelector<HTMLButtonElement>('#refresh-team')!.onclick=()=>{void load()}
 }
 void load()
 return {dispose:()=>{disposed=true;revision++;snapshot=null},back:()=>false}
}
