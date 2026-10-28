import type {SupabaseClient} from '@supabase/supabase-js'
import {applePurchases,type ApplePurchases} from './apple-purchases'
import {html} from './match-details'
import {accountLinksHtml,bindAccountLinks} from './account-actions'
const messages:Record<string,string>={owner_changed:'Sign in to the original account before continuing.',purchase_account_mismatch:'These purchases belong to another TenAceIQ account. Sign in to that account to restore them.',account_mismatch:'This Apple membership belongs to another TenAceIQ account.',existing_purchase:'Restore your Apple purchase, then manage your plan in Apple subscriptions.',existing_access:'Manage your current membership before starting another subscription.',purchase_sync_pending:'Your purchase is still syncing. Try Sync purchase shortly.',try_later:'Please wait before syncing again. Your Apple purchase is saved.',products_unavailable:'Apple memberships aren’t available for this account or storefront yet.'}
export function mountAppleMemberships(host:HTMLElement,client:SupabaseClient,owner:string,isCurrent:()=>boolean,changed:()=>void,service:ApplePurchases=applePurchases(client)){
 let disposed=false,busy=false,version=0,pendingApproval=false,needsSync=false
 const current=()=>!disposed&&host.isConnected&&isCurrent()
 if(!service.available){host.hidden=true;return {dispose(){disposed=true}}}
 host.innerHTML='<h2>Apple membership</h2><div data-apple-content></div><p role="status" aria-live="polite" data-apple-status></p>'
 const content=host.querySelector<HTMLElement>('[data-apple-content]')!,status=host.querySelector<HTMLElement>('[data-apple-status]')!
 const showError=(error:unknown)=>{status.textContent=messages[error instanceof Error?error.message:'']||'Couldn’t sync with Apple. If you already purchased, use Sync purchase or Restore purchases.'}
 async function action(work:()=>Promise<string|void>){if(!current()||busy)return;busy=true;host.querySelectorAll<HTMLButtonElement>('button').forEach(b=>{b.disabled=true});status.textContent='Contacting Apple…';try{const message=await work();if(current()){changed();await load(message||'')}}catch(e){if(current())showError(e)}finally{if(current()){busy=false;host.querySelectorAll<HTMLButtonElement>('button').forEach(b=>{b.disabled=(pendingApproval||needsSync)&&!!b.dataset.appleBuy})}}}
 async function load(message=''){
  if(!current())return;const visit=++version
  if(!message)status.textContent='Checking your Apple membership…'
  try{
   const context=await service.context(owner)
   if(!current()||visit!==version)return
   if(!context.enabled){content.innerHTML='<p>Apple memberships are coming soon. Your current tools remain available.</p>';status.textContent='';return}
   let offers='',productsError:unknown=null
   if(context.canPurchase){
    let products:Awaited<ReturnType<ApplePurchases['products']>>=[]
    try{products=await service.products(owner,context.environment)}catch(e){productsError=e}
    if(!current()||visit!==version)return
    offers=products.map(p=>`<article class="apple-plan"><h3>${html(p.name)}</h3><p>${html(p.description)}</p><button type="button" data-apple-buy="${html(p.productId)}">${pendingApproval?'Approval pending':needsSync?'Sync purchase first':`Subscribe · ${html(p.price)}/month`}</button></article>`).join('')
   }else offers=`<p>${context.webAccess?'Your current access is managed through TenAceIQ. Keep using your existing membership.':context.activeProductId?'Your Apple membership is active. Manage your plan in Apple subscriptions.':'New Apple subscriptions are temporarily unavailable. Your current tools remain available.'}</p>`
   content.innerHTML=`${context.environment==='Sandbox'?'<p class="apple-test-label">TestFlight purchase test · no live charge</p>':''}${offers}<div class="apple-membership-actions"><button type="button" class="secondary" data-apple-sync>Sync purchase</button><button type="button" class="secondary" data-apple-restore>Restore purchases</button><button type="button" class="secondary" data-apple-manage>Manage Apple subscriptions</button></div><small>Monthly subscription. Payment is charged to your Apple Account. Renews automatically until canceled in Apple subscriptions. Apple confirms the price and terms before you pay.</small>${accountLinksHtml}`
   bindAccountLinks(content)
   content.querySelectorAll<HTMLButtonElement>('[data-apple-buy]').forEach(button=>{button.disabled=pendingApproval||needsSync;button.onclick=()=>{void action(async()=>{needsSync=true;const result=await service.purchase(owner,button.dataset.appleBuy!);needsSync=false;if(result==='pending'){pendingApproval=true;return 'Waiting for Apple’s approval. Your access updates when the purchase is approved.'}return result==='cancelled'?'Purchase canceled.':'Your Apple purchase is synced.'})}})
   content.querySelector<HTMLButtonElement>('[data-apple-sync]')!.onclick=()=>{void action(async()=>{const n=await service.recover(owner);needsSync=false;return n?'Your purchase is synced.':'No unfinished purchase was found. Use Restore purchases if you are missing access.'})}
   content.querySelector<HTMLButtonElement>('[data-apple-restore]')!.onclick=()=>{void action(async()=>{const n=await service.restore(owner,context.environment);needsSync=false;return n?'Your Apple purchases are restored.':'No Apple memberships were found. Check the Apple Account used for the original purchase.'})}
   content.querySelector<HTMLButtonElement>('[data-apple-manage]')!.onclick=()=>{void action(()=>service.manage(owner))}
   status.textContent=message
   if(productsError){showError(productsError);const retry=document.createElement('button');retry.type='button';retry.className='secondary';retry.textContent='Retry Apple prices';retry.onclick=()=>{void load()};content.append(retry)}
  }catch(e){if(!current()||visit!==version)return;content.innerHTML='<button type="button" class="secondary" data-apple-retry>Retry Apple membership</button>';content.querySelector<HTMLButtonElement>('button')!.onclick=()=>{void load()};showError(e)}
 }
 const unsubscribe=service.subscribe(()=>{if(current()&&!busy){needsSync=false;changed();void load('Your membership access is refreshed.')}})
 void load()
 return {dispose(){disposed=true;version++;unsubscribe();host.replaceChildren()}}
}
