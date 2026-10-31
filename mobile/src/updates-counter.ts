import type {SupabaseClient} from '@supabase/supabase-js'
import {countUnreadUpdates} from './updates-data'

/** One read per account entry, plus explicit inbox refresh/read actions. No polling. */
export function createUpdatesCounter(client:SupabaseClient,changed:(count:number|null)=>void){
  let owner:string|null=null,request=0
  const refresh=async()=>{
    const who=owner,version=++request
    if(!who)return null
    const active=()=>owner===who&&version===request
    try{const count=await countUnreadUpdates(client,who,active);if(active())changed(count);return active()?count:null}
    catch{if(active())changed(null);return null}
  }
  return {refresh,setOwner(next:string|null){if(next===owner)return;owner=next;request++;changed(null);if(next)void refresh()},clear(){owner=null;request++;changed(null)}}
}
