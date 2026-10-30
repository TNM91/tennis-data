import {Capacitor,registerPlugin} from '@capacitor/core'

type LockStatus={enabled:boolean;available:boolean;biometry:string}
const lock=registerPlugin<{status():Promise<LockStatus>;setEnabled(options:{enabled:boolean}):Promise<LockStatus>}>('TiqAppLock')

/** A device privacy lock; Supabase remains responsible for account sign-in. */
export function mountAppLock(host:HTMLElement,current:()=>boolean){
 let disposed=false,busy=false,status:LockStatus|null=null
 const valid=()=>!disposed&&current()&&host.isConnected
 if(Capacitor.getPlatform()!=='ios'){host.remove();return {dispose(){disposed=true}}}
 host.innerHTML='<h2>Face ID &amp; app lock</h2><p>Checking this iPhone…</p>'
 function render(message=''){
  if(!valid()||!status)return
  const name=status.biometry==='faceID'?'Face ID':status.biometry==='touchID'?'Touch ID':'device unlock'
  host.innerHTML='<h2>Face ID &amp; app lock</h2><p>Keep TenAceIQ private on this iPhone. Unlock with Face ID, Touch ID or your device passcode when you reopen the app.</p><p>You stay signed in until you log out. After logging out, sign in with your password or email code.</p><p data-lock-status role="status"></p><button type="button" class="secondary" data-lock-toggle></button><p data-lock-error role="alert"></p>'
  host.querySelector<HTMLElement>('[data-lock-status]')!.textContent=status.enabled?'App lock is on for this iPhone.':'App lock is off.'
  const button=host.querySelector<HTMLButtonElement>('[data-lock-toggle]')!
  button.textContent=status.enabled?'Turn off app lock':`Turn on ${name}`
  button.disabled=busy||!status.available
  host.querySelector<HTMLElement>('[data-lock-error]')!.textContent=message||(!status.available?'Set up a device passcode in iPhone Settings to use app lock.':'')
  button.onclick=async()=>{
   if(!valid()||busy||!status)return
   busy=true;button.disabled=true
   try{const result=await lock.setEnabled({enabled:!status.enabled});if(valid()){status=result;render()}}
   catch(error){if(valid()){const code=(error as {code?:string})?.code;render(code==='authentication_cancelled'?'No change made. Unlock was canceled.':'Couldn’t change app lock. Try again using Face ID or your device passcode.')}}
   finally{busy=false;if(valid()&&status)host.querySelector<HTMLButtonElement>('[data-lock-toggle]')!.disabled=!status.available}
  }
 }
 void lock.status().then(result=>{if(valid()){status=result;render()}}).catch(()=>{if(valid())host.innerHTML='<h2>Face ID &amp; app lock</h2><p role="alert">Couldn’t check app lock. Close Account and try again.</p>'})
 return {dispose(){disposed=true}}
}
