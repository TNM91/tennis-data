import type {SupabaseClient} from '@supabase/supabase-js'
import {createCoachActivityHandoff} from '../../mobile/src/coach-activity-handoff'
import {createCoachAlertHandoff} from '../../mobile/src/coach-alert-handoff'

const host=document.createElement('aside')
document.body.append(host)
const state={owner:'owner-one',revision:0,blocked:false,autoOpen:false,holdGuard:false,holdResolve:false,fail:false,offset:0,
 reads:[] as string[],opens:[] as string[],confirm:()=>{},release:()=>{},receive:(id:string)=>{void id},resume:()=>{},switchOwner:()=>{},
 capture:()=>{},clickOldOpen:()=>{},clickOldDismiss:()=>{},dispose:()=>{}}
const guard=(open:()=>void)=>{if(state.holdGuard)state.confirm=open;else open()}
const resolve=async(id:string)=>{
 state.reads.push(id)
 if(state.holdResolve){state.holdResolve=false;await new Promise<void>(complete=>{state.release=complete})}
 if(state.fail)throw Error('Synthetic connection failure')
 return id
}
const client={} as SupabaseClient
const common=[host,client,()=>state.owner,()=>state.revision,()=>state.blocked,guard] as const
const handoff=new URL(location.href).searchParams.get('kind')==='activity'
 ?createCoachActivityHandoff(...common,activity=>state.opens.push(activity.assignment),async(_client,_owner,_current,id)=>({kind:'assignment',student:'student-one',assignment:await resolve(id)}),()=>Date.now()+state.offset,()=>state.autoOpen)
 :createCoachAlertHandoff(...common,student=>state.opens.push(student),async(_client,_owner,_current,action)=>{
  if(action.kind!=='conversation')throw Error('Expected a synthetic conversation')
  return {kind:'coach-message',student:await resolve(action.id),label:'Open Coach messages'}
 },()=>Date.now()+state.offset,()=>state.autoOpen)
state.receive=id=>handoff.receive(id,state.owner)
state.resume=handoff.resume
state.switchOwner=()=>{state.owner='owner-two';handoff.syncOwner()}
state.dispose=()=>handoff.dispose()
state.capture=()=>{
 const [open,dismiss]=Array.from(host.querySelectorAll('button'))
 state.clickOldOpen=()=>open.click()
 state.clickOldDismiss=()=>dismiss.click()
}
Object.assign(window,{coachingHandoffFixture:state})
