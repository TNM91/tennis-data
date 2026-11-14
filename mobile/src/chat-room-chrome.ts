import type {NativeTeamRoom,TeamScope} from './team-room-data'
import {teamLeagueLabel} from '../../lib/private-team-contract'
import {nativeActionIcon as icon} from './native-action-icons'
import {html} from './match-details'
import {firstPartyBuild} from './build-scope'
import {teamChatAvatarHtml} from './team-chat-icon'

export function namedTeamPlanHtml(room:NativeTeamRoom,locked:boolean){
 if(!firstPartyBuild||!room.chatRoom||!room.chatReady)return ''
 const disabled=locked?'disabled':''
 const match=room.scheduleLinked||room.manualFixture
 if(!room.teamPractices&&!match)return ''
 return `<div class="named-team-plan" role="group" aria-label="Team plan">
  ${room.teamPractices?`<button type="button" class="secondary" data-team-plan="practice" aria-haspopup="dialog" ${disabled}>Practice sign-ups</button>`:''}
  ${match?`<button type="button" class="secondary" data-team-plan="match" aria-haspopup="dialog" ${disabled}>Next match</button>`:''}
 </div>`
}
export function chatRoomHeaderHtml(room:NativeTeamRoom,teams:TeamScope[],tab:string,locked:boolean,switchLocked=locked,backLabel='All team chats'){
 const disabled=locked?'disabled':''
 const practiceTool=firstPartyBuild&&room.teamPractices?teamMenuButton('chat-practices','Practices',room.canPlanPractice?'Schedule practice and track sign-ups':'See practices and RSVP','plane'):''
 const identity=teamToolsIdentity(room)
 const chatName=html(room.chatRoom?.name||'General')
 const headerIcon=room.chatLogoUrl??room.teamLogoUrl
 const switchChat=`<button type="button" class="secondary" id="open-team-rooms" aria-haspopup="dialog" aria-label="${firstPartyBuild?'Team chats':'Rooms'} · ${chatName}" ${disabled}><span>${chatName}</span>${icon('down')}</button>`
 const views=[...(tab==='Conversation'?[]:[['Conversation','Back to chat','Return to your messages','back']]),...(firstPartyBuild||room.chatRoom?[]:[['Match day','Match day','Availability and the court plan','plane']]),['Members',firstPartyBuild?(room.chatDisplayName===undefined?'Chat safety':'Chat settings'):'Members & alerts',firstPartyBuild?(room.chatDisplayName===undefined?'Manage blocked posts':'Your chat name and blocked posts'):'Teammates and notifications','members'],...(!room.chatRoom&&room.canManage?[['Captain','Captain tools','Lineups, scouting and team plans','profile']]:[])]
 return `<header class="chat-room-header"><button type="button" class="secondary chat-icon-button" id="all-team-chats" aria-label="${html(backLabel)}" title="${html(backLabel)}" ${disabled}>${icon('back')}</button><div class="chat-room-heading"><div class="chat-room-identity">${headerIcon?teamChatAvatarHtml(room.chatRoom?.name||room.teamName,headerIcon):''}<h1 tabindex="-1">${html(room.teamName)}</h1></div><div class="chat-room-heading-actions">${switchChat}${firstPartyBuild?`<button type="button" class="secondary chat-icon-button chat-compact-refresh" id="refresh-team" ${disabled} aria-label="Refresh messages" title="Refresh messages"><span aria-hidden="true">↻</span></button>`:''}</div></div>${tab==='Conversation'?`<button type="button" class="secondary chat-icon-button" id="chat-history-search" aria-label="Find in conversation" aria-controls="chat-quick-find-panel" aria-expanded="false">${icon('search')}</button>`:'<span></span>'}<details class="chat-room-options"><summary aria-label="Team tools">${icon('members')}<span>Team</span></summary><div class="chat-room-options-panel"><div class="chat-room-panel-heading"><h2>Team</h2><button type="button" class="secondary" data-close-team-tools aria-label="Close team tools">Close</button></div>${identity}<div class="chat-room-links" role="group" aria-label="Team tools">${practiceTool}${firstPartyBuild&&(room.scheduleLinked||room.manualFixture)?`<button type="button" class="secondary" id="chat-next-match">${icon('plane')}<span><strong>Next match</strong><small>${room.canScheduleMatch?'Add or edit your team’s next match':'See who and where you play next'}</small></span>${icon('down')}</button>`:''}${firstPartyBuild&&room.manualFixture?`<button type="button" class="secondary" id="chat-team-results">${icon('members')}<span><strong>Team results</strong><small>${room.canScheduleMatch?'Post or review your team’s court tally':'See your team’s posted scores'}</small></span>${icon('down')}</button>`:''}${firstPartyBuild&&room.canInviteTeammates?`<button type="button" class="secondary" id="chat-invite-teammates">${icon('members')}<span><strong>Invite teammates</strong><small>Create or share a team invite link</small></span>${icon('down')}</button>`:''}${!firstPartyBuild&&tab==='Conversation'?`<button type="button" class="secondary" id="chat-team-plans">${icon('plane')}<span><strong>Team plans</strong><small>Shared matches, polls and practices</small></span>${icon('down')}</button>`:''}${views.filter(([value])=>value!==tab).map(([value,label,detail,glyph])=>`<button type="button" class="secondary" data-team-tab="${value}" aria-pressed="false">${icon(glyph as Parameters<typeof icon>[0])}<span><strong>${label}</strong><small>${detail}</small></span>${icon('down')}</button>`).join('')}</div><div class="chat-room-announcement"></div><details class="chat-room-extra"><summary>More team tools</summary><div class="chat-room-tools"></div><label for="linked-team">Switch team<select id="linked-team" ${switchLocked?'disabled':''}>${teams.map((team,index)=>`<option value="${index}" ${team.teamName===room.teamName&&team.leagueName===room.leagueName&&team.flight===room.flight?'selected':''}>${html(team.teamName)} · ${html(teamLeagueLabel(team))} · ${html(team.flight)}</option>`).join('')}</select></label><button type="button" class="secondary" id="join-team">Join another team</button>${firstPartyBuild?'':`<button type="button" class="secondary" id="refresh-team" ${tab==='Captain'?'hidden':''} ${disabled}>Refresh conversation</button>`}${firstPartyBuild?'':`<p class="rating-context">${room.chatRoom?.teamMuted?'Team alerts muted · room alerts paused':room.muted?'Alerts muted':'Alerts on'}</p>`}<p id="chat-live-status" role="status" class="rating-context"></p></details></div></details></header>`
}

