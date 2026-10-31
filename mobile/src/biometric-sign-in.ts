import {Capacitor,registerPlugin} from '@capacitor/core'
import {createClient,type SupabaseClient} from '@supabase/supabase-js'
import {supabaseUrl,supabaseKey} from '../../lib/supabase-public-config'

type Status={available:boolean;saved:boolean;forCurrentOwner:boolean;biometry:string}
type Credential={owner:string;email:string;password:string}
const biometric=registerPlugin<{
 status(options?:{owner:string}):Promise<Status>
 remember(options:Credential&{request:string}):Promise<void>
 signIn(options:{request:string}):Promise<Credential>
 forget(options:{owner:string}):Promise<void>
 cancel(options:{request:string}):Promise<void>
}>('TiqBiometricSignIn')
const temporaryClient=()=>createClient(supabaseUrl,supabaseKey,{auth:{storageKey:'tenaceiq-biometric-verification-'+crypto.randomUUID(),persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(12000)})}})
const label=(state:Status)=>state.biometry==='touchID'?'Touch ID':'Face ID'
const cancelled=(error:unknown)=>(error as {code?:string})?.code==='authentication_cancelled'
export async function forgetBiometricSignIn(owner:string){if(Capacitor.getPlatform()==='ios')await biometric.forget({owner})}

/** Explicit opt-in saves a verified password in a biometric-protected Keychain item. */
export function mountBiometricSettings(host:HTMLElement,client:SupabaseClient,owner:string,current:()=>boolean){
 let disposed=false,busy=false,state:Status|null=null,request=''
 const valid=()=>!disposed&&current()&&host.isConnected
 if(Capacitor.getPlatform()!=='ios'){host.remove();return {dispose(){disposed=true}}}
 host.innerHTML='<h2>Face ID sign-in</h2><p>Checking this iPhone…</p>'
 function render(message=''){
  if(!valid()||!state)return
  const enabled=state.forCurrentOwner,name=label(state)
  host.innerHTML=`<h2>${name} sign-in</h2><p>Sign in with your saved account on this iPhone. Return to the app without unlocking it again.</p><p data-biometric-status role="status"></p>${enabled?'<button type="button" class="secondary" data-biometric-remove>Remove saved sign-in</button>':'<form data-biometric-setup><label>Your current TenAceIQ password<input type="password" autocomplete="current-password" maxlength="4096" required></label><p class="rating-context">Your saved sign-in is protected in this iPhone’s Keychain by Face ID or Touch ID. It isn’t synced to other devices.</p><button type="submit" data-biometric-enable></button></form>'}<p role="alert" data-biometric-error></p>`
  host.querySelector<HTMLElement>('[data-biometric-status]')!.textContent=enabled?`${name} sign-in is ready for your account.`:state.saved?'Turning this on will replace the other account saved on this iPhone.':'Optional. Your password and email code will still work.'
  host.querySelector<HTMLElement>('[data-biometric-error]')!.textContent=message||(!state.available?'Set up Face ID or Touch ID in iPhone Settings first.':'')
  const remove=host.querySelector<HTMLButtonElement>('[data-biometric-remove]')
  if(remove)remove.onclick=async()=>{if(busy||!valid())return;busy=true;remove.disabled=true;try{await forgetBiometricSignIn(owner);if(valid()){state=await biometric.status({owner});render()}}catch{if(valid())render('Couldn’t remove saved sign-in. Try again.')}finally{busy=false}}
  const form=host.querySelector<HTMLFormElement>('[data-biometric-setup]'),button=form?.querySelector<HTMLButtonElement>('button')
  if(!form||!button)return
  button.textContent=`Turn on ${name} sign-in`;button.disabled=!state.available
  form.onsubmit=async event=>{
   event.preventDefault();if(!valid()||busy||!form.reportValidity())return
   busy=true;button.disabled=true;button.textContent='Verifying your account…'
   const input=form.querySelector<HTMLInputElement>('input')!,verification=temporaryClient()
   let password=input.value;input.value=''
   try{
    const {data:identity,error:identityError}=await client.auth.getUser()
    if(!valid())return
    if(identityError||identity.user?.id!==owner||!identity.user.email)throw new Error('verification_failed')
    const email=identity.user.email,{data,error}=await verification.auth.signInWithPassword({email,password})
    if(!valid())return
    if(error||data.user?.id!==owner)throw new Error('verification_failed')
    request=crypto.randomUUID();button.textContent=`Confirm with ${name}…`
    await biometric.remember({owner,email,password,request})
    if(valid()){state=await biometric.status({owner});render()}
   }catch(error){if(valid())render(cancelled(error)?'Sign-in was not saved. You can try again.':error instanceof Error&&error.message==='verification_failed'?'Check your current password and try again.':'Couldn’t save sign-in. Check your connection and Face ID settings, then try again.')}
   finally{password='';busy=false;await verification.auth.signOut({scope:'local'}).catch(()=>{});if(valid())host.querySelector<HTMLButtonElement>('[data-biometric-enable]')?.removeAttribute('disabled')}
  }
 }
 void biometric.status({owner}).then(result=>{if(valid()){state=result;render()}}).catch(()=>{if(valid())host.innerHTML='<h2>Face ID sign-in</h2><p role="alert">Couldn’t check saved sign-in. Close Account and try again.</p>'})
 return {dispose(){disposed=true;const input=host.querySelector<HTMLInputElement>('input');if(input)input.value='';if(request)void biometric.cancel({request}).catch(()=>{})}}
}

