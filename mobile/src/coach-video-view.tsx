import {createRoot,type Root} from 'react-dom/client'
import type {SupabaseClient} from '@supabase/supabase-js'
import {Clipboard} from '@capacitor/clipboard'
import VideoReviewClient from '../../app/video-review/video-review-client'
import type {VideoReviewPlatform} from '../../components/video/VideoReviewPlatform'
import {coachVideoStore} from './coach-video-store'
import {loadCoachWorkspace,type CoachSend} from './coach-workspace-data'
import {exportCoachFile,cancelCoachFile} from './native-coach-files'
import {html} from './match-details'
import './coach-premium.css'
export function openCoachVideo(client:SupabaseClient,owner:string,current:()=>boolean,trigger?:HTMLElement,send?:CoachSend){
 const dialog=document.createElement('dialog');dialog.className='native-coach-screen native-coach-video';dialog.setAttribute('aria-label','Video review')
 dialog.innerHTML='<header class="native-coach-header"><div><small>Coach studio</small><h1 tabindex="-1">Video review</h1></div><button class="secondary" data-video-close>Close</button></header><div class="native-coach-notice" role="status">Loading your players…</div><div class="native-coach-video-host"></div>'
 let disposed=false,root:Root|null=null,decision:HTMLDialogElement|null=null,settle:((value:boolean)=>void)|null=null
 const active=()=>!disposed&&current(),status=dialog.querySelector<HTMLElement>('[role=status]')!,host=dialog.querySelector<HTMLElement>('.native-coach-video-host')!
 const finish=(answer:boolean)=>{const r=settle;settle=null;decision?.close();decision?.remove();decision=null;r?.(answer)}
 const confirm=(message:string)=>new Promise<boolean>(resolve=>{finish(false);settle=resolve;decision=document.createElement('dialog');decision.className='native-coach-decision';decision.setAttribute('aria-label','Confirm video action');decision.innerHTML='<h2 tabindex="-1">Confirm video action</h2><p>'+html(message)+'</p><button data-confirm>Continue</button><button class="secondary" data-cancel>Keep working</button>';decision.querySelector('[data-confirm]')?.addEventListener('click',()=>finish(true));decision.querySelector('[data-cancel]')?.addEventListener('click',()=>finish(false));decision.oncancel=e=>{e.preventDefault();finish(false)};document.body.append(decision);decision.showModal();decision.querySelector<HTMLElement>('h2')?.focus()})
 const dispose=()=>{if(disposed)return;disposed=true;finish(false);root?.unmount();root=null;host.replaceChildren();void cancelCoachFile(owner).catch(()=>{});dialog.close();dialog.remove();if(current()&&trigger?.isConnected)trigger.focus({preventScroll:true})}
 const requestLeave=(next?:()=>void)=>{void confirm('Close video review? Saved clips and marks remain on this device. Finish recording and save your current draft before closing.').then(ok=>{if(ok&&active()){dispose();next?.()}})}
 const back=()=>{if(decision)finish(false);else requestLeave();return true}
 const begin=async()=>{try{const roster=await loadCoachWorkspace(client,owner,active,'',send);if(!active())return;const store=coachVideoStore(owner,active),saved=await store.readAllClips();if(!active())return;const platform:VideoReviewPlatform={current:active,initialStage:saved.length?'review':'record',store,targets:[...roster.students.filter(s=>s.status!=='paused').map(s=>({id:s.id,name:s.name,label:s.name,detail:s.linked?'Connected student':'Coach roster'})),{id:'guest',name:'Guest player',label:'Guest player',detail:'Private device clip'}],exportFile:(blob,name)=>exportCoachFile(owner,active,blob,name),copy:async text=>{if(!active())throw Error('Account changed');await Clipboard.write({string:text})},confirm};root=createRoot(host);root.render(<VideoReviewClient platform={platform}/>);status.textContent=''}catch{if(active()){status.textContent='Video review could not open. Reconnect and refresh.';host.innerHTML='<button class="secondary" data-retry>Retry video review</button>';host.querySelector('[data-retry]')?.addEventListener('click',()=>{host.replaceChildren();void begin()})}}}
 dialog.querySelector('[data-video-close]')?.addEventListener('click',()=>requestLeave());dialog.oncancel=e=>{e.preventDefault();back()};document.body.append(dialog);dialog.showModal();dialog.querySelector<HTMLElement>('h1')?.focus();void begin()
 return {dispose,requestLeave,back,isOpen:()=>!disposed}
}
