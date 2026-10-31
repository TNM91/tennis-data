import {coachId} from '../../lib/native-coach-contract'

// Account-scoped app content. Authentication credentials stay in the native vault.
export function coachDeviceStore(owner:string,current:()=>boolean){
 coachId(owner)
 const allowed=new Set(['tactics-draft','tactics-library','lesson-draft'])
 const open=()=>new Promise<IDBDatabase>((resolve,reject)=>{
  if(!current()){reject(Error('Account changed'));return}
  let settled=false
  const request=indexedDB.open('tenaceiq-native-coach-v1',1)
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('records'))request.result.createObjectStore('records')}
  request.onerror=()=>reject(Error('Device storage unavailable'));request.onblocked=()=>{settled=true;reject(Error('Close the other Coach screen and try again'))}
  request.onsuccess=()=>{if(settled){request.result.close();return}if(!current()){request.result.close();reject(Error('Account changed'))}else resolve(request.result)}
 })
 async function operate(key:string,value?:unknown){
  if(!allowed.has(key)||!current())throw Error('Account changed')
  if(value!==undefined&&JSON.stringify(value).length>3000000)throw Error('Use a smaller device library')
  const db=await open()
  try{return await new Promise<unknown>((resolve,reject)=>{
   if(!current()){reject(Error('Account changed'));return}
   const transaction=db.transaction('records',value===undefined?'readonly':'readwrite'),store=transaction.objectStore('records'),id=JSON.stringify([owner,key])
   const request=value===undefined?store.get(id):store.put(value,id)
   transaction.oncomplete=()=>current()?resolve(request.result??null):reject(Error('Account changed'))
   transaction.onabort=transaction.onerror=()=>reject(Error('Device save not confirmed'))
  })}finally{db.close()}
 }
 return {read:(key:string)=>operate(key),write:(key:string,value:unknown)=>operate(key,value)}
}
