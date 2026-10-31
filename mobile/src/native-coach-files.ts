import {Capacitor,registerPlugin} from '@capacitor/core'
const files=registerPlugin<{exportFile:(options:{owner:string;requestId:string;name:string;mime:string;base64:string})=>Promise<{completed:boolean}>;cancel:(options:{owner:string})=>Promise<void>;begin:(options:{owner:string;requestId:string;name:string;mime:string;size:number})=>Promise<void>;append:(options:{owner:string;requestId:string;offset:number;base64:string})=>Promise<void>;share:(options:{owner:string;requestId:string})=>Promise<{completed:boolean}>}>('TiqFiles')
export async function exportCoachFile(owner:string,current:()=>boolean,blob:Blob,name:string,nativeFiles:Pick<typeof files,'begin'|'append'|'share'|'cancel'>|null=Capacitor.getPlatform()==='ios'?files:null){
 if(!current())throw Error('Account changed')
 const mime=blob.type.split(';')[0],extension=({'image/png':'png','application/json':'json','text/calendar':'ics','text/plain':'txt','video/mp4':'mp4','video/quicktime':'mov','video/webm':'webm'} as Record<string,string>)[mime]
 if(blob.size>700*1024*1024||!extension)throw Error('Choose a smaller supported export')
 name=(name.replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9_-]/g,'-').replace(/^[^a-zA-Z0-9]+/,'').slice(0,90)||'tenaceiq-export')+'.'+extension
 if(nativeFiles){
  const requestId=crypto.randomUUID()
  await nativeFiles.begin({owner,requestId,name,mime,size:blob.size})
  try{
   for(let offset=0;offset<blob.size;offset+=1024*1024){
    if(!current())throw Error('Account changed')
    const part=blob.slice(offset,Math.min(blob.size,offset+1024*1024))
    const base64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(Error('Export could not be read'));reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');reader.readAsDataURL(part)})
    if(!current())throw Error('Account changed')
    await nativeFiles.append({owner,requestId,offset,base64})
   }
   if(!current())throw Error('Account changed')
   await nativeFiles.share({owner,requestId});if(!current())throw Error('Account changed')
  }catch(error){await nativeFiles.cancel({owner}).catch(()=>{});throw error}
  return
 }
 const file=new File([blob],name,{type:blob.type})
 if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:name});return}
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;(Array.from(document.querySelectorAll('dialog[open]')).at(-1)??document.body).append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)
}
export async function cancelCoachFile(owner:string){if(Capacitor.getPlatform()==='ios')await files.cancel({owner})}
