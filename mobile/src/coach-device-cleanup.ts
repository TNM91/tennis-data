import {coachId} from '../../lib/native-coach-contract'
import {cancelCoachFile} from './native-coach-files'
export async function clearCoachDeviceData(owner:string){
 coachId(owner)
 await cancelCoachFile(owner).catch(()=>{})
 const name='tenaceiq-native-video-v1-'+owner
 for(const key of ['notifications','practice','watched'])localStorage.removeItem(name+':'+key)
 const video=new Promise<void>((resolve,reject)=>{const request=indexedDB.deleteDatabase(name);request.onsuccess=()=>resolve();request.onerror=request.onblocked=()=>reject(Error('Close the other video screen to finish device cleanup'))})
 const boards=new Promise<void>((resolve,reject)=>{const request=indexedDB.open('tenaceiq-native-coach-v1',1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('records'))request.result.createObjectStore('records')};let blocked=false;request.onerror=request.onblocked=()=>{blocked=true;reject(Error('Coach device cleanup is unavailable'))};request.onsuccess=()=>{const db=request.result;if(blocked){db.close();return}const tx=db.transaction('records','readwrite'),cursor=tx.objectStore('records').openKeyCursor();cursor.onsuccess=()=>{const row=cursor.result;if(!row)return;try{const key=JSON.parse(String(row.key));if(Array.isArray(key)&&key[0]===owner)tx.objectStore('records').delete(row.primaryKey)}catch{}row.continue()};tx.oncomplete=()=>{db.close();resolve()};tx.onerror=tx.onabort=()=>{db.close();reject(Error('Coach device cleanup was not confirmed'))}}})
 await Promise.all([video,boards])
}
