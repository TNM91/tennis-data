import type {NativeTeamRoom} from './team-room-data'
import {nativeActionIcon as icon} from './native-action-icons'
import {chatTeamActionsHtml} from './chat-team-actions'
export function chatAttachmentMenuHtml(room:NativeTeamRoom,locked:boolean,hasPhoto:boolean){
 const disabled=locked?'disabled':''
 return `<details class="chat-attachment-picker"><summary aria-label="Add to message" aria-disabled="${locked}">${icon('plus')}</summary><div class="chat-attachment-menu"><div class="chat-attachment-heading"><h2>Add to chat</h2><button type="button" class="secondary" data-close-attachments aria-label="Close attachments">Close</button></div><div class="chat-media-actions" role="group" aria-label="Photos and GIFs"><button type="button" class="secondary" data-photo-source="library" aria-label="Choose photo" ${disabled}>${icon('photo')}<span><strong>Photos</strong><small>From your library</small></span></button><button type="button" class="secondary" data-photo-source="camera" aria-label="Take photo" ${disabled}>${icon('camera')}<span><strong>Camera</strong><small>Take a photo</small></span></button><button type="button" class="secondary" id="chat-choose-gif" aria-label="GIFs" ${disabled}>${icon('react')}<span><strong>GIFs</strong><small>Tennis & reactions</small></span></button><button type="button" class="secondary" id="chat-tag-person" aria-label="Tag teammate" ${locked||hasPhoto?'disabled':''}>${icon('mention')}<span><strong>Mention</strong><small>Tag a teammate</small></span></button></div>${chatTeamActionsHtml(room,locked)}</div></details>`
}
export function bindChatAttachmentClose(app:HTMLElement){
 const menu=app.querySelector<HTMLDetailsElement>('.chat-attachment-picker'),trigger=menu?.querySelector<HTMLElement>('summary')
 if(!menu||!trigger)return
 trigger.addEventListener('click',event=>{if(trigger.getAttribute('aria-disabled')==='true')event.preventDefault();else if(!menu.open)app.querySelector<HTMLTextAreaElement>('#chat-draft')?.blur()})
 menu.querySelector<HTMLButtonElement>('[data-close-attachments]')!.onclick=()=>{menu.open=false;trigger.focus({preventScroll:true})}
}
