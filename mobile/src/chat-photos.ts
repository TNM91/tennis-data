import {Camera,MediaTypeSelection} from '@capacitor/camera'
export type ChatPhoto={base64:string;preview:string}
export async function chooseChatPhoto(source:'camera'|'library'):Promise<ChatPhoto>{
 const options={quality:75,targetWidth:1600,targetHeight:1600,correctOrientation:true,includeMetadata:false,webUseInput:true}
 const media=source==='camera'?await Camera.takePhoto({...options,saveToGallery:false}):(await Camera.chooseFromGallery({...options,mediaType:MediaTypeSelection.Photo,allowMultipleSelection:false,limit:1})).results[0]
 if(!media?.webPath)throw Error('No photo selected.')
 if(!localCameraSource(media.webPath,location.href))throw Error('Photo source unavailable.')
 return resizeChatPhoto(media.webPath)
}
export async function resizeChatPhoto(source:string):Promise<ChatPhoto>{
 const image=new Image()
 await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{image.onload=null;image.onerror=null;reject(Error('Photo could not be opened.'))},12000);image.onload=()=>{clearTimeout(timer);resolve()};image.onerror=()=>{clearTimeout(timer);reject(Error('Photo could not be opened.'))};image.src=source})
 if(!image.naturalWidth || !image.naturalHeight || image.naturalWidth*image.naturalHeight>64000000)throw Error('Choose a smaller photo.')
 const scale=Math.min(1,1600/image.naturalWidth,1600/image.naturalHeight),canvas=document.createElement('canvas')
 canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale))
 const context=canvas.getContext('2d');if(!context)throw Error('Photo preview unavailable.')
 context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height)
 const preview=canvas.toDataURL('image/jpeg',0.8),base64=preview.split(',')[1]
 canvas.width=0;canvas.height=0
 if(!base64 || base64.length>2796204)throw Error('Choose a smaller photo (up to 2 MB).')
 return {base64,preview}
}
export function privatePhotoData(value:unknown):string{
 const data=value as {ok?:boolean;mimeType?:string;base64?:string}
 if(data?.ok!==true || data.mimeType!=='image/jpeg' || typeof data.base64!=='string' || !data.base64.length || data.base64.length>2796204 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data.base64))throw Error('Photo unavailable.')
 return 'data:image/jpeg;base64,'+data.base64
}

export function localCameraSource(source:string,locationHref:string){
 try{const url=new URL(source,locationHref),own=new URL(locationHref);return url.protocol===own.protocol && url.host===own.host || url.protocol==='blob:' && url.origin===own.origin || /^data:image\/(jpeg|png|webp);base64,/.test(source)}catch{return false}
}
