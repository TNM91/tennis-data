import type {PlayerChoice} from './player-connection'

type PublicProfile=Pick<PlayerChoice,'id'|'name'>
export type PublicBrowseAccess={signIn:(player?:PublicProfile)=>void}
export function showPublicSignIn(host:HTMLElement,access:PublicBrowseAccess,current:()=>boolean,player?:PublicProfile) {
 host.innerHTML='<aside class="public-sign-in"><p>Make tennis yours.</p><span>Sign in for My Lab, follows and your team chats.</span><button type="button" class="secondary">Sign in</button></aside>'
 host.querySelector<HTMLButtonElement>('button')!.onclick=()=>{if(current())access.signIn(player)}
}
