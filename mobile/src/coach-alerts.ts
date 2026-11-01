import {CapacitorHttp} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import {scenarioOwner} from './captain-scenarios-data'
import type {CoachSend} from './coach-workspace-data'
type Preferences={enabled:boolean;available:boolean}
export async function coachAlertRequest(client:SupabaseClient,owner:string,current:()=>boolean,enabled?:boolean,send:CoachSend=(method,options)=>method==='POST'?CapacitorHttp.post(options):CapacitorHttp.get(options)):Promise<Preferences>{
 const session=await scenarioOwner(client,owner,current)
 const response=await send(enabled===undefined?'GET':'POST',{url:'https://www.tenaceiq.com/api/mobile/coach/alerts',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json','Cache-Control':'no-store'},disableRedirects:true,responseType:'json',webFetchExtra:{cache:'no-store'},connectTimeout:12000,readTimeout:15000,...(enabled===undefined?{}:{data:{enabled}})})
 await scenarioOwner(client,owner,current)
 const body=response.data
 if(response.status!==200||!body||body.ok!==true||body.owner!==owner||typeof body.enabled!=='boolean'||typeof body.available!=='boolean'||enabled!==undefined&&body.enabled!==enabled)throw Error('Coach alert choice could not be confirmed.')
 return {enabled:body.enabled,available:body.available}
}
export function createCoachAlerts(client:SupabaseClient,registered:()=>boolean,send?:CoachSend){
 let owner:string|null=null,epoch=0,host:HTMLElement|null=null,value:Preferences|null=null,busy=false,notice='',disposed=false,uncertain=false
 const valid=(user:string,version:number)=>!disposed&&owner===user&&epoch===version
 const render=()=>{
  if(!host?.isConnected||!owner||disposed)return
  host.replaceChildren();host.setAttribute('aria-label','Coach message notifications');host.dataset.coachAlerts=''
  const title=document.createElement('h3');title.textContent='Coach & player alerts'
  const description=document.createElement('p');description.textContent='Choose iPhone alerts for private Coach conversations. This account choice applies to iPhones where chat notifications are on. Message text stays private.'
  const status=document.createElement('p');status.setAttribute('role','status');status.textContent=notice||(value?value.enabled?'Coach alerts are on for your account.':'Coach alerts are off.':'Checking Coach alerts…')
  const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent=uncertain||!value?'Check Coach alerts':value.enabled?'Turn off Coach alerts':'Turn on Coach alerts'
  button.disabled=busy||Boolean(value&&!value.enabled&&!uncertain&&(!registered()||!value.available))
  button.onclick=()=>{void run(value&&!uncertain?!value.enabled:undefined)}
  host.append(title,description,status,button)
  if(value&&!registered()){const hint=document.createElement('p');hint.textContent='Enable chat notifications on this iPhone to receive alerts here.';host.append(hint)}
  else if(value&&!value.available){const hint=document.createElement('p');hint.textContent='iPhone delivery is temporarily unavailable. You can still turn Coach alerts off.';host.append(hint)}
 }
 const run=async(enabled?:boolean)=>{
  if(disposed||!owner||busy||enabled===true&&!registered())return
  const user=owner,version=epoch;busy=true;notice=enabled===undefined?'Checking Coach alerts…':'Saving your choice…';render()
  try{const next=await coachAlertRequest(client,user,()=>valid(user,version),enabled,send);if(valid(user,version)){value=next;notice='';uncertain=false}}
  catch{if(valid(user,version)){uncertain=true;notice=enabled===undefined?'Coach alerts couldn’t load. Check again when you’re connected.':'Your choice wasn’t confirmed. Check Coach alerts before trying again.'}}
  finally{if(valid(user,version)){busy=false;render()}}
 }
 return {
  mount(element:HTMLElement){host=element;render()},
  setOwner(next:string|null){if(disposed||next===owner)return;owner=next;epoch++;value=null;busy=false;notice='';uncertain=false;if(next)void run();else host?.replaceChildren()},
  dispose(){disposed=true;epoch++;owner=null;host?.replaceChildren();host=null;value=null},
 }
}
