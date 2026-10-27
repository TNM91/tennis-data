import library from './chat-gif-library.json'
import {chooseChatGif,gifFileData} from './chat-gifs'
import {html} from './match-details'
import type {ChatPhoto} from './chat-photos'
export {library as tennisGifLibrary}
export function chooseTeamGif(signal:AbortSignal):Promise<ChatPhoto>{
 return new Promise((resolve,reject)=>{
  if(signal.aborted){reject(Error('No GIF added.'));return}
  const origin=document.activeElement instanceof HTMLElement?document.activeElement:null,dialog=document.createElement('dialog')
  dialog.className='chat-post-dialog chat-gif-library';dialog.setAttribute('aria-labelledby','chat-gif-library-title')
  dialog.innerHTML=`<h1 id="chat-gif-library-title" tabindex="-1">Tennis GIFs</h1><p>Pick a little courtside energy. Preview it in your draft before sending.</p><div class="chat-gif-library-grid">${library.map((item,index)=>`<button type="button" class="secondary" data-tennis-gif="${index}"><img src="${item.preview}" alt="" width="280" height="180"><span>${html(item.label)}</span></button>`).join('')}</div><button type="button" class="secondary" data-gif-file>Choose a GIF from files</button><button type="button" class="secondary" data-gif-cancel>Cancel</button><p role="status"></p>`
  const fileAbort=new AbortController()
  let done=false,busy=false
  const finish=(value?:ChatPhoto,error?:unknown)=>{if(done)return;done=true;fileAbort.abort();signal.removeEventListener('abort',cancel);document.removeEventListener('visibilitychange',visibility);dialog.remove();if(origin?.isConnected)origin.focus({preventScroll:true});if(value)resolve(value);else reject(error instanceof Error?error:Error('No GIF added.'))}
  const cancel=()=>finish()
  const visibility=()=>{if(document.visibilityState!=='visible')cancel()}
  document.addEventListener('visibilitychange',visibility)
  signal.addEventListener('abort',cancel,{once:true});dialog.oncancel=e=>{e.preventDefault();cancel()}
  dialog.querySelector('[data-gif-cancel]')!.addEventListener('click',cancel)
  const select=async(task:()=>Promise<ChatPhoto>)=>{
   if(done||busy||signal.aborted)return;busy=true;dialog.querySelectorAll<HTMLButtonElement>('[data-tennis-gif],[data-gif-file]').forEach(button=>{button.disabled=true});dialog.querySelector('[role=status]')!.textContent='Preparing your GIF...'
   try{const photo=await task();if(!done&&!signal.aborted)finish(photo)}catch(error){if(!done&&!signal.aborted)finish(undefined,error)}
  }
  dialog.querySelectorAll<HTMLButtonElement>('[data-tennis-gif]').forEach(button=>{button.onclick=()=>{void select(async()=>{
   const item=library[Number(button.dataset.tennisGif)];if(!item)throw Error('GIF unavailable.')
   const bytes=Uint8Array.from(atob(item.base64),char=>char.charCodeAt(0))
   return gifFileData({size:bytes.length,arrayBuffer:async()=>bytes.buffer})
  })}})
  dialog.querySelector('[data-gif-file]')!.addEventListener('click',()=>{void select(()=>chooseChatGif(fileAbort.signal))})
  document.body.append(dialog);dialog.showModal();dialog.querySelector<HTMLElement>('h1')!.focus()
 })
}
