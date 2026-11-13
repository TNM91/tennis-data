import {CapacitorHttp} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import {resizeChatPhoto,type ChatPhoto} from './chat-photos'
import {firstPartyTeamRooms,matchesTeamReleaseScope} from './first-party-team-transport'
import {html} from './match-details'
import type {NativeTeamRoom} from './team-room-data'

export function teamChatAvatarHtml(name:string,url?:string){
 return `<span class="chats-team-avatar" aria-hidden="true"><span>${html(Array.from(name.trim())[0]?.toUpperCase()||'?')}</span>${url?`<img src="${html(url)}" alt="" referrerpolicy="no-referrer">`:''}</span>`
}

export function bindTeamChatAvatars(host:ParentNode){
 for(const image of host.querySelectorAll<HTMLImageElement>('.chats-team-avatar img')){
  image.onerror=()=>image.remove()
  if(image.complete&&!image.naturalWidth)image.remove()
 }
}

function readPhotoFile(file:File){
 return new Promise<string>((resolve,reject)=>{
  const reader=new FileReader()
  reader.onload=()=>typeof reader.result==='string'?resolve(reader.result):reject(Error('Photo unavailable.'))
  reader.onerror=reader.onabort=()=>reject(Error('Photo unavailable.'))
  reader.readAsDataURL(file)
 })
}

export function openTeamChatIcon(client:SupabaseClient,owner:string,room:NativeTeamRoom,current:()=>boolean,onClose:(changed:boolean)=>void){
 const dialog=document.createElement('dialog')
 dialog.className='captain-lineup-dialog team-chat-icon-dialog'
 dialog.setAttribute('aria-labelledby','team-chat-icon-title')
 dialog.innerHTML=`<div class="team-chat-icon-heading">
  <h2 id="team-chat-icon-title" tabindex="-1">Team chat icon</h2>
  <button type="button" class="secondary" data-close-icon aria-label="Close team icon editor">Close</button>
 </div>
  <form>
   <div class="team-chat-icon-picker">
    <div data-team-icon-preview>${teamChatAvatarHtml(room.teamName,room.teamLogoUrl)}</div>
    <button type="button" class="secondary" data-choose-icon>Choose photo</button>
    <input type="file" accept="image/*" aria-label="Team icon photo" hidden>
   </div>
   <div class="team-chat-icon-actions">
    ${room.teamLogoUrl?'<button type="button" class="secondary" data-remove-icon>Remove icon</button>':''}
    <button type="submit" aria-label="Save team icon" hidden disabled>Save</button>
   </div>
   <p role="status"></p>
  </form>`
 const preview=dialog.querySelector<HTMLElement>('[data-team-icon-preview]')!
 const form=dialog.querySelector('form')!,input=form.querySelector('input')!
 const save=form.querySelector<HTMLButtonElement>('button[type="submit"]')!
 const choose=form.querySelector<HTMLButtonElement>('[data-choose-icon]')!
 const remove=form.querySelector<HTMLButtonElement>('[data-remove-icon]')
 const dismiss=dialog.querySelector<HTMLButtonElement>('[data-close-icon]')!
 const status=form.querySelector<HTMLElement>('[role="status"]')!
 let photo:ChatPhoto|null=null,busy=false,disposed=false,revision=0
 const active=()=>!disposed&&current()
 const dispose=()=>{disposed=true;revision++;photo=null;dialog.remove()}
 const close=(changed=false)=>{if(disposed)return;dispose();onClose(changed)}
 choose.onclick=()=>input.click()
 input.onchange=async()=>{
  const file=input.files?.[0]
  if(!file||busy||!active())return
  input.value=''
  const attempt=++revision
  photo=null;save.disabled=true;save.hidden=true
  preview.innerHTML=teamChatAvatarHtml(room.teamName,room.teamLogoUrl)
  bindTeamChatAvatars(preview)
  status.textContent='Preparing photo…'
  try{
   if(file.size>20*1024*1024)throw Error()
   const source=await readPhotoFile(file)
   if(!active()||attempt!==revision)return
   const next=await resizeChatPhoto(source,512)
   if(next.base64.length>350_000)throw Error()
   if(!active()||attempt!==revision)return
   photo=next
   preview.innerHTML=teamChatAvatarHtml(room.teamName,next.preview)
   status.textContent=''
   save.hidden=false;save.disabled=false
  }catch{
   if(active()&&attempt===revision)status.textContent='Choose another photo.'
  }
 }
 const submit=async(image:ChatPhoto|null)=>{
  if(!active()||busy)return
  busy=true;revision++;input.disabled=true;choose.disabled=true;save.disabled=true;dismiss.disabled=true
  if(remove)remove.disabled=true
  status.textContent=image?'Saving team icon…':'Removing team icon…'
  try{
   const session=(await client.auth.getSession()).data.session
   if(!active()||session?.user.id!==owner)throw Error('Sign in again to update the icon.')
   const {teamName,leagueName,flight,id:roomId}=room
   const response=await CapacitorHttp.post({
    url:firstPartyTeamRooms+'/branding',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
    data:{teamName,leagueName,flight,roomId,photo:image?.base64??null},
    responseType:'json',disableRedirects:true,connectTimeout:12000,readTimeout:20000,
   })
   if(!active())return
   if(response.status===409)throw Error('The team icon changed. Reopen this chat and try again.')
   if(response.status!==200||response.data?.ok!==true||!matchesTeamReleaseScope(response.data,owner)||
     response.data.roomId!==roomId||response.data.hasLogo!==Boolean(image))throw Error('The icon change could not be confirmed. Refresh your chat.')
   close(true)
  }catch(error){
   if(active())status.textContent=error instanceof Error?error.message:'The team icon could not be saved.'
  }finally{
   if(active()){busy=false;input.disabled=false;choose.disabled=false;save.disabled=!photo;dismiss.disabled=false;if(remove)remove.disabled=false}
  }
 }
 form.onsubmit=event=>{event.preventDefault();if(photo)void submit(photo)}
 if(remove)remove.onclick=()=>{void submit(null)}
 dismiss.onclick=()=>{if(!busy)close()}
 dialog.oncancel=event=>{event.preventDefault();if(!busy)close()}
 document.body.append(dialog)
 dialog.showModal()
 bindTeamChatAvatars(preview)
 dialog.querySelector('h2')!.focus({preventScroll:true})
 return {isOpen:()=>!disposed,close:()=>{if(!busy)close()},dispose,keepWhileHidden:true}
}
