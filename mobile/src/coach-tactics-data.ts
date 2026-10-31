import {CapacitorHttp} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import {scenarioOwner} from './captain-scenarios-data'
import type {CoachSend} from './coach-workspace-data'
import {readNativeTactics,readTacticsIntent,type TacticsIntent,type NativeTacticsSnapshot} from '../../lib/native-tactics-contract'

export class TacticsLibrary{
 snapshot:NativeTacticsSnapshot|null=null
 pending:TacticsIntent|null=null
 canRetry=false
 constructor(private client:SupabaseClient,private owner:string,private current:()=>boolean,private send:CoachSend=(method,options)=>method==='GET'?CapacitorHttp.get(options):CapacitorHttp.post(options)){}
 private async request(intent:TacticsIntent|null,id=''){
  const session=await scenarioOwner(this.client,this.owner,this.current)
  const response=await this.send(intent?'POST':'GET',{url:'https://www.tenaceiq.com/api/mobile/coach/tactics'+(!intent&&id?'?'+new URLSearchParams({id}):''),headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json','Cache-Control':'no-store'},webFetchExtra:{cache:'no-store'},disableRedirects:true,responseType:'json',connectTimeout:12000,readTimeout:30000,...(intent?{data:intent}:{})})
  await scenarioOwner(this.client,this.owner,this.current)
  if(response.status!==200)throw Error(response.status===403?'Coach access is required to open this library.':response.status===401?'Sign in again to open your boards.':response.status===409?'The saved board changed. Check its current version.':'Board library could not be confirmed. Check saved boards before retrying.')
  this.snapshot=readNativeTactics(response.data,this.owner);return this.snapshot
 }
 load(){return this.request(null)}
 private matches(snapshot:NativeTacticsSnapshot,intent:TacticsIntent){return intent.action==='delete'?snapshot.detail===null:snapshot.detail?.updatedAt!==intent.expectedUpdatedAt&&JSON.stringify(snapshot.detail?.scenario)===JSON.stringify(intent.scenario)}
 async save(intent:TacticsIntent){
  if(this.pending)throw Error('Check saved boards before making another change.')
  this.pending=Object.freeze(readTacticsIntent(intent));this.canRetry=false
  return this.writePending()
 }
 private async writePending(){
  const intent=this.pending;if(!intent)throw Error('Review your board again')
  this.canRetry=false
  const result=await this.request(intent,intent.action==='save'?intent.scenario.id:intent.id)
  if(!this.matches(result,intent))throw Error('Save not confirmed. Check saved boards.')
  this.pending=null;return result
 }
 async check(){
  const intent=this.pending;if(!intent)return {snapshot:await this.load(),confirmed:true}
  const id=intent.action==='save'?intent.scenario.id:intent.id,result=await this.request(null,id),confirmed=this.matches(result,intent)
  if(confirmed)this.pending=null
  this.canRetry=!confirmed&&(result.detail?.updatedAt??null)===intent.expectedUpdatedAt
  return {snapshot:result,confirmed}
 }
 retry(){if(!this.pending||!this.canRetry)throw Error('Review the saved board first');return this.writePending()}
 discard(){this.pending=null;this.canRetry=false}
}
