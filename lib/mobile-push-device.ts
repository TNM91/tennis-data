import {createHash} from 'node:crypto'
import type {SupabaseClient} from '@supabase/supabase-js'
export function parsePushDevice(value:unknown){
 const row=value && typeof value==='object'?value as Record<string,unknown>:{}
 if(typeof row.installationId!=='string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(row.installationId) || typeof row.secret!=='string' || !/^[a-f0-9]{64}$/.test(row.secret) || typeof row.enabled!=='boolean')return null
 if(row.enabled && (typeof row.token!=='string' || !/^[a-f0-9]{64,256}$/.test(row.token)))return null
 return {installationId:row.installationId,secretHash:createHash('sha256').update(row.secret).digest('hex'),token:row.enabled?row.token as string:'',enabled:row.enabled}
}
export async function bindPushDevice(service:SupabaseClient,userId:string,value:unknown){
 const parsed=parsePushDevice(value)
 if(!parsed)return {ok:false,status:400}
 const {data,error}=await service.rpc('bind_native_push_device',{p_installation:parsed.installationId,p_secret_hash:parsed.secretHash,p_profile:userId,p_token:parsed.token,p_enabled:parsed.enabled})
 return error?{ok:false,status:503}:data===true?{ok:true,status:200}:{ok:false,status:409}
}
