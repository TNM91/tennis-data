import {nativeActionIcon as icon} from './native-action-icons'
import {pollFields} from '../../lib/team-poll-contract'
import {chatPlanLink,type ChatPlan} from '../../lib/team-chat-plan-links'
export {chatPlanLink} from '../../lib/team-chat-plan-links'
import {Browser} from './native-browser'
import {tokenizeTeamRoomMessageBody} from '../../lib/team-room-message-links'
import {html} from './match-details'
export function chatWebLink(value:string){
 if(value.length>2048||/[\\\s\u0000-\u001f\u007f]/.test(value))return null
 try{const url=new URL(value);return url.protocol==='https:'&&!!url.hostname&&!url.username&&!url.password?url.href:null}catch{return null}
}
type PlanContent={title?:string;detail?:string;meta?:string;label?:string;cancelled?:boolean}
export function chatPlanCardHtml(plan:ChatPlan,content:PlanContent={}){
 const poll=plan.kind==='poll'
 return `<button type="button" class="chat-plan-card${content.cancelled?' chat-plan-cancelled':''}" data-chat-${plan.kind}="${html(plan.id)}"><span class="chat-plan-kicker">${icon(poll?'members':'plane')}<span>${html(content.label||(poll?'Team poll':'Team practice'))}</span></span><strong>${html(content.title||(poll?'Have your say':'Get the team on court'))}</strong>${content.detail?`<span class="chat-plan-detail">${html(content.detail)}</span>`:''}${content.meta?`<span class="chat-plan-meta">${html(content.meta)}</span>`:''}<span class="chat-plan-open">${content.cancelled?'View cancellation':poll?'Vote · view results':'View practice · RSVP'}<span aria-hidden="true">→</span></span></button>`
}
/** Condense only canonical shared announcements. Never infer live votes, places or RSVP status. */
export function sharedChatPlanHtml(body:string){
 const lines=body.replace(/\r\n/g,'\n').split('\n'),plan=chatPlanLink(lines.at(-1)||'')
 if(!plan)return null
 if(plan.kind==='poll'&&lines[0].startsWith('Poll: ')&&lines.length>=4&&lines.length<=8){
  const question=lines[0].slice(6),rows=lines.slice(1,-1),choices=rows.map((line,index)=>line.startsWith(`${index+1}. `)?line.slice(String(index+1).length+2):'')
  if(pollFields(question,choices))return chatPlanCardHtml(plan,{title:question,detail:choices.slice(0,2).join(' · ')+(choices.length>2?` · +${choices.length-2} more`:''),meta:`${choices.length} choices`})
 }
 if(plan.kind==='practice'&&['Team practice invitation','Practice update','Practice cancelled'].includes(lines[0])&&lines.length>=7&&lines[1].length>0&&lines[1].length<=160&&/^Date: \d{4}-\d{2}-\d{2}$/.test(lines[3])&&lines[4].startsWith('Time: ')&&lines[5].startsWith('Location: ')){
  const caption=[lines[2],...lines.slice(6,-1)].join('\n')
  return `<span class="chat-shared-plan">${chatPlanCardHtml(plan,{title:lines[1],label:lines[0],detail:lines[3].slice(6)+' · '+lines[4].slice(6),meta:lines[5].slice(10),cancelled:lines[0]==='Practice cancelled'})}<span class="chat-plan-caption">${html(caption)}</span></span>`
 }
 return null
}
export function chatBodyHtml(body:string,plans=false){
 const shared=plans?sharedChatPlanHtml(body):null;if(shared)return shared
 return tokenizeTeamRoomMessageBody(body).map(part=>{const url=part.href&&chatWebLink(part.href),plan=url&&plans?chatPlanLink(url):null;return plan?chatPlanCardHtml(plan):url?`<button type="button" class="chat-web-link" data-chat-url="${html(url)}">${html(part.text)}</button>`:html(part.text)}).join('')
}

export function openChatLink(value:string,current:()=>boolean,open:typeof Browser.open=options=>Browser.open(options)){
 const url=chatWebLink(value);if(!url||!current())return {dispose:()=>{},isOpen:()=>false}
 const dialog=document.createElement('dialog');dialog.className='chat-post-dialog';dialog.setAttribute('aria-label','Open shared link');let disposed=false,busy=false
 const close=()=>{disposed=true;dialog.remove()}
 dialog.innerHTML=`<h2>Open shared link</h2><p>You’re opening a website outside the conversation.</p><p><strong>${html(new URL(url).hostname)}</strong></p><p class="chat-link-destination">${html(url)}</p><p role="status"></p><button type="button" data-open>Open website</button><button type="button" class="secondary" data-close>Cancel</button>`
 const button=dialog.querySelector<HTMLButtonElement>('[data-open]')!,notice=dialog.querySelector<HTMLElement>('[role=status]')!
 button.onclick=()=>{if(busy||disposed||!current())return;busy=true;button.disabled=true;void open({url}).then(()=>{if(!disposed&&current())close()}).catch(()=>{if(!disposed&&current())notice.textContent='Could not open this website. Check your connection and try again.'}).finally(()=>{if(!disposed&&current()){busy=false;button.disabled=false}})}
 dialog.querySelector<HTMLButtonElement>('[data-close]')!.onclick=close;dialog.oncancel=e=>{e.preventDefault();close()};document.body.append(dialog);dialog.showModal();dialog.querySelector<HTMLButtonElement>('[data-close]')!.focus();return {dispose:close,isOpen:()=>!disposed}
}
