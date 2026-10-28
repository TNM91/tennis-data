import library from './chat-gif-library.json'
import {chooseChatGif,gifFileData} from './chat-gifs'
import {html} from './match-details'
import type {ChatPhoto} from './chat-photos'
export {library as tennisGifLibrary}
export const tennisGifCategories=['All','Hype','Match day','Respect'] as const
export type TennisGifCategory=typeof tennisGifCategories[number]
const searchText=(value:string)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
export function filterTennisGifs(query:string,category:TennisGifCategory='All'){
 const words=searchText(query.slice(0,80)).trim().split(/\s+/).filter(Boolean)
 return library.filter(item=>(category==='All'||item.category===category)&&words.every(word=>searchText(item.label+' '+item.tags+' '+item.category).includes(word)))
}
export function chooseTeamGif(signal:AbortSignal):Promise<ChatPhoto>{
 return new Promise((resolve,reject)=>{
  if(signal.aborted){reject(Error('No GIF added.'));return}
  const origin=document.activeElement instanceof HTMLElement?document.activeElement:null,dialog=document.createElement('dialog')
  dialog.className='chat-post-dialog chat-gif-library';dialog.setAttribute('aria-labelledby','chat-gif-library-title')
  dialog.innerHTML=`<div class="chat-gif-heading"><h1 id="chat-gif-library-title" tabindex="-1">Tennis GIFs</h1><button type="button" class="secondary" data-gif-cancel aria-label="Close GIFs">Close</button></div><p data-gif-intro>Find your team's courtside energy.</p><div data-gif-content></div><div class="chat-gif-footer"><button type="button" class="secondary" data-gif-file>Choose a saved GIF</button></div><p class="rating-context">Choose an original GIF from Photos or Files. A screenshot is a still photo. You can also paste a copied GIF into your message when your keyboard provides the file.</p><p role="status" data-gif-status></p>`
  const fileAbort=new AbortController(),content=dialog.querySelector<HTMLElement>('[data-gif-content]')!,status=dialog.querySelector<HTMLElement>('[data-gif-status]')!
  let done=false,busy=false,query='',category:TennisGifCategory='All',selected:typeof library[number]|null=null,playing=false,browseScroll=0
  const stop=()=>{playing=false;const image=content.querySelector<HTMLImageElement>('[data-gif-preview]');if(image&&selected)image.src=selected.preview;const button=content.querySelector<HTMLButtonElement>('[data-gif-play]');if(button){button.textContent='Play preview';button.setAttribute('aria-pressed','false')}}
  const finish=(value?:ChatPhoto)=>{if(done)return;done=true;stop();fileAbort.abort();signal.removeEventListener('abort',cancel);document.removeEventListener('visibilitychange',visibility);dialog.remove();if(origin?.isConnected)origin.focus({preventScroll:true});if(value)resolve(value);else reject(Error('No GIF added.'))}
  const cancel=()=>finish()
  const visibility=()=>{if(document.visibilityState!=='visible')cancel()}
  document.addEventListener('visibilitychange',visibility)
  signal.addEventListener('abort',cancel,{once:true});dialog.oncancel=e=>{e.preventDefault();cancel()}
  dialog.querySelector('[data-gif-cancel]')!.addEventListener('click',cancel)
  const disable=(value:boolean)=>dialog.querySelectorAll<HTMLButtonElement|HTMLInputElement>('button:not([data-gif-cancel]),input').forEach(control=>{control.disabled=value})
  const select=async(task:()=>Promise<ChatPhoto>)=>{
   if(done||busy||signal.aborted)return;busy=true;stop();disable(true);status.textContent='Preparing your GIF...'
   try{const photo=await task();if(!done&&!signal.aborted)finish(photo)}catch(error){if(!done&&!signal.aborted){busy=false;disable(false);status.textContent=error instanceof Error?error.message:'GIF unavailable. Choose another.';content.querySelector<HTMLElement>('[data-gif-add]')?.focus()}}
  }
  const renderResults=()=>{
   const results=filterTennisGifs(query,category),grid=content.querySelector<HTMLElement>('[data-gif-results]')!
   grid.innerHTML=results.length?`<div class="chat-gif-library-grid">${results.map(item=>`<button type="button" class="secondary" data-tennis-gif="${html(item.id)}" aria-label="Preview ${html(item.label)}"><img src="${item.preview}" alt="" width="280" height="180"><span>${html(item.label)}</span></button>`).join('')}</div>`:'<p>No GIFs match. Try a different word or clear your filters.</p><button type="button" class="secondary" data-gif-clear>Clear filters</button>'
   status.textContent=`${results.length} ${results.length===1?'GIF':'GIFs'} · Pick one to preview.`
   content.querySelectorAll<HTMLButtonElement>('[data-tennis-gif]').forEach(button=>{button.onclick=()=>{if(busy||done)return;const item=library.find(item=>item.id===button.dataset.tennisGif);if(!item)return;browseScroll=dialog.scrollTop;selected=item;renderPreview()}})
   content.querySelector('[data-gif-clear]')?.addEventListener('click',()=>{if(busy||done)return;query='';category='All';renderBrowse();content.querySelector<HTMLInputElement>('input')!.focus()})
  }
  const renderBrowse=()=>{
   dialog.querySelector<HTMLElement>('[data-gif-intro]')!.hidden=false
   content.innerHTML=`<label class="chat-gif-search">Search GIFs<input type="search" maxlength="80" value="${html(query)}" placeholder="Try ace, rain or celebrate" autocomplete="off"></label><div class="chat-gif-categories" role="group" aria-label="GIF categories">${tennisGifCategories.map(value=>`<button type="button" class="secondary" data-gif-category="${value}" aria-pressed="${value===category}">${value}</button>`).join('')}</div><div data-gif-results></div>`
   content.querySelector<HTMLInputElement>('input')!.oninput=event=>{if(busy||done)return;query=(event.currentTarget as HTMLInputElement).value;renderResults()}
   content.querySelectorAll<HTMLButtonElement>('[data-gif-category]').forEach(button=>{button.onclick=()=>{if(busy||done)return;category=button.dataset.gifCategory as TennisGifCategory;content.querySelectorAll<HTMLButtonElement>('[data-gif-category]').forEach(choice=>choice.setAttribute('aria-pressed',String(choice===button)));renderResults()}})
   renderResults()
  }
  const renderPreview=()=>{
   if(!selected)return;stop();const item=selected;dialog.querySelector<HTMLElement>('[data-gif-intro]')!.hidden=true
   content.innerHTML=`<section class="chat-gif-review" aria-labelledby="chat-gif-selected"><p class="eyebrow">${html(item.category)}</p><h2 id="chat-gif-selected" tabindex="-1">${html(item.label)}</h2><img data-gif-preview src="${item.preview}" alt="${html(item.label)} tennis animation preview" width="280" height="180"><button type="button" class="secondary" data-gif-play aria-pressed="false">Play preview</button><p>Only added to your draft. Add a caption and send when you're ready.</p><button type="button" data-gif-add>Add to draft</button><button type="button" class="secondary" data-gif-back>Back to GIFs</button></section>`
   status.textContent='Still preview. Tap Play to see it move.'
   content.querySelector<HTMLButtonElement>('[data-gif-play]')!.onclick=()=>{if(done||busy)return;playing=!playing;content.querySelector<HTMLImageElement>('[data-gif-preview]')!.src=playing?'data:image/gif;base64,'+item.base64:item.preview;const button=content.querySelector<HTMLButtonElement>('[data-gif-play]')!;button.textContent=playing?'Pause preview':'Play preview';button.setAttribute('aria-pressed',String(playing));status.textContent=playing?'Preview playing.':'Preview paused.'}
   content.querySelector('[data-gif-add]')!.addEventListener('click',()=>{void select(async()=>{const bytes=Uint8Array.from(atob(item.base64),char=>char.charCodeAt(0));return gifFileData({size:bytes.length,arrayBuffer:async()=>bytes.buffer})})})
   content.querySelector('[data-gif-back]')!.addEventListener('click',()=>{if(done||busy)return;stop();selected=null;renderBrowse();dialog.scrollTop=browseScroll;content.querySelector<HTMLButtonElement>(`[data-tennis-gif="${item.id}"]`)?.focus({preventScroll:true})})
   dialog.scrollTop=0;content.querySelector<HTMLElement>('h2')!.focus({preventScroll:true})
  }
  dialog.querySelector('[data-gif-file]')!.addEventListener('click',()=>{void select(()=>chooseChatGif(fileAbort.signal))})
  document.body.append(dialog);renderBrowse();dialog.showModal();dialog.querySelector<HTMLElement>('h1')!.focus()
 })
}
