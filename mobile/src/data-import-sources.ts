import type {SupabaseClient} from '@supabase/supabase-js'
import {prepareScreenshotForUpload} from '../../lib/data-assist-image-preparation'
import {loadImportBatch,type ImportBatch} from './data-imports-data'
import {html} from './match-details'
export type ImportSource={id:string;batch:string;owner:string;order:number;name:string;mime:string;size:number;bucket:string;path:string;width:number|null;height:number|null}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const photoMimes=['image/jpeg','image/png','image/webp']
export function readImportSources(value:unknown,batch:ImportBatch):ImportSource[]{
 if(!Array.isArray(value)||value.length>80||value.length!==batch.files||!uuid.test(batch.owner)||!uuid.test(batch.id))throw Error('Source files are incomplete. Refresh this upload or open Data Assist.')
 const seen=new Set<string>(),orders=new Set<number>()
 const items=value.map(raw=>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Source files unavailable.')
  const r=raw as Record<string,unknown>,str=(v:unknown,max:number)=>{if(typeof v!=='string'||v.length>max)throw Error('Source files unavailable.');return v}
  const id=str(r.id,36),path=str(r.storage_path,500),size=r.file_size_bytes,order=r.upload_order
  if(!uuid.test(id)||seen.has(id)||r.batch_id!==batch.id||r.submitted_by_user_id!==batch.owner||r.storage_bucket!=='data-assist-screenshots'||!path.startsWith(batch.owner+'/'+batch.id+'/')||!/^[-a-zA-Z0-9_]+\.[a-zA-Z0-9]+$/.test(path.split('/')[2]||'')||path.split('/').length!==3||!Number.isSafeInteger(size)||Number(size)<1||Number(size)>10485760||!Number.isInteger(order)||Number(order)<1||Number(order)>80||orders.has(Number(order)))throw Error('Source files do not match this upload. Refresh or open Data Assist.')
  seen.add(id);orders.add(Number(order))
  const dim=(v:unknown)=>v==null?null:typeof v==='number'&&Number.isSafeInteger(v)&&v>0&&v<=64000000?v:null
  return {id,batch:batch.id,owner:batch.owner,order:Number(order),name:str(r.file_name,500)||'Source file',mime:str(r.mime_type,100),size:Number(size),bucket:'data-assist-screenshots',path,width:dim(r.image_width),height:dim(r.image_height)}
 })
 return items.sort((a,b)=>a.order-b.order)
}
export function canPreviewImportSource(source:ImportSource){return photoMimes.includes(source.mime)&&Boolean(source.width&&source.height&&source.width*source.height<=64000000)}
async function own(client:SupabaseClient,owner:string,current:()=>boolean){const {data,error}=await client.auth.getSession();if(error||data.session?.user.id!==owner||!current())throw Error('Close this upload and sign in again.')}
export async function loadImportSources(client:SupabaseClient,batch:ImportBatch,current:()=>boolean){
 await own(client,batch.owner,current);const fresh=await loadImportBatch(client,batch.owner,batch.id,current)
 if(fresh.kind!==batch.kind||fresh.files!==batch.files)throw Error('This upload changed. Refresh its saved draft.')
 const r=await client.from('data_assist_screenshots').select('id,batch_id,submitted_by_user_id,upload_order,file_name,mime_type,file_size_bytes,storage_bucket,storage_path,image_width,image_height').eq('submitted_by_user_id',batch.owner).eq('batch_id',batch.id).order('upload_order',{ascending:true}).limit(81).abortSignal(AbortSignal.timeout(12000))
 await own(client,batch.owner,current);if(r.error)throw Error('Source files could not be loaded. Try again when connected.')
 return readImportSources(r.data,fresh)
}
export function importPhotoSignature(bytes:Uint8Array,mime:string){
 return mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:mime==='image/png'?bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10':mime==='image/webp'?String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP':false
}
export async function loadImportSourcePhoto(client:SupabaseClient,batch:ImportBatch,source:ImportSource,current:()=>boolean,prepare=async(file:File)=>(await prepareScreenshotForUpload(file,'scorecard',{minSide:1,maxPixels:64000000,timeoutMs:12000,alwaysReencode:true})).file,signal?:AbortSignal){
 if(source.owner!==batch.owner||source.batch!==batch.id||!canPreviewImportSource(source))throw Error('This source photo cannot be previewed here. Open Data Assist.')
 const latest=(await loadImportSources(client,batch,current)).find(s=>s.id===source.id)
 if(!latest||JSON.stringify(latest)!==JSON.stringify(source))throw Error('This saved source changed. Reload source files before opening it.')
 await own(client,batch.owner,current)
 const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort()
 const timer=setTimeout(abort,30000)
 try{
  const r=await client.storage.from(source.bucket).download(source.path,{}, {signal:controller.signal,cache:'no-store'})
  await own(client,batch.owner,current)
  if(r.error||!r.data||r.data.size!==source.size||r.data.size>10485760||!importPhotoSignature(new Uint8Array(await r.data.slice(0,12).arrayBuffer()),source.mime))throw Error('This source photo could not be verified. Open Data Assist.')
  const file=await prepare(new File([r.data],source.name,{type:source.mime}));await own(client,batch.owner,current)
  if(file.type!=='image/jpeg'||!file.size||file.size>10485760)throw Error('Photo preview unavailable.')
  return file
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort)}
}
export function importSourcesHtml(sources:ImportSource[]|null,preview:{id:string;url:string;zoom?:boolean}|null){
 if(preview&&!preview.url.startsWith('blob:'))throw Error('Photo preview unavailable.')
 return '<section class="import-sources"><h2 tabindex="-1" data-import-sources-heading>Saved source files</h2><p>Compare your original photo with the extracted rows above. Excel and HTML source files open in Data Assist.</p><button type="button" class="secondary" data-import-sources-load>'+ (sources?'Reload source files':'Load source files')+'</button>'+(sources?'<ol>'+sources.map(s=>'<li><strong>'+html(s.name)+'</strong><p>File '+s.order+' &middot; '+Math.ceil(s.size/1024)+' KB &middot; '+html(s.mime)+'</p>'+(canPreviewImportSource(s)?'<button type="button" class="secondary" data-import-source-photo="'+html(s.id)+'">View source photo '+s.order+'</button>':'<p>Preview this file in Data Assist.</p>')+'</li>').join('')+'</ol>'+(!sources.length?'<p>No source files are saved for this upload.</p>':''):'')+(preview?'<figure class="'+(preview.zoom?'source-photo-zoomed':'')+'"><div class="source-photo-frame"><img src="'+html(preview.url)+'" alt="Saved source photo for this upload"></div><figcaption>Photo preview. Check names, dates and scores against the extracted rows.</figcaption></figure><button type="button" class="secondary" data-import-source-zoom>'+ (preview.zoom?'Fit photo to screen':'Enlarge source photo')+'</button>'+(preview.zoom?'<p>Drag within the photo to inspect names and scores.</p>':'')+'<button type="button" class="secondary" data-import-source-hide>Hide source photo</button>':'')+'</section>'
}
