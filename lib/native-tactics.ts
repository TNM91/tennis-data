import type {SupabaseClient} from '@supabase/supabase-js'
import {NativeCoachFault} from './native-coach'
import {readTacticalBoard,readNativeTactics,type TacticsIntent} from './native-tactics-contract'
const fields='id,user_id,name,focus,category,scenario_json,updated_at'
const map=(row:Record<string,unknown>,owner:string)=>{if(row.user_id!==owner)throw Error('Board ownership changed');const scenario=readTacticalBoard(row.scenario_json);if(scenario.id!==row.id)throw Error('Board identity changed');return {id:scenario.id,name:scenario.name,focus:scenario.focus,scenario,updatedAt:row.updated_at}}
export async function loadNativeTactics(client:SupabaseClient,owner:string,id=''){
 const selected=id?client.from('tactical_scenarios').select(fields).eq('user_id',owner).eq('id',id).abortSignal(AbortSignal.timeout(12000)).maybeSingle():null
 const [result,one]=await Promise.all([client.from('tactical_scenarios').select(fields).eq('user_id',owner).order('updated_at',{ascending:false}).limit(51).abortSignal(AbortSignal.timeout(12000)),selected])
 if(result.error||one?.error)throw Error('Board library read failed')
 const scenarios=[];let bytes=0
 for(const row of (result.data||[]).slice(0,50)){const board=map(row,owner),length=JSON.stringify(board).length;if(bytes+length>2600000)break;scenarios.push(board);bytes+=length}
 return readNativeTactics({ok:true,owner,scenarios,more:(result.data?.length||0)>scenarios.length,detail:one?.data?map(one.data,owner):null},owner)
}
export async function saveNativeTactics(client:SupabaseClient,owner:string,intent:TacticsIntent){
 const id=intent.action==='save'?intent.scenario.id:intent.id
 if(intent.action==='save'&&intent.expectedUpdatedAt===null){
  const s=intent.scenario,{error}=await client.from('tactical_scenarios').insert({id,user_id:owner,name:s.name,focus:s.focus,category:s.category,scenario_json:s,updated_at:new Date().toISOString()})
  if(error)throw error.code==='23505'?new NativeCoachFault(409,'This board may already be saved. Check the library before saving again.'):Error('Board save not confirmed')
 }else{
  const expected=intent.expectedUpdatedAt!
  const operation=intent.action==='delete'?client.from('tactical_scenarios').delete():client.from('tactical_scenarios').update({name:intent.scenario.name,focus:intent.scenario.focus,category:intent.scenario.category,scenario_json:intent.scenario,updated_at:new Date(Math.max(Date.now(),Date.parse(expected)+1)).toISOString()})
  const saved=await operation.eq('user_id',owner).eq('id',id).eq('updated_at',expected).select('id').abortSignal(AbortSignal.timeout(12000)).maybeSingle()
  if(saved.error)throw Error('Board update not confirmed')
  if(!saved.data)throw new NativeCoachFault(409,'The saved board changed. Load its current version before editing it.')
 }
 return loadNativeTactics(client,owner,id)
}