/** Only the signed-out user's button initiates authentication. */
export function mountBiometricSignIn(host:HTMLElement,client:SupabaseClient,current:()=>boolean){
 let disposed=false,busy=false,request=''
 const valid=()=>!disposed&&current()&&host.isConnected
 if(Capacitor.getPlatform()!=='ios'){host.remove();return {dispose(){disposed=true}}}
 void biometric.status().then(state=>{
  if(!valid()||!state.saved||!state.available)return
  host.innerHTML='<button type="button" class="secondary" data-biometric-signin></button><p role="alert" data-biometric-login-error></p>'
  const button=host.querySelector<HTMLButtonElement>('button')!,error=host.querySelector<HTMLElement>('[role="alert"]')!
  button.textContent=`Sign in with ${label(state)}`
  button.onclick=async()=>{
   if(busy||!valid())return
   busy=true;button.disabled=true;error.textContent='';request=crypto.randomUUID()
   let credential:Credential|null=null,adopted=false
   const verification=temporaryClient()
   try{
    credential=await biometric.signIn({request})
    if(!valid())return
    const result=await verification.auth.signInWithPassword({email:credential.email,password:credential.password})
    credential.password=''
    if(!valid())return
    if(result.error||!result.data.session||result.data.user?.id!==credential.owner){
     if(result.error?.code==='invalid_credentials'||result.data.user&&result.data.user.id!==credential.owner)await forgetBiometricSignIn(credential.owner)
     throw new Error('signin_failed')
    }
    const {access_token,refresh_token}=result.data.session,existing=await client.auth.getSession()
    if(!valid()||existing.error||existing.data.session)return
    const resultSession=await client.auth.setSession({access_token,refresh_token})
    if(resultSession.error)throw resultSession.error
    adopted=true
   }catch(reason){if(valid())error.textContent=cancelled(reason)?'Sign-in canceled. Use Face ID, your password or an email code when you’re ready.':'Couldn’t sign in with the saved account. Use your password or an email code, then turn on Face ID again in Account.'}
   finally{if(credential)credential.password='';if(!adopted)await verification.auth.signOut({scope:'local'}).catch(()=>{});busy=false;if(valid())button.disabled=false}
  }
 }).catch(()=>{/* Password and email-code sign-in remain available. */})
 return {dispose(){disposed=true;if(request)void biometric.cancel({request}).catch(()=>{})}}
}
