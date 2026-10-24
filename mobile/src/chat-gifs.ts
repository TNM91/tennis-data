import {inspectChatGif,maxChatGifBytes} from '../../lib/chat-gif'
import type {ChatPhoto} from './chat-photos'
export async function gifFileData(file:Pick<File,'size'|'arrayBuffer'>):Promise<ChatPhoto>{
 if(file.size<14 || file.size>maxChatGifBytes)throw Error('Choose a GIF up to 2 MB.')
 const bytes=new Uint8Array(await file.arrayBuffer());inspectChatGif(bytes)
 let binary='';for(let at=0;at<bytes.length;at+=8192)binary+=String.fromCharCode(...bytes.subarray(at,at+8192))
 const base64=btoa(binary),source='data:image/gif;base64,'+base64,image=new Image()
 await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{image.src='';reject(Error('GIF preview unavailable.'))},12000);image.onload=()=>{clearTimeout(timer);resolve()};image.onerror=()=>{clearTimeout(timer);reject(Error('GIF preview unavailable.'))};image.src=source})
 const scale=Math.min(1,320/image.naturalWidth,320/image.naturalHeight),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale))
 const context=canvas.getContext('2d');if(!context){image.src='';throw Error('GIF preview unavailable.')}
 context.drawImage(image,0,0,canvas.width,canvas.height);const preview=canvas.toDataURL('image/jpeg',0.7);canvas.width=0;canvas.height=0;image.src=''
 return {base64,preview,mimeType:'image/gif'}
}
/** Keep the original file bytes; Camera/canvas conversion would flatten the animation. */
export function chooseChatGif(signal:AbortSignal){
 return new Promise<ChatPhoto>((resolve,reject)=>{
  const input=document.createElement('input');input.type='file';input.accept='image/gif,.gif';input.hidden=true;input.setAttribute('aria-label','Choose team GIF');document.body.append(input)
  let done=false,focusTimer:ReturnType<typeof setTimeout>|undefined
  const cleanup=()=>{clearTimeout(timer);clearTimeout(focusTimer);signal.removeEventListener('abort',cancel);window.removeEventListener('focus',onFocus);input.remove()}
  const finish=(error?:Error,value?:ChatPhoto)=>{if(done)return;done=true;cleanup();if(value)resolve(value);else reject(error || Error('No GIF added.'))}
  const cancel=()=>finish(Error('No GIF added.'))
  const onFocus=()=>{focusTimer=setTimeout(()=>{if(!input.files?.length)cancel()},1000)}
  const timer=setTimeout(cancel,120000)
  input.oncancel=cancel;input.onchange=()=>{const file=input.files?.[0];if(!file){cancel();return}void gifFileData(file).then(value=>finish(undefined,value),error=>finish(error instanceof Error?error:Error('GIF unavailable.')))}
  signal.addEventListener('abort',cancel,{once:true});window.addEventListener('focus',onFocus)
  if(signal.aborted)cancel();else input.click()
 })
}
