/** Only explicit taps fetch/play animation. One visible GIF at a time; no persistent cache. */
export function chatGifPlayback(load:(id:string)=>Promise<string>,isCurrent:()=>boolean){
 let active:{button:HTMLButtonElement;poster:string;version:number}|null=null,epoch=0,fetching=false,observer:IntersectionObserver|null=null
 const label=(button:HTMLButtonElement,text:string)=>{const target=button.querySelector('[data-gif-label]');if(target)target.textContent=text;button.setAttribute('aria-label',text)}
 const clear=()=>{epoch++;observer?.disconnect();observer=null;if(active){const image=active.button.querySelector('img');if(image){if(active.poster){image.src=active.poster;image.alt='GIF preview shared with your team'}else image.remove()};if(!active.poster){const target=active.button.querySelector('[data-photo-preview]');if(target)target.textContent='GIF preview unavailable · tap to play'};active.button.removeAttribute('data-gif-playing');active.button.removeAttribute('aria-busy');label(active.button,'Play team GIF');active=null}}
 const toggle=async(button:HTMLButtonElement)=>{
  if(active?.button===button){clear();return}
  if(fetching)return
  clear();const poster=button.querySelector('img')?.src || '',id=button.dataset.chatPhoto
  if(!id || !isCurrent() || document.visibilityState!=='visible')return
  button.dataset.gifPlaying='true'
  const version=epoch;active={button,poster,version};label(button,'Loading GIF…');button.setAttribute('aria-busy','true')
  if(typeof IntersectionObserver!=='undefined'){observer=new IntersectionObserver(entries=>{if(entries.some(entry=>!entry.isIntersecting))clear()},{root:button.closest('.team-conversation'),threshold:0.05});observer.observe(button)}
  fetching=true
  try{
   const source=await load(id)
   if(!active || version!==epoch || !isCurrent() || !button.isConnected || document.visibilityState!=='visible')return
   let image=button.querySelector('img');if(!image){image=document.createElement('img');button.querySelector('[data-photo-preview]')?.replaceChildren(image)}
   image.src=source;image.alt='Animated GIF shared with your team';button.removeAttribute('aria-busy');label(button,'Pause team GIF')
  }catch{if(active && version===epoch){clear();label(button,'GIF unavailable · tap to retry')}}finally{fetching=false}
 }
 return {toggle,clear}
}
