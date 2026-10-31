import type {SupabaseClient} from '@supabase/supabase-js'
import {CapacitorHttp} from '@capacitor/core'
import {scenarioOwner} from './captain-scenarios-data'
import {coachId,coachRecord} from '../../lib/native-coach-contract'
import type {CoachSend} from './coach-workspace-data'

export type CoachChatConnection={id:string;name:string;role:'coach'|'player'}
export function readCoachChatConnections(value:unknown,owner:string):{connections:CoachChatConnection[];more:boolean}{
 const body=coachRecord(value)
 if(body.ok!==true||body.owner!==owner||!Array.isArray(body.connections)||body.connections.length>100||typeof body.more!=='boolean'||JSON.stringify(body).length>100000)throw Error('Coach conversations could not be confirmed.')
 const ids=new Set<string>()
 const connections=body.connections.map(value=>{
  const row=coachRecord(value),id=coachId(row.id)
  if(ids.has(id)||typeof row.name!=='string'||!row.name.trim()||row.name.length>200||!['coach','player'].includes(String(row.role)))throw Error('Coach conversations could not be confirmed.')
  ids.add(id);return {id,name:row.name,role:row.role as CoachChatConnection['role']}
 })
 return {connections,more:body.more}
}
export async function loadCoachChatConnections(client:SupabaseClient,owner:string,current:()=>boolean,send:CoachSend=(_method,options)=>CapacitorHttp.get(options)){
 const session=await scenarioOwner(client,owner,current)
 const response=await send('GET',{url:'https://www.tenaceiq.com/api/mobile/coach/messages',headers:{Authorization:'Bearer '+session.access_token,'Cache-Control':'no-store'},disableRedirects:true,webFetchExtra:{cache:'no-store'},responseType:'json',connectTimeout:12000,readTimeout:30000})
 await scenarioOwner(client,owner,current)
 if(response.status!==200)throw Error('Coach conversations are unavailable. Try refreshing.')
 return readCoachChatConnections(response.data,owner)
}
