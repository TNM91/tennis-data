import {CapacitorHttp, type HttpOptions, type HttpResponse} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import {buildProductAccessState} from '../../lib/access-model-core'
import {getMembershipTier, type MembershipTierId} from '../../lib/product-story'
import {html} from './match-details'

export {parseAccountAccess} from '../../lib/account-access-contract'
import {parseAccountAccess,type AccountAccess} from '../../lib/account-access-contract'
type AccessTransport = {get:(options:HttpOptions)=>Promise<HttpResponse>}

export async function readAccountAccess(client:SupabaseClient,owner:string,current:()=>boolean,transport:AccessTransport=CapacitorHttp) {
 const session=async()=>{
  if(!current())throw Error('Visit closed')
  const result=await client.auth.getSession()
  if(result.error || !current() || result.data.session?.user.id!==owner)throw Error('Visit closed')
  return result.data.session
 }
 const before=await session()
 const response=await transport.get({url:'https://www.tenaceiq.com/api/auth/access',headers:{Authorization:'Bearer '+before.access_token},responseType:'json',disableRedirects:true,connectTimeout:12000,readTimeout:12000})
 await session()
 if(response.status===401)throw Error('sign_in_required')
 const parsed=parseAccountAccess(response.data)
 if(response.status!==200 || !parsed)throw Error('Access unavailable')
 return parsed
}

export function accountToolIds(access:AccountAccess,now=Date.now()):MembershipTierId[] {
 const current=buildProductAccessState(access.role,access.entitlements,now)
 return [
  ...(current.canUseAdvancedPlayerInsights?['player_plus' as const]:[]),
  ...(current.canUseCoachWorkflow?['coach' as const]:[]),
  ...(current.canUseCaptainWorkflow?['captain' as const]:[]),
  ...(current.canUseLeagueTools?['league' as const]:[]),
 ]
}

export function mountAccountAccess(host:HTMLElement,client:SupabaseClient,owner:string,isCurrent:()=>boolean,read=readAccountAccess) {
 let disposed=false,request=0,busy=false
 const current=()=>!disposed && isCurrent() && host.isConnected
 host.innerHTML='<h2>Your tennis tools</h2><p>Access linked to this TenAceIQ account.</p><div data-access-tools></div><p role="status" aria-live="polite" data-access-status></p><button type="button" class="secondary" data-access-refresh>Refresh access</button>'
 const tools=host.querySelector<HTMLElement>('[data-access-tools]')!,status=host.querySelector<HTMLElement>('[data-access-status]')!,button=host.querySelector<HTMLButtonElement>('[data-access-refresh]')!
 const load=async()=>{
  if(!current() || busy)return
  const visit=++request;busy=true;button.disabled=true;tools.replaceChildren();status.textContent='Checking your access…'
  try {
   const access=await read(client,owner,()=>current() && visit===request)
   if(!current() || visit!==request)return
   const ids=accountToolIds(access)
   tools.innerHTML=ids.length?`<ul class="account-tool-access">${ids.map(id=>{const tier=getMembershipTier(id);return `<li><span><strong>${html(tier.name)}</strong><small>${html(tier.shortPromise)}</small></span><span class="account-access-badge">Available</span></li>`}).join('')}</ul>`:''
   status.textContent='Explore players, teams, leagues and rankings with your account.'
   button.textContent='Refresh access'
  } catch(error) {
   if(!current() || visit!==request)return
   status.textContent=error instanceof Error && error.message==='sign_in_required'?'Sign in again to check your access.':'Couldn’t load your access. Check your connection and try again.'
   button.textContent='Try again'
  } finally {
   if(current() && visit===request){busy=false;button.disabled=false}
  }
 }
 button.onclick=()=>{void load()}
 void load()
 return {refresh(){void load()},dispose(){disposed=true;request++;button.onclick=null;host.replaceChildren()}}
}