function teamToolsIdentity(room:NativeTeamRoom){
 const league=teamLeagueLabel(room)
 if(!firstPartyBuild)return `<p class="chat-room-scope">${html(room.teamName)} · ${html(league)} · ${html(room.flight||'Flight unavailable')}</p>`
 const context=[league,room.flight].filter(Boolean).join(' · ')
 return `<div class="chat-team-settings">
  ${teamChatAvatarHtml(room.teamName,room.teamLogoUrl)}
  <div class="chat-team-settings-name"><strong>${html(room.teamName)}</strong>${context?`<small>${html(context)}</small>`:''}</div>
  ${room.canManageTeamLogo&&!room.chatRoom?`<button type="button" class="secondary" id="chat-team-icon" aria-haspopup="dialog">${room.teamLogoUrl?'Edit icon':'Add icon'}</button>`:''}
  ${room.canManageTeamLogo&&room.chatRoom?`<button type="button" class="secondary" id="chat-team-icon" aria-haspopup="dialog">${room.chatLogoUrl?'Edit chat icon':'Add chat icon'}</button>`:''}
 </div>`
}

function teamMenuButton(id:string,label:string,detail:string,glyph:Parameters<typeof icon>[0]){
 return `<button type="button" class="secondary" id="${id}" aria-haspopup="dialog">${icon(glyph)}<span><strong>${html(label)}</strong><small>${html(detail)}</small></span>${icon('down')}</button>`
}

export function firstPartyChatSettingsHtml(displayName: string | undefined) {
 return `<section>
  <h2>${displayName === undefined ? 'Chat safety' : 'Chat settings'}</h2>
  ${displayName === undefined ? '' : `<form id="team-chat-display-name">
    <label for="chat-display-name">Your chat name</label>
    <p id="chat-display-name-hint">Visible to teammates in this chat. Leave blank to use your alias.</p>
    <input id="chat-display-name" value="${html(displayName)}" aria-describedby="chat-display-name-hint" autocomplete="off" autocapitalize="words">
    <button type="submit" class="secondary">Save chat name</button>
    <p role="status"></p>
  </form>`}
  <p>Use a message’s menu to report a concern or block the sender’s posts.</p>
 </section>`
}

export function bindTeamToolsClose(app:HTMLElement){
 const menu=app.querySelector<HTMLDetailsElement>('.chat-room-options')
 app.querySelector<HTMLButtonElement>('[data-close-team-tools]')!.onclick=()=>{if(menu){menu.open=false;menu.querySelector<HTMLElement>('summary')?.focus({preventScroll:true})}}
}
