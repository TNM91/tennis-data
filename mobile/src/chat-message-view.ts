import {CapacitorHttp} from '@capacitor/core'
import {Clipboard} from '@capacitor/clipboard'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {TeamScope} from './team-room-data'
import {chatMessageId,type ChatMessageView} from '../../lib/team-chat-message-contract'
import {chatBodyHtml,openChatLink} from './chat-links'
import {html} from './match-details'
export type ViewedChatMessage={id:string;senderName:string;body:string;kind:string;createdAt:string;editedAt:string;hasAttachment:boolean;truncated:boolean}
export async function readChatMessage(client:SupabaseClient,owner:string,current:()=>boolean,scope:TeamScope,roomId:string,requestedId:string,view:ChatMessageView,send:typeof CapacitorHttp.get=options=>CapacitorHttp.get(options)){
 if(!chatMessageId(requestedId))throw Error('Message unavailable.')
 const session=await client.auth.getSession();if(session.error||session.data.session?.user.id!==owner||!current())throw Error('Sign in again to view this message.')
 const url=new URL('https://www.tenaceiq.com/api/team-rooms/message');for(const [key,value] of Object.entries({team:scope.teamName,league:scope.leagueName,flight:scope.flight,message:requestedId,view}))url.searchParams.set(key,value)
 const response=await send({url:url.href,headers:{Authorization:'Bearer '+session.data.session.access_token},disableRedirects:true,responseType:'json',connectTimeout:12000,readTimeout:12000});if(!current())throw Error('This team is no longer open.')
 const root=response.data,message=root?.message
 if(response.status!==200||root?.ok!==true||root.messageView!==1||root.roomId!==roomId||root.requestedId!==requestedId||root.view!==view||!message||!chatMessageId(message.id)||view==='message'&&message.id!==requestedId||typeof message.body!=='string'||message.body.length>8000||typeof message.senderName!=='string'||message.senderName.length>120||!['message','announcement','system'].includes(message.kind)||typeof message.createdAt!=='string'||message.createdAt.length>64||typeof message.editedAt!=='string'||message.editedAt.length>64||typeof message.hasAttachment!=='boolean'||typeof message.truncated!=='boolean')throw Error('Message unavailable. It may have been removed or your team access may have changed.')
 return message as ViewedChatMessage
}
export async function copyReviewedMessage(message:ViewedChatMessage,load:()=>Promise<ViewedChatMessage>,current:()=>boolean,write:typeof Clipboard.write=options=>Clipboard.write(options)){
 const fresh=await load();if(!current())throw Error('This message is no longer open.')
 if(['id','senderName','body','editedAt','createdAt','kind','truncated'].some(key=>fresh[key as keyof ViewedChatMessage]!==message[key as keyof ViewedChatMessage]))return {copied:false,message:fresh}
 await write({string:fresh.body});return {copied:true,message:fresh}
}
export function openChatMessage(scope:TeamScope,view:ChatMessageView,load:(current:()=>boolean)=>Promise<ViewedChatMessage>,current:()=>boolean){
 const dialog=document.createElement('dialog');dialog.className='chat-post-dialog';dialog.setAttribute('aria-label',view==='reply'?'Original message':'Team message');document.body.append(dialog)
 let disposed=false,busy=false,message:ViewedChatMessage|null=null,notice='',link:ReturnType<typeof openChatLink>|null=null
 const valid=()=>!disposed&&current(),close=()=>{disposed=true;message=null;link?.dispose();dialog.remove()}
 const render=()=>{if(!valid())return;dialog.innerHTML=`<h2 tabindex="-1">${view==='reply'?'Original message':'Team message'}</h2><p><strong>${html(scope.teamName)}</strong><br>${html(scope.leagueName)} · ${html(scope.flight)}</p>${message?`<p><strong>${html(message.senderName)}</strong><br>${html(message.createdAt&&Number.isFinite(Date.parse(message.createdAt))?new Date(message.createdAt).toLocaleString():'Time unavailable')}${message.editedAt?' · edited':''}</p>${message.kind==='announcement'?'<p class="chat-announcement">Captain announcement</p>':''}<p class="chat-message-text">${chatBodyHtml(message.body)}</p>${message.truncated?'<p class="rating-context">Showing the first 8,000 characters. Copy preview copies this text.</p>':''}${message.hasAttachment?'<p class="rating-context">This message includes an attachment. Open it from the conversation.</p>':''}<button type="button" data-copy ${busy?'disabled':''}>${busy?'Checking…':message.truncated?'Copy preview':'Copy text'}</button>`:''}<p role="status" tabindex="-1">${html(notice)}</p><button type="button" class="secondary" data-refresh ${busy?'disabled':''}>Refresh message</button><button type="button" class="secondary" data-close>Back to conversation</button>`
 dialog.querySelector<HTMLButtonElement>('[data-close]')!.onclick=close;dialog.querySelector<HTMLButtonElement>('[data-refresh]')!.onclick=()=>{void refresh()}
 dialog.querySelectorAll<HTMLButtonElement>('[data-chat-url]').forEach(button=>{button.onclick=()=>{link?.dispose();link=openChatLink(button.dataset.chatUrl||'',valid)}})
 dialog.querySelector<HTMLButtonElement>('[data-copy]')?.addEventListener('click',()=>{void (async()=>{if(busy||!message||!valid())return;busy=true;notice='Checking the latest message before copying…';const reviewed=message;render();try{const result=await copyReviewedMessage(reviewed,()=>load(valid),valid);if(valid()){message=result.message;notice=result.copied?(message.truncated?'Preview text copied.':'Message text copied.'):'This message changed. Review it before copying.'}}catch{if(valid()){message=null;link?.dispose();notice='Message unavailable. Refresh to check your team access and the latest post.'}}finally{if(valid()){busy=false;render();dialog.querySelector<HTMLElement>('[role=status]')?.focus()}}})()})
 }
 const refresh=async()=>{if(busy||!valid())return;busy=true;message=null;link?.dispose();notice='Loading message…';render();try{const result=await load(valid);if(valid()){message=result;notice=''}}catch{if(valid())notice='Message unavailable. It may have been removed or your team access may have changed.'}finally{if(valid()){busy=false;render();dialog.querySelector<HTMLElement>('h2')?.focus()}}}
 dialog.oncancel=e=>{e.preventDefault();close()};render();dialog.showModal();void refresh();return {dispose:close,isOpen:()=>!disposed}
}
