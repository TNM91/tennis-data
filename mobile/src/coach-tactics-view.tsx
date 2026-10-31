import {createRoot,type Root} from 'react-dom/client'
import type {SupabaseClient} from '@supabase/supabase-js'
import {Share} from '@capacitor/share'
import {Clipboard} from '@capacitor/clipboard'
import TiqTacticalStudio from '../../components/tactical/TiqTacticalStudio'
import {TacticalStudioPlatformContext,type TacticalStudioPlatform} from '../../components/tactical/TiqStudioPlatform'
import {readTacticalBoard,type TacticsIntent} from '../../lib/native-tactics-contract'
import type {TacticalScenario} from '../../lib/tactical/types'
import {TacticsLibrary} from './coach-tactics-data'
import {coachDeviceStore} from './coach-device-store'
import type {CoachSend} from './coach-workspace-data'
import {exportCoachFile,cancelCoachFile} from './native-coach-files'
import {html} from './match-details'
import './coach-premium.css'

export function openNativeTactics(client:SupabaseClient,owner:string,current:()=>boolean,trigger?:HTMLElement,send?:CoachSend,navigate?:(href:string)=>void){
 const dialog=document.createElement('dialog');dialog.className='native-coach-screen native-tactics-screen';dialog.setAttribute('aria-label','Tactics')
 dialog.innerHTML='<header class="native-coach-header"><div><small>Coach studio</small><h1 tabindex="-1">Tactics</h1></div><button type="button" class="secondary" data-tactics-close aria-label="Close tactics">Close</button></header><div class="native-coach-notice" role="status"></div><div class="native-tactics-recovery"></div><div class="native-tactics-content"></div>'
 const host=dialog.querySelector<HTMLElement>('.native-tactics-content')!,status=dialog.querySelector<HTMLElement>('[role=status]')!,recovery=dialog.querySelector<HTMLElement>('.native-tactics-recovery')!
 let disposed=false,busy=false,root:Root|null=null,latest:TacticalScenario|null=null,baseline='',leaving=false,leaveAction:(()=>void)|null=null,platform:TacticalStudioPlatform|null=null,decision:HTMLDialogElement|null=null,settleDecision:((choice:boolean)=>void)|null=null
 const revisions=new Map<string,string>()
 const active=()=>!disposed&&current(),store=coachDeviceStore(owner,active),library=new TacticsLibrary(client,owner,active,send)
 const focus=()=>dialog.querySelector<HTMLElement>('h1')?.focus({preventScroll:true})
 const notice=(text:string)=>{if(active())status.textContent=text}
 const closeDecision=(choice=false)=>{const resolve=settleDecision;settleDecision=null;decision?.close();decision?.remove();decision=null;resolve?.(choice)}
 const confirmDelete=(name:string)=>new Promise<boolean>(resolve=>{closeDecision();settleDecision=resolve;decision=document.createElement('dialog');decision.className='native-coach-decision';decision.setAttribute('aria-label','Delete saved board');decision.innerHTML='<h2 tabindex="-1">Delete this saved board?</h2><p>'+html(name)+'</p><p>Your open board and device copies stay available.</p><button type="button" data-confirm-delete>Delete from account</button><button type="button" class="secondary" data-cancel-delete>Keep board</button>';decision.querySelector('[data-confirm-delete]')?.addEventListener('click',()=>closeDecision(true));decision.querySelector('[data-cancel-delete]')?.addEventListener('click',()=>closeDecision());decision.oncancel=e=>{e.preventDefault();closeDecision()};document.body.append(decision);decision.showModal();decision.querySelector<HTMLElement>('h2')?.focus({preventScroll:true})})
 const dispose=()=>{if(disposed)return;disposed=true;closeDecision();root?.unmount();root=null;latest=null;platform=null;leaveAction=null;revisions.clear();void cancelCoachFile(owner).catch(()=>{});dialog.close();dialog.remove();if(current()&&trigger?.isConnected)trigger.focus({preventScroll:true})}
 const completeLeave=()=>{const next=leaveAction;dispose();next?.()}
 const renderRecovery=()=>{
  if(!active())return
  host.inert=leaving
  if(leaving){recovery.innerHTML='<section class="coach-decision"><h2 tabindex="-1">Leave this board?</h2><p>Save your changes on this device before leaving, or discard them.</p><button type="button" data-tactics-keep>Keep working</button><button type="button" data-tactics-save-leave>Save on device and leave</button><button type="button" class="secondary" data-tactics-leave>Discard changes</button></section>';recovery.querySelector('[data-tactics-keep]')?.addEventListener('click',()=>{leaving=false;leaveAction=null;renderRecovery()});recovery.querySelector('[data-tactics-leave]')?.addEventListener('click',completeLeave);recovery.querySelector('[data-tactics-save-leave]')?.addEventListener('click',()=>{if(busy||!latest)return;busy=true;void store.write('tactics-draft',readTacticalBoard(latest)).then(()=>{if(active())completeLeave()}).catch(()=>notice('Device save did not finish. Keep the board open and try again.')).finally(()=>{busy=false})});return}
  if(!library.pending){recovery.replaceChildren();return}
  recovery.innerHTML=`<section class="coach-decision"><h2>Check saved boards</h2><p>The last change is not confirmed. Check the saved record before making another account change.</p><button type="button" data-tactics-check ${busy?'disabled':''}>Check saved board</button>${library.canRetry?'<button type="button" data-tactics-retry>Retry the same change</button>':''}<button type="button" class="secondary" data-tactics-clear ${busy?'disabled':''}>Discard pending change</button></section>`
  recovery.querySelector('[data-tactics-check]')?.addEventListener('click',()=>{void recover(false)})
  recovery.querySelector('[data-tactics-retry]')?.addEventListener('click',()=>{void recover(true)})
  recovery.querySelector('[data-tactics-clear]')?.addEventListener('click',()=>{library.discard();notice('The pending change was cleared. Refresh saved boards before editing an account copy.');renderRecovery()})
 }
 const recover=async(retry:boolean)=>{
  if(!active()||busy)return;busy=true;renderRecovery();notice('Checking the saved board…')
  const pending=library.pending
  try{const result=retry?{snapshot:await library.retry(),confirmed:true}:await library.check();if(!active())return;notice(result.confirmed?'Your saved board is confirmed. Refresh Saved to see the account library.':library.canRetry?'This exact change was not saved. You can retry the same change.':'The saved version changed. Load that version from Saved before editing it.');if(result.confirmed&&result.snapshot.detail)revisions.set(result.snapshot.detail.id,result.snapshot.detail.updatedAt);if(result.confirmed&&latest&&pending?.action==='save'&&JSON.stringify(latest)===JSON.stringify(pending.scenario))baseline=JSON.stringify(latest)}catch(error){if(active())notice(error instanceof Error?error.message:'The board could not be checked.')}
  finally{if(active()){busy=false;renderRecovery()}}
 }
 const requestLeave=(next?:()=>void)=>{if(!active()||busy)return;if(latest&&JSON.stringify(latest)!==baseline){leaving=true;leaveAction=next??null;renderRecovery();recovery.querySelector<HTMLElement>('h2')?.focus({preventScroll:true})}else{dispose();next?.()}}
 const back=()=>{if(decision){closeDecision();return true}if(leaving){leaving=false;leaveAction=null;renderRecovery()}else requestLeave();return true}
 const write=async(intent:TacticsIntent)=>{
  if(!active()||busy)throw Error('Wait for the current board action to finish')
  busy=true;notice(intent.action==='delete'?'Deleting the saved board…':'Saving your board…')
  try{const snapshot=await library.save(intent);if(!active())throw Error('Account changed');if(snapshot.detail)revisions.set(snapshot.detail.id,snapshot.detail.updatedAt);if(latest&&intent.action==='save'&&JSON.stringify(latest)===JSON.stringify(intent.scenario))baseline=JSON.stringify(latest);notice(intent.action==='save'?'Saved to your account.':'Saved board deleted.');return snapshot.scenarios}
  catch(error){if(active())notice(error instanceof Error?error.message:'Save not confirmed');throw error}
  finally{if(active()){busy=false;renderRecovery()}}
 }
 const begin=async()=>{
  notice('Opening your court workspace…')
  try{
   const cached=await Promise.allSettled([store.read('tactics-draft'),store.read('tactics-library')]);if(!active())return
   let initialDraft:TacticalScenario|null=null,initialLibrary:TacticalScenario[]=[]
   try{if(cached[0].status==='fulfilled'&&cached[0].value!==null)initialDraft=readTacticalBoard(cached[0].value);if(cached[1].status==='fulfilled'&&Array.isArray(cached[1].value))initialLibrary=cached[1].value.slice(0,16).map(readTacticalBoard)}catch{notice('A device copy could not be read. It has been retained; your account library is still available.')}
   if(cached.some(r=>r.status==='rejected'))notice('Device storage is unavailable. Keep this board open or save to your account.')
   platform={current:active,initialDraft,initialLibrary,change:s=>{if(active()){latest=s;if(!baseline)baseline=JSON.stringify(s)}},loaded:s=>{const row=library.snapshot?.scenarios.find(row=>row.id===s.id);if(row&&JSON.stringify(row.scenario)===JSON.stringify(s))revisions.set(s.id,row.updatedAt);else revisions.delete(s.id)},saveDraft:s=>store.write('tactics-draft',readTacticalBoard(s)).then(()=>{}),saveLocal:async rows=>{const intended=rows.map(readTacticalBoard);await store.write('tactics-library',intended);if(active()&&latest&&intended.some(s=>JSON.stringify(s)===JSON.stringify(latest)))baseline=JSON.stringify(latest)},loadCloud:async()=>{const found=await library.load();notice(found.more?'Your 50 most recently updated account boards.':'');return found.scenarios},
    saveCloud:s=>write({action:'save',scenario:readTacticalBoard(s),expectedUpdatedAt:revisions.get(s.id)??null}),
    deleteCloud:async id=>{const known=library.snapshot?.scenarios.find(row=>row.id===id);if(!known)throw Error('Refresh Saved before deleting this board');if(!await confirmDelete(known.name)||!active())throw Error('Delete canceled');return write({action:'delete',id,expectedUpdatedAt:known.updatedAt})},
    copy:async text=>{if(!active())throw Error('Account changed');await Clipboard.write({string:text})},share:async(title,text)=>{if(!active())throw Error('Account changed');await Share.share({title,text,dialogTitle:'Share court plan'})},exportFile:(blob,name)=>exportCoachFile(owner,active,blob,name),navigate:href=>requestLeave(()=>navigate?.(href))}
   root=createRoot(host);root.render(<TacticalStudioPlatformContext.Provider value={platform}><TiqTacticalStudio/></TacticalStudioPlatformContext.Provider>);notice('');focus()
  }catch{if(active()){host.innerHTML='<section class="coach-decision"><h2>Tactics could not open</h2><p>Reconnect and reopen Tactics to keep your boards linked to this account.</p></section>';notice('Your court workspace could not be opened.')}}
 }
 dialog.querySelector('[data-tactics-close]')?.addEventListener('click',()=>requestLeave());dialog.oncancel=e=>{e.preventDefault();back()};document.body.append(dialog);dialog.showModal();focus();void begin()
 return {dispose,back,requestLeave,isOpen:()=>!disposed}
}
