import type {NativeTeamRoom} from './team-room-data'
import {nativeActionIcon as icon} from './native-action-icons'
/** Official match and captain actions stay in General; practice replies use the same exact team. */
export function chatTeamActionsHtml(room:NativeTeamRoom,locked:boolean){
 const disabled=locked?'disabled':''
 return `<div class="chat-team-actions"><p>Team plans</p><button type="button" class="secondary" data-chat-create-poll aria-label="Create a poll" ${disabled}>${icon('plus')}<span>Create a poll</span></button><button type="button" class="secondary" data-chat-practices aria-label="Practice RSVPs" ${disabled}>${icon('members')}<span>Practice RSVPs</span></button>${room.chatRoom?'':`<button type="button" class="secondary" data-chat-availability aria-label="Match availability" ${disabled}>${icon('plane')}<span>Match availability</span></button>${room.canManage?`<button type="button" class="secondary" data-chat-plan-practice aria-label="Plan a practice" ${disabled}>${icon('plus')}<span>Plan a practice</span></button>`:''}`}</div>`
}
