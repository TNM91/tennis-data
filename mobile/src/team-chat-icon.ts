import {CapacitorHttp} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {ChatPhoto} from './chat-photos'
import {firstPartyTeamRooms,matchesTeamReleaseScope} from './first-party-team-transport'
import {html} from './html'
import type {NativeTeamRoom} from './team-room-data'
import {drawChatIcon,encodeChatIcon,loadChatIcon} from './chat-icon-frame'

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

export function openChatIconEditor(
 subject: { name: string; logo?: string; kind: 'Team' | 'Group' | 'Channel' }, current: () => boolean,
 saveIcon: (photo: ChatPhoto | null) => Promise<void>, onClose: (changed: boolean) => void,
){
 const {name,logo,kind}=subject
 const label=kind.toLowerCase()
 const dialog=document.createElement('dialog')
 dialog.className='captain-lineup-dialog team-chat-icon-dialog'
 dialog.setAttribute('aria-labelledby','team-chat-icon-title')
 dialog.innerHTML=`<div class="team-chat-icon-heading">
  <h2 id="team-chat-icon-title" tabindex="-1">${kind==='Channel'?'Chat icon':kind+' chat icon'}</h2>
  <button type="button" class="secondary" data-close-icon aria-label="Close ${label} icon editor">Close</button>
 </div>
  <form>
   <div class="team-chat-icon-picker">
    <div data-team-icon-preview>${teamChatAvatarHtml(name,logo)}</div>
    <button type="button" class="secondary" data-choose-icon>Choose photo</button>
    <input type="file" accept="image/*" aria-label="${kind} icon photo" hidden>
   </div>
   <fieldset class="chat-icon-frame" hidden>
    <legend>Frame photo</legend>
    <label for="chat-icon-fit">Fit</label><select id="chat-icon-fit" data-icon-fit><option value="fill">Fill square</option><option value="fit">Show full photo</option></select>
    <label>Zoom<input type="range" data-icon-zoom min="100" max="200" step="5" value="100"></label>
    <label>Horizontal position<input type="range" data-icon-x min="-100" max="100" value="0"></label>
    <label>Vertical position<input type="range" data-icon-y min="-100" max="100" value="0"></label>
    <button type="button" class="secondary" data-icon-center>Center photo</button>
   </fieldset>
   <div class="team-chat-icon-actions">
    ${logo?'<button type="button" class="secondary" data-icon-reframe>Adjust photo</button><button type="button" class="secondary" data-remove-icon>Remove icon</button>':''}
    <button type="submit" aria-label="Save ${label} icon" hidden disabled>Save</button>
   </div>
   <p role="status"></p>
  </form>`
 const preview=dialog.querySelector<HTMLElement>('[data-team-icon-preview]')!
 const form=dialog.querySelector('form')!,input=form.querySelector<HTMLInputElement>('input[type=file]')!
 const save=form.querySelector<HTMLButtonElement>('button[type="submit"]')!
 const choose=form.querySelector<HTMLButtonElement>('[data-choose-icon]')!
 const remove=form.querySelector<HTMLButtonElement>('[data-remove-icon]')
 const dismiss=dialog.querySelector<HTMLButtonElement>('[data-close-icon]')!
 const status=form.querySelector<HTMLElement>('[role="status"]')!
 const frame=form.querySelector<HTMLFieldSetElement>('.chat-icon-frame')!
 const fit=frame.querySelector<HTMLSelectElement>('[data-icon-fit]')!
 const zoom=frame.querySelector<HTMLInputElement>('[data-icon-zoom]')!
 const x=frame.querySelector<HTMLInputElement>('[data-icon-x]')!
 const y=frame.querySelector<HTMLInputElement>('[data-icon-y]')!
 const reframe=form.querySelector<HTMLButtonElement>('[data-icon-reframe]')
 const canvas=document.createElement('canvas')
 canvas.width=canvas.height=512
 let image:HTMLImageElement|null=null,busy=false,disposed=false,revision=0
 const active=()=>!disposed&&current()
 const dispose=()=>{disposed=true;revision++;image=null;canvas.width=canvas.height=0;dialog.remove()}
 const close=(changed=false)=>{if(disposed)return;dispose();onClose(changed)}
 choose.onclick=()=>input.click()
 function paintFrame(){
  if(!image)return
  drawChatIcon(canvas,image,{zoom:Number(zoom.value)/100,x:Number(x.value)/100,y:Number(y.value)/100,fit:fit.value==='fit'})
  // Display exactly the square being saved, with no additional object-fit crop.
  if(!preview.contains(canvas)){
   canvas.setAttribute('role','img')
   canvas.setAttribute('aria-label','Framed chat icon')
   preview.replaceChildren(canvas)
  }
 }
 frame.oninput=paintFrame
 frame.querySelector<HTMLButtonElement>('[data-icon-center]')!.onclick=()=>{x.value=y.value='0';paintFrame()}
 const prepare=async(source:()=>Promise<string>,remote=false)=>{
  if(busy||!active())return
  const attempt=++revision
  image=null;frame.hidden=true;save.disabled=true;save.hidden=true
  preview.innerHTML=teamChatAvatarHtml(name,logo)
  bindTeamChatAvatars(preview)
  status.textContent='Preparing photo…'
  try{
   const href=await source()
   if(!active()||attempt!==revision)return
   const next=await loadChatIcon(href,remote)
   if(!active()||attempt!==revision)return
   image=next
   fit.value='fill';zoom.value='100';x.value=y.value='0'
   paintFrame()
   frame.hidden=false
   status.textContent=''
   save.hidden=false;save.disabled=false
  }catch{
   if(active()&&attempt===revision)status.textContent='Choose another photo.'
  }
 }
 input.onchange=()=>{
  const file=input.files?.[0]
  input.value=''
  if(file)void prepare(()=>file.size>20*1024*1024?Promise.reject(Error()):readPhotoFile(file))
 }
 if(reframe&&logo)reframe.onclick=()=>{void prepare(()=>Promise.resolve(logo),true)}
 const submit=async(photo:ChatPhoto|null)=>{
  if(!active()||busy)return
  busy=true;revision++;input.disabled=true;choose.disabled=true;save.disabled=true;dismiss.disabled=true
  if(remove)remove.disabled=true
  if(reframe)reframe.disabled=true
  frame.disabled=true
  status.textContent=photo?'Saving icon…':'Removing icon…'
  try{
   await saveIcon(photo)
   if(!active())return
   close(true)
  }catch(error){
   if(active())status.textContent=error instanceof Error?error.message:'The icon could not be saved.'
  }finally{
   if(active()){busy=false;input.disabled=false;choose.disabled=false;save.disabled=!image;dismiss.disabled=false;frame.disabled=false;if(remove)remove.disabled=false;if(reframe)reframe.disabled=false}
  }
 }
 form.onsubmit=event=>{
  event.preventDefault()
  if(!image||busy)return
  try{void submit(encodeChatIcon(canvas))}catch(error){status.textContent=error instanceof Error?error.message:'Choose another photo.'}
 }
 if(remove)remove.onclick=()=>{void submit(null)}
 dismiss.onclick=()=>{if(!busy)close()}
 dialog.oncancel=event=>{event.preventDefault();if(!busy)close()}
 document.body.append(dialog)
 dialog.showModal()
 bindTeamChatAvatars(preview)
 dialog.querySelector('h2')!.focus({preventScroll:true})
 return {isOpen:()=>!disposed,close:()=>{if(!busy)close()},dispose,keepWhileHidden:true}
}

