/** Private, in-memory thumbnails. Only visible photos load; no idle refresh or persistent cache. */
export function chatPhotoPreviews(load:(id:string)=>Promise<string>,isCurrent:()=>boolean){
 const cache=new Map<string,string>(),pending=new Set<string>(),failed=new Set<string>(),visible=new Set<string>()
 let observer:IntersectionObserver|null=null,root:HTMLElement|null=null,epoch=0,active=0,disposed=false
 const buttons=()=>root?Array.from(root.querySelectorAll<HTMLButtonElement>('[data-chat-photo]')):[]
 const paint=(id:string,source:string)=>{for(const button of buttons().filter(button=>button.dataset.chatPhoto===id)){
  if(button.dataset.gifPlaying==='true')continue
  const target=button.querySelector('[data-photo-preview]');if(!target)continue
  const image=document.createElement('img');image.src=source;image.alt='Photo shared with your team';image.width=320;image.height=240;image.decoding='async';target.replaceChildren(image)
 }}
 const pump=()=>{
  if(disposed || !isCurrent() || document.visibilityState!=='visible')return
  for(const id of visible){
   if(active>=2)break
   if(cache.has(id) || pending.has(id) || failed.has(id))continue
   const version=epoch;active++;pending.add(id)
   void load(id).then(source=>{
    if(disposed || version!==epoch || !isCurrent() || document.visibilityState!=='visible' || !buttons().some(button=>button.dataset.chatPhoto===id))return
    cache.delete(id);cache.set(id,source);while(cache.size>24)cache.delete(cache.keys().next().value!)
    paint(id,source)
   }).catch(()=>{if(!disposed && version===epoch){failed.add(id);for(const button of buttons().filter(button=>button.dataset.chatPhoto===id)){const target=button.querySelector('[data-photo-preview]');if(target)target.textContent='Photo unavailable · tap to retry'}}})
    .finally(()=>{active--;if(version===epoch)pending.delete(id);pump()})
  }
 }
 const attach=(next:HTMLElement|null)=>{
  observer?.disconnect();observer=null;visible.clear();root=next
  const current=new Set(buttons().map(button=>button.dataset.chatPhoto!))
  for(const id of cache.keys())if(!current.has(id))cache.delete(id)
  for(const id of failed)if(!current.has(id))failed.delete(id)
  for(const button of buttons()){const id=button.dataset.chatPhoto!,source=cache.get(id);if(source)paint(id,source)}
  if(!root || disposed || !isCurrent() || document.visibilityState!=='visible' || typeof IntersectionObserver==='undefined')return
  observer=new IntersectionObserver(entries=>{for(const entry of entries){const id=(entry.target as HTMLElement).dataset.chatPhoto!;if(entry.isIntersecting)visible.add(id);else visible.delete(id)}pump()},{root,threshold:0.05})
  for(const button of buttons())observer.observe(button)
 }
 const clear=()=>{epoch++;observer?.disconnect();observer=null;visible.clear();pending.clear();failed.clear();cache.clear();for(const button of buttons()){const target=button.querySelector('[data-photo-preview]');if(target)target.textContent='Loading photo…'}root=null}
 return {attach,clear,dispose:()=>{disposed=true;clear()}}
}
