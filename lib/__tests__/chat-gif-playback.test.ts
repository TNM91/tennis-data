import {afterEach,describe,it,expect,vi} from 'vitest'
import {chatGifPlayback} from '../../mobile/src/chat-gif-playback'
afterEach(()=>vi.unstubAllGlobals())
function environment(){
 let callback:IntersectionObserverCallback=()=>{}
 vi.stubGlobal('document',{visibilityState:'visible'})
 vi.stubGlobal('IntersectionObserver',class{constructor(fn:IntersectionObserverCallback){callback=fn}observe(){}disconnect(){}})
 const button=(id:string)=>{const image={src:'poster-'+id,alt:''},label={textContent:''},attrs=new Map<string,string>(),dataset:Record<string,string>={chatPhoto:id};const b={dataset,isConnected:true,querySelector:(selector:string)=>selector==='img'?image:label,setAttribute:(key:string,value:string)=>attrs.set(key,value),removeAttribute:(key:string)=>{attrs.delete(key);if(key==='data-gif-playing')delete dataset.gifPlaying},closest:()=>({})};return {b:b as unknown as HTMLButtonElement,image,label,attrs}}
 return {button,offscreen:(b:HTMLButtonElement)=>callback([{target:b,isIntersecting:false}] as unknown as IntersectionObserverEntry[],{} as IntersectionObserver)}
}
describe('private inline GIF playback',()=>{
 it('plays only after a tap, restores a still poster on pause and stops another active GIF',async()=>{
  const env=environment(),one=env.button('one'),two=env.button('two'),load=vi.fn(async(id:string)=>'animation-'+id),gifs=chatGifPlayback(load,()=>true)
  expect(load).not.toHaveBeenCalled();await gifs.toggle(one.b);expect(one.image.src).toBe('animation-one');expect(one.label.textContent).toBe('Pause team GIF')
  await gifs.toggle(one.b);expect(one.image.src).toBe('poster-one');expect(one.label.textContent).toBe('Play team GIF')
  await gifs.toggle(one.b);await gifs.toggle(two.b);expect(one.image.src).toBe('poster-one');expect(two.image.src).toBe('animation-two')
  env.offscreen(two.b);expect(two.image.src).toBe('poster-two');gifs.clear()
 })
 it('caps in-flight downloads and discards late results after clearing, backgrounding or session loss',async()=>{
  const env=environment(),one=env.button('one'),two=env.button('two');let finish!:(v:string)=>void,current=true
  const load=vi.fn(()=>new Promise<string>(resolve=>{finish=resolve})),gifs=chatGifPlayback(load,()=>current)
  const task=gifs.toggle(one.b);await gifs.toggle(two.b);expect(load).toHaveBeenCalledTimes(1);gifs.clear();current=false;finish('private');await task;expect(one.image.src).toBe('poster-one')
  Object.assign(document,{visibilityState:'hidden'});current=true;await gifs.toggle(two.b);expect(load).toHaveBeenCalledTimes(1)
 })
 it('keeps errors local and retries only when tapped again',async()=>{
  const env=environment(),one=env.button('one'),load=vi.fn().mockRejectedValue(Error('Unavailable')),gifs=chatGifPlayback(load,()=>true)
  await gifs.toggle(one.b);expect(one.label.textContent).toContain('tap to retry');expect(one.image.src).toBe('poster-one');expect(load).toHaveBeenCalledTimes(1)
  load.mockResolvedValue('animation');await gifs.toggle(one.b);expect(one.image.src).toBe('animation');expect(load).toHaveBeenCalledTimes(2)
 })
})