export function openTeamChatIcon(client:SupabaseClient,owner:string,room:NativeTeamRoom,current:()=>boolean,onClose:(changed:boolean)=>void){
 return openChatIconEditor(room.chatRoom
  ?{name:room.chatRoom.name,logo:room.chatLogoUrl,kind:'Channel'}
  :{name:room.teamName,logo:room.teamLogoUrl,kind:'Team'},current,async image=>{
  const session=(await client.auth.getSession()).data.session
  if(!current()||session?.user.id!==owner)throw Error('Sign in again to update the icon.')
  const {teamName,leagueName,flight,id:roomId}=room
  const response=await CapacitorHttp.post({
   url:firstPartyTeamRooms+'/branding',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
   data:{teamName,leagueName,flight,roomId,photo:image?.base64??null,...(room.chatRoom?{chatRoomId:room.chatRoom.id}:{})},
   responseType:'json',disableRedirects:true,connectTimeout:12000,readTimeout:20000,
  })
  if(response.status===409)throw Error('The team icon changed. Reopen this chat and try again.')
  if(response.status!==200||response.data?.ok!==true||!matchesTeamReleaseScope(response.data,owner)||
    response.data.roomId!==roomId||response.data.hasLogo!==Boolean(image))throw Error('The icon change could not be confirmed. Refresh your chat.')
 },onClose)
}
