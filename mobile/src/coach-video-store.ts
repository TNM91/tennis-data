import type {VideoReviewStore} from '../../components/video/VideoReviewPlatform'
import type {VideoReviewClip} from '../../lib/video-review'
import {coachId} from '../../lib/native-coach-contract'
export function coachVideoStore(owner:string,current:()=>boolean):VideoReviewStore{
 coachId(owner)
 const name='tenaceiq-native-video-v1-'+owner
 const guard=()=>{if(!current())throw Error('Account changed')}
 const open=()=>new Promise<IDBDatabase>((resolve,reject)=>{guard();const r=indexedDB.open(name,1);let blocked=false;r.onupgradeneeded=()=>{r.result.createObjectStore('clips',{keyPath:'id'});r.result.createObjectStore('blobs',{keyPath:'id'})};r.onerror=()=>reject(Error('Clip storage unavailable'));r.onblocked=()=>{blocked=true;reject(Error('Close the other video screen'))};r.onsuccess=()=>{if(blocked||!current()){r.result.close();reject(Error('Account changed'));return}resolve(r.result)}})
 async function operation<T>(stores:string[],write:boolean,action:(tx:IDBTransaction)=>IDBRequest<T>|void){guard();const db=await open();try{return await new Promise<T|undefined>((resolve,reject)=>{guard();const tx=db.transaction(stores,write?'readwrite':'readonly'),request=action(tx);tx.oncomplete=()=>{if(current())resolve(request?.result);else reject(Error('Account changed'))};tx.onerror=tx.onabort=()=>reject(Error('Clip operation not confirmed'))})}finally{db.close()}}
 const read=<T>(key:string,fallback:T):T=>{guard();try{return JSON.parse(localStorage.getItem(name+':'+key)||'null')??fallback}catch{return fallback}}
 const write=(key:string,value:unknown)=>{guard();const raw=JSON.stringify(value);if(raw.length>1000000)throw Error('Clip notes are too large');localStorage.setItem(name+':'+key,raw)}

 type VideoBytes={id:string;blob?:Blob;version?:string;chunks?:number;mime?:string}
 const bytesRow=(id:string)=>operation<VideoBytes>(['blobs'],false,tx=>tx.objectStore('blobs').get(id))
 const chunkKey=(id:string,version:string,index:number)=>JSON.stringify([id,version,index])
 const removeChunks=async(row:VideoBytes|undefined)=>{if(!row?.version||!row.chunks)return;await operation(['blobs'],true,tx=>{for(let i=0;i<row.chunks!;i++)tx.objectStore('blobs').delete(chunkKey(row.id,row.version!,i))})}
 return {
  readAllClips:async()=>{const clips=await operation<VideoReviewClip[]>(['clips'],false,tx=>tx.objectStore('clips').getAll());return (clips??[]).sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt))},
  readClipBlob:async id=>{
   coachId(id);const row=await bytesRow(id);if(row?.blob)return row.blob;if(!row?.version||!row.chunks)return null
   const parts:ArrayBuffer[]=[]
   for(let i=0;i<row.chunks;i++){const part=await operation<{id:string;bytes:ArrayBuffer}>(['blobs'],false,tx=>tx.objectStore('blobs').get(chunkKey(id,row.version!,i)));if(!part?.bytes)throw Error('Clip bytes are incomplete');parts.push(part.bytes)}
   return new Blob(parts,{type:row.mime||'video/webm'})
  },
  saveClip:async(clip,blob)=>{
   coachId(clip.id);if(JSON.stringify(clip).length>500000||blob&&blob.size>500*1024*1024)throw Error('Choose a smaller clip')
   if(!blob){await operation(['clips'],true,tx=>{tx.objectStore('clips').put(clip)});return}
   const old=await bytesRow(clip.id),version=crypto.randomUUID(),chunkSize=4*1024*1024,row:VideoBytes={id:clip.id,version,chunks:Math.ceil(blob.size/chunkSize),mime:blob.type}
   try{
    for(let i=0;i<row.chunks!;i++){guard();const bytes=await blob.slice(i*chunkSize,(i+1)*chunkSize).arrayBuffer();await operation(['blobs'],true,tx=>{tx.objectStore('blobs').put({id:chunkKey(clip.id,version,i),bytes})})}
    await operation(['clips','blobs'],true,tx=>{tx.objectStore('clips').put(clip);tx.objectStore('blobs').put(row)})
   }catch(error){if(current())await removeChunks(row).catch(()=>{});throw error}
   await removeChunks(old).catch(()=>{})
  },
  removeClip:async id=>{coachId(id);const row=await bytesRow(id);await operation(['clips','blobs'],true,tx=>{tx.objectStore('clips').delete(id);tx.objectStore('blobs').delete(id);if(row?.version&&row.chunks)for(let i=0;i<row.chunks;i++)tx.objectStore('blobs').delete(chunkKey(id,row.version,i))})},
  readLocalNotifications:()=>read('notifications',[]),writeLocalNotifications:v=>write('notifications',v.slice(0,40)),readLocalPracticeRecords:()=>read('practice',{}),writeLocalPracticeRecords:v=>write('practice',v),readLocalWatchedCoachMarks:()=>read('watched',{}),writeLocalWatchedCoachMarks:v=>write('watched',v)
 }
}
