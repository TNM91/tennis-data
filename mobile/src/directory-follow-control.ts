import type {SupabaseClient} from '@supabase/supabase-js'
import {html} from './match-details'
import {MEMBERSHIP_TIERS} from '../../lib/product-story'
import {directoryFollowStatus,saveDirectoryFollow,type DirectoryFollow} from './directory-follow-data'
export function showDirectoryFollow(host:HTMLElement,client:SupabaseClient,item:DirectoryFollow,current:()=>boolean){
 let busy=false,version=0,state:Awaited<ReturnType<typeof directoryFollowStatus>>|null=null,confirm=false
 const valid=()=>current()&&host.isConnected
 const retry=(message:string)=>{
  host.innerHTML=`<p role="alert">${html(message)}</p><button type="button" class="secondary">Check follow status</button>`
  const button=host.querySelector<HTMLButtonElement>('button')!,stamp=++version
  button.onclick=()=>{if(valid()&&!busy&&stamp===version)void load(true)}
 }
 const render=(focus=false)=>{
  const stamp=++version
  if(!state?.canAdd){host.innerHTML=`<p tabindex="-1">Following teams and leagues is included with ${html(MEMBERSHIP_TIERS.player_plus.name)} access.</p>`;if(focus)host.querySelector<HTMLElement>('p')?.focus({preventScroll:true});return}
  host.innerHTML=confirm?`<p>Remove ${html(item.entity_name)} from Following?</p><button type="button" class="secondary" data-save>Confirm unfollow</button><button type="button" class="secondary" data-cancel>Keep following</button>`:`<button type="button" class="secondary" data-save>${state.following?'Unfollow':'Follow'} ${item.entity_type}</button><p role="status">${state.following?'Saved to Following.':''}</p>`
  const button=host.querySelector<HTMLButtonElement>('[data-save]')!,cancel=host.querySelector<HTMLButtonElement>('[data-cancel]')
  const actionable=()=>valid()&&!busy&&stamp===version&&button.isConnected
  if(cancel)cancel.onclick=()=>{if(!actionable())return;confirm=false;render(true)}
  button.onclick=async()=>{
   if(!actionable()||!state)return
   if(state.following&&!confirm){confirm=true;render(true);return}
   busy=true;button.disabled=true;if(cancel)cancel.disabled=true
   try{await saveDirectoryFollow(client,item,!state.following,state.ownerId,()=>valid()&&stamp===version);if(!valid()||stamp!==version)return;confirm=false;busy=false;await load(true)}
   catch{if(valid()&&stamp===version){confirm=false;retry('Could not confirm the change. Check follow status before trying again.');host.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true})}}
   finally{busy=false}
  }
  if(focus)button.focus({preventScroll:true})
 }
 const load=async(focus=false)=>{
  if(busy||!valid())return
  busy=true;const stamp=++version;state=null;host.innerHTML='<p role="status">Checking follow status...</p>'
  try{const result=await directoryFollowStatus(client,item,()=>valid()&&stamp===version);if(!valid()||stamp!==version)return;state=result;render(focus)}
  catch{if(valid()&&stamp===version){retry('Could not check follows. Check your connection and try again.');if(focus)host.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true})}}
  finally{busy=false}
 }
 void load()
}
