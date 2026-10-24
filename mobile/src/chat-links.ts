import {Browser} from '@capacitor/browser'
import {tokenizeTeamRoomMessageBody} from '../../lib/team-room-message-links'
import {html} from './match-details'
export function chatWebLink(value:string){
 if(value.length>2048||/[\\\s\u0000-\u001f\u007f]/.test(value))return null
 try{const url=new URL(value);return url.protocol==='https:'&&!!url.hostname&&!url.username&&!url.password?url.href:null}catch{return null}
}
export function chatBodyHtml(body:string){return tokenizeTeamRoomMessageBody(body).map(part=>{const url=part.href&&chatWebLink(part.href);return url?`<button type="button" class="chat-web-link" data-chat-url="${html(url)}">${html(part.text)}</button>`:html(part.text)}).join('')}
export function openChatLink(value:string,current:()=>boolean,open:typeof Browser.open=options=>Browser.open(options)){
 const url=chatWebLink(value);if(!url||!current())return {dispose:()=>{},isOpen:()=>false}
 const dialog=document.createElement('dialog');dialog.className='chat-post-dialog';dialog.setAttribute('aria-label','Open shared link');let disposed=false,busy=false
 const close=()=>{disposed=true;dialog.remove()}
 dialog.innerHTML=`<h2>Open shared link</h2><p>You’re opening a website outside the conversation.</p><p><strong>${html(new URL(url).hostname)}</strong></p><p class="chat-link-destination">${html(url)}</p><p role="status"></p><button type="button" data-open>Open website</button><button type="button" class="secondary" data-close>Cancel</button>`
 const button=dialog.querySelector<HTMLButtonElement>('[data-open]')!,notice=dialog.querySelector<HTMLElement>('[role=status]')!
 button.onclick=()=>{if(busy||disposed||!current())return;busy=true;button.disabled=true;void open({url}).then(()=>{if(!disposed&&current())close()}).catch(()=>{if(!disposed&&current())notice.textContent='Could not open this website. Check your connection and try again.'}).finally(()=>{if(!disposed&&current()){busy=false;button.disabled=false}})}
 dialog.querySelector<HTMLButtonElement>('[data-close]')!.onclick=close;dialog.oncancel=e=>{e.preventDefault();close()};document.body.append(dialog);dialog.showModal();dialog.querySelector<HTMLButtonElement>('[data-close]')!.focus();return {dispose:close,isOpen:()=>!disposed}
}
