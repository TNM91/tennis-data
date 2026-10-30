import type {SupabaseClient} from '@supabase/supabase-js'
import {openAccountSettings} from '../../mobile/src/account-settings'
import {createNativeSignOut} from '../../mobile/src/native-sign-out'
const owner='11111111-1111-4111-8111-111111111111',mode=new URL(location.href).searchParams.get('mode')||''
const state={owner:owner as string|null,cleanupCalls:0,logoutCalls:0,scopes:[] as string[],events:[] as string[],release:()=>{}}
const main=document.querySelector('main')!
let panel:ReturnType<typeof openAccountSettings>|null=null
const client={auth:{getSession:async()=>({data:{session:state.owner?{user:{id:state.owner},access_token:'synthetic-only'}:null},error:null}),signOut:async(options:{scope:string})=>{state.logoutCalls++;state.scopes.push(options.scope);state.events.push('logout');if(mode==='account-auth-error'&&state.logoutCalls===1)return {error:Error('Private provider details')};state.owner=null;setTimeout(()=>{panel?.dispose();main.innerHTML='<h1>Log in</h1><p>You are logged out.</p>'},0);return {error:null}}}} as unknown as SupabaseClient
const logout=createNativeSignOut(client,async()=>{state.cleanupCalls++;state.events.push('cleanup');if(mode==='account-cleanup-error'&&state.cleanupCalls===1)throw Error('Private alert details');if(mode==='account-waiting')await new Promise<void>(resolve=>{state.release=resolve})},()=>state.owner)
main.innerHTML='<h1>My Lab</h1><button type="button" id="account-open">Account settings</button>'
main.querySelector<HTMLButtonElement>('#account-open')!.onclick=()=>{panel=openAccountSettings(client,owner,()=>state.owner===owner,()=>logout(owner))}
Object.assign(window,{accountLogoutFixture:{state,dispose:()=>panel?.dispose()}})
