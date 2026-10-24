import {afterEach,describe,it,expect,vi} from 'vitest'
import {chatPhotoPreviews} from '../../mobile/src/chat-photo-previews'
afterEach(()=>vi.unstubAllGlobals())
function environment(ids:string[]){
 const items=ids.map(id=>{const target={textContent:'Loading photo…',replaceChildren:vi.fn()};return {dataset:{chatPhoto:id},querySelector:()=>target,target}})
 let callback:IntersectionObserverCallback=()=>{}
 const root={querySelectorAll:()=>items} as unknown as HTMLElement
 vi.stubGlobal('document',{visibilityState:'visible',createElement:()=>({})})
 vi.stubGlobal('IntersectionObserver',class{constructor(fn:IntersectionObserverCallback){callback=fn}observe(){}disconnect(){}})
 const visible=(indexes:number[])=>callback(indexes.map(index=>({target:items[index],isIntersecting:true})) as unknown as IntersectionObserverEntry[],{} as IntersectionObserver)
 return {items,root,visible}
}
const flush=async()=>{for(let i=0;i<5;i++)await Promise.resolve()}
describe('private inline photo previews',()=>{
 it('loads only visible images, caps concurrency at two and reuses the current-room memory cache',async()=>{
  const env=environment(['a','b','c']),finish=new Map<string,(value:string)=>void>()
  const load=vi.fn((id:string)=>new Promise<string>(resolve=>finish.set(id,resolve))),previews=chatPhotoPreviews(load,()=>true)
  previews.attach(env.root);expect(load).not.toHaveBeenCalled()
  env.visible([0,1,2]);expect(load).toHaveBeenCalledTimes(2)
  finish.get('a')!('private-a');await flush();expect(load).toHaveBeenCalledTimes(3);expect(env.items[0].target.replaceChildren).toHaveBeenCalledTimes(1)
  finish.get('b')!('private-b');finish.get('c')!('private-c');await flush()
  previews.attach(env.root);env.visible([0]);expect(load).toHaveBeenCalledTimes(3)
  previews.dispose();expect(env.items[0].target.textContent).toBe('Loading photo…')
 })
 it('discards late private results after clearing or losing the owning session',async()=>{
  const env=environment(['a']);let finish!:(value:string)=>void,current=true
  const previews=chatPhotoPreviews(()=>new Promise<string>(resolve=>{finish=resolve}),()=>current)
  previews.attach(env.root);env.visible([0]);previews.clear();current=false;finish('private');await flush()
  expect(env.items[0].target.replaceChildren).not.toHaveBeenCalled();previews.dispose()
 })
 it('suppresses offscreen/background requests and does not automatically retry a failed thumbnail',async()=>{
  const env=environment(['a']),load=vi.fn().mockRejectedValue(Error('Unavailable')),previews=chatPhotoPreviews(load,()=>true)
  Object.assign(document,{visibilityState:'hidden'});previews.attach(env.root);expect(load).not.toHaveBeenCalled()
  Object.assign(document,{visibilityState:'visible'});previews.attach(env.root);env.visible([0]);await flush();env.visible([0]);await flush()
  expect(load).toHaveBeenCalledTimes(1);expect(env.items[0].target.textContent).toContain('tap to retry');previews.dispose()
 })
})
