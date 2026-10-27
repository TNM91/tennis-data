import {Camera,MediaTypeSelection} from '@capacitor/camera'
import {CapacitorHttp,type HttpOptions,type HttpResponse} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import {prepareScreenshotForUpload} from '../../lib/data-assist-image-preparation'
import {buildFileFingerprint} from '../../lib/data-assist-file-fingerprint'
import {localCameraSource} from './chat-photos'
import type {UploadIntent} from './data-import-upload'
export async function requireScorecardPhotos(client:SupabaseClient,owner:string,current:()=>boolean,send:(options:HttpOptions)=>Promise<HttpResponse>=o=>CapacitorHttp.get(o)){
 const own=async()=>{if(!current()||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(owner))throw Error('This upload is no longer open.');const s=await client.auth.getSession();if(s.error||s.data.session?.user.id!==owner||!s.data.session.access_token||!current())throw Error('Sign in again before choosing a photo.');return s.data.session.access_token}
 const token=await own();const r=await send({url:'https://www.tenaceiq.com/api/data-assist/ocr',headers:{Authorization:'Bearer '+token,'Cache-Control':'no-store'},webFetchExtra:{cache:'no-store'},disableRedirects:true,responseType:'json',connectTimeout:12000,readTimeout:12000});await own()
 if(r.status!==200||r.data?.ok!==true||r.data?.canReadScorecardPhotos!==true)throw Error('Scorecard photo reading is unavailable right now. Use a TennisLink export or try again later.')
}
export async function pickScorecardPhoto(source:'camera'|'library',current:()=>boolean):Promise<File>{
 const options={quality:90,targetWidth:2000,targetHeight:4000,correctOrientation:true,includeMetadata:false,webUseInput:true}
 const media=source==='camera'?await Camera.takePhoto({...options,saveToGallery:false}):(await Camera.chooseFromGallery({...options,mediaType:MediaTypeSelection.Photo,allowMultipleSelection:false,limit:1})).results[0]
 if(!current())throw Error('This upload is no longer open.')
 if(!media?.webPath)throw Error('No photo selected.')
 if(!localCameraSource(media.webPath,location.href))throw Error('Photo source unavailable.')
 let blob=localScorecardPhotoBlob(media.webPath)
 if(!blob){const response=await fetch(media.webPath,{redirect:'error',signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error('Photo could not be opened.');blob=await response.blob()}
 if(!current())throw Error('This upload is no longer open.')
 if(!['image/jpeg','image/png','image/webp'].includes(blob.type)||!blob.size||blob.size>10*1024*1024)throw Error('Choose a JPEG, PNG or WebP scorecard photo, 10 MB or smaller.')
 return new File([blob],'scorecard-photo.'+(blob.type==='image/jpeg'?'jpg':blob.type==='image/png'?'png':'webp'),{type:blob.type})
}
export async function prepareScorecardPhoto(file:File,owner:string):Promise<UploadIntent>{
 if(!file.size||file.size>10*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choose a JPEG, PNG or WebP scorecard photo, 10 MB or smaller.')
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(owner))throw Error('Sign in again before choosing a photo.')
 const prepared=await prepareScreenshotForUpload(file,'scorecard',{minSide:280,maxPixels:64000000,timeoutMs:12000,alwaysReencode:true})
 if(prepared.file.type!=='image/jpeg'||!prepared.file.size||prepared.file.size>10*1024*1024||prepared.dimensions.width<280||prepared.dimensions.height<280)throw Error('Choose a closer, readable photo of the full scorecard.')
 return {owner,batchId:crypto.randomUUID(),draftId:crypto.randomUUID(),screenshotId:crypto.randomUUID(),file:prepared.file,kind:'scorecard',fingerprint:await buildFileFingerprint(prepared.file),extension:'jpg',mime:'image/jpeg',photo:prepared.dimensions}
}

export function localScorecardPhotoBlob(source:string):Blob|null{
 if(!source.startsWith('data:'))return null
 const match=/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(source)
 if(!match||match[2].length>13981016)throw Error('Choose a JPEG, PNG or WebP photo, 10 MB or smaller.')
 let binary:string
 try{binary=atob(match[2])}catch{throw Error('This photo could not be opened.')}
 if(binary.length>10*1024*1024)throw Error('Choose a photo, 10 MB or smaller.')
 const bytes=new Uint8Array(binary.length)
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i)
 return new Blob([bytes],{type:match[1]})
}
