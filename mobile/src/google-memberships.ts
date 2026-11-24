import type {SupabaseClient} from '@supabase/supabase-js'
import {GOOGLE_PLAY_PRODUCTS} from '../../lib/google-play-products'
import {googleMembershipService,type GoogleMembershipService} from './google-membership-service'
import {html} from './match-details'
import {nativeActionIcon} from './native-action-icons'
import {accountLinksHtml,bindAccountLinks} from './account-actions'

const messages:Record<string,string>={
 owner_changed:'Sign in to the original TenAceIQ account to continue.',
 sign_in_required:'Sign in again to check your membership.',
 google_account_mismatch:'This purchase belongs to another TenAceIQ account. Sign in to the account used for the purchase.',
 google_existing_access:'Your current membership already includes paid tools. Manage it before starting another subscription.',
 google_existing_purchase:'Restore your existing purchase before starting another subscription.',
 google_purchase_sync_pending:'Your purchase needs to finish syncing. Use Restore purchases before trying again.',
 google_purchase_pending:'Your purchase is awaiting Google Play approval. Restore it after approval to activate Pro.',
 google_purchase_in_progress:'Finish the current Google Play action before trying again.',
 google_products_unavailable:'Google Play couldn’t load Pro. Check your connection and retry.',
 try_later:'Please wait before restoring again. Google Play keeps your purchase saved.',
}
export function mountGoogleMemberships(host:HTMLElement,client:SupabaseClient,owner:string,isCurrent:()=>boolean,changed:()=>void,service:GoogleMembershipService=googleMembershipService(client)){
 let disposed=false,busy=false,loading=false,version=0,pendingApproval=false,needsSync=false,needsReload=false,accessChanged=false,slow:ReturnType<typeof setTimeout>|undefined
 const current=()=>!disposed&&isCurrent()&&host.isConnected
 host.hidden=false;host.classList.add('google-membership-panel');host.setAttribute('aria-label','Pro membership')
 if(!service.available){host.innerHTML='<h2>Pro membership</h2><p role="status">Google Play memberships couldn’t start. Open the latest TenAceIQ Google Play build and try again.</p>';return {dispose(){disposed=true;host.replaceChildren()}}}
 host.innerHTML=`<header class="google-pro-heading"><span class="google-pro-mark">PRO</span><div><h2>Pro membership</h2><p>Captain and Coach tools, together.</p></div></header><ul class="google-pro-includes"><li>${nativeActionIcon('members')}<span><strong>Lead your team</strong><small>Lineups, readiness and match-day tools</small></span></li><li>${nativeActionIcon('profile')}<span><strong>Coach with a plan</strong><small>Assessments, lessons and player progress</small></span></li></ul><p role="status" aria-live="polite" tabindex="-1" data-google-status></p><p role="alert" tabindex="-1" data-google-error></p><div data-google-content></div>`
 const status=host.querySelector<HTMLElement>('[data-google-status]')!,error=host.querySelector<HTMLElement>('[data-google-error]')!,content=host.querySelector<HTMLElement>('[data-google-content]')!
 const lock=()=>{for(const button of host.querySelectorAll<HTMLButtonElement>('button'))button.disabled=busy||loading||service.isBusy()||button.hasAttribute('data-google-buy')&&(pendingApproval||needsSync)}
 const clearSlow=()=>{clearTimeout(slow);slow=undefined}
 const showError=(reason:unknown,focus=false)=>{error.textContent=messages[reason instanceof Error?reason.message:'']||'Couldn’t check Google Play. Check your connection and retry, or restore your existing purchase.';if(focus){error.focus({preventScroll:true});error.scrollIntoView({block:'nearest'})}}
 function drain(){
  if(!needsReload||busy||loading||service.isBusy()||!current())return
  needsReload=false;if(accessChanged){accessChanged=false;changed()}void load()
 }
 function recovery(){return `<div class="google-pro-recovery"><button type="button" class="secondary" data-google-restore>Restore purchases</button><button type="button" class="secondary" data-google-manage>Manage Google Play subscriptions</button></div>${accountLinksHtml}`}
 function bind(){
  bindAccountLinks(content)
  content.querySelector<HTMLButtonElement>('[data-google-retry]')?.addEventListener('click',()=>{if(!busy&&!loading&&!service.isBusy())void load()})
  content.querySelector<HTMLButtonElement>('[data-google-restore]')?.addEventListener('click',()=>{void action(async()=>{
   const result=await service.recover(owner);pendingApproval=result.pending>0;needsSync=result.foreign>0&&result.restored===0
   return result.restored?'Your Google Play purchase is restored.':needsSync?'These purchases belong to another TenAceIQ account. Sign in to that account to restore them.':pendingApproval?'Your purchase is awaiting Google Play approval. Restore it after approval to activate Pro.':'No active purchase was found. Check the Google Account used for your original purchase.'
  },'Restoring your Google Play purchase…')})
  content.querySelector<HTMLButtonElement>('[data-google-manage]')?.addEventListener('click',()=>{void action(async()=>{await service.manage(owner);return 'Manage your subscription in Google Play.'},'Opening Google Play subscriptions…',false)})
 }
 async function action(work:()=>Promise<string>,message:string,refresh=true){
  if(!current()||busy||loading||service.isBusy())return
  busy=true;error.textContent='';status.textContent=message;lock();clearSlow()
  slow=setTimeout(()=>{if(current()&&busy)status.textContent='This is taking longer than usual. Keep this account signed in so your purchase can finish syncing.'},15000)
  try{
   const message=await work()
   if(!current())return
   if(refresh){needsReload=false;accessChanged=false;changed();await load(message)}else status.textContent=message
  }catch(reason){if(current())showError(reason,true)}finally{clearSlow();if(current()){busy=false;lock();drain()}}
 }
 async function load(message=''){
  if(!current())return
  const visit=++version;loading=true;error.textContent='';status.textContent=message||'Checking your Pro membership…';lock()
  try{
   const context=await service.context(owner)
   if(!current()||visit!==version)return
   if(!context.enabled){
    content.innerHTML='<p>Google Play memberships aren’t available for this account yet. Your current tools remain available.</p><button type="button" class="secondary" data-google-retry>Check availability</button>'+recovery();status.textContent=message;bind();return
   }
   let offer='',priceError:unknown
   if(context.active){pendingApproval=false;needsSync=false;offer='<p class="google-pro-active">Pro is active</p><p>Captain and Coach tools are available.</p>'}
   else if(context.otherAccess)offer='<p>Your current membership already includes paid tools. Manage it before starting another subscription.</p>'
   else if(context.manageRequired)offer='<p>Review your Google Play subscription to check payment or resume Pro.</p>'
   else if(pendingApproval||needsSync)offer='<p>Restore your existing purchase before starting another subscription.</p>'
   else if(context.canPurchase){
    if(service.isBusy()){needsReload=true;offer='<p>Checking earlier Google Play purchases…</p>'}
    else{
     try{
      const product=await service.product(owner,GOOGLE_PLAY_PRODUCTS[0].id)
      if(!current()||visit!==version)return
      if(product.productId!==GOOGLE_PLAY_PRODUCTS[0].id||typeof product.price!=='string'||!product.price.trim()||product.price.length>80)throw Error('google_products_unavailable')
      offer=`<p class="google-pro-price"><strong>${html(product.price)}</strong><span>per month</span></p><button type="button" class="google-pro-buy" data-google-buy>Get Pro · ${html(product.price)}/month</button><p class="google-pro-terms">Monthly subscription, charged through Google Play. Renews automatically until canceled in Google Play subscriptions.</p>`
     }catch(reason){priceError=reason;offer='<button type="button" class="secondary" data-google-retry>Retry loading Pro</button>'}
    }
   }else offer='<p>New Google Play subscriptions are temporarily unavailable.</p>'
   if(!current()||visit!==version)return
   content.innerHTML='<p class="google-pro-test">Google Play test access · use a test payment method</p>'+offer+recovery();status.textContent=message;bind()
   content.querySelector<HTMLButtonElement>('[data-google-buy]')?.addEventListener('click',()=>{void action(async()=>{
    needsSync=true
    const result=await service.purchase(owner,GOOGLE_PLAY_PRODUCTS[0].id)
    needsSync=false;pendingApproval=result==='pending'
    return result==='purchased'?'Pro is ready. Captain and Coach tools are unlocked.':pendingApproval?'Your purchase is awaiting Google Play approval. Restore it after approval to activate Pro.':'Purchase canceled. Your current tools remain available.'
   },'Opening Google Play to confirm Pro…')})
   if(priceError)showError(priceError)
  }catch(reason){
   if(!current()||visit!==version)return
   content.innerHTML='<button type="button" class="secondary" data-google-retry>Retry Pro membership</button>'+recovery();status.textContent='';bind();showError(reason)
  }finally{if(current()&&visit===version){loading=false;lock();drain()}}
 }
 const unsubscribe=service.subscribe(()=>{needsReload=true;accessChanged=true;drain()}),unsubscribeBusy=service.subscribeBusy(()=>{if(current()){lock();if(!service.isBusy())drain()}})
 void load()
 return {dispose(){if(disposed)return;disposed=true;version++;clearSlow();unsubscribe();unsubscribeBusy();host.replaceChildren()}}
}
