/** Public browsing never grants account access; the callback returns to sign-in. */
export type PublicBrowseAccess={signIn:()=>void}
export function showPublicSignIn(host:HTMLElement,access:PublicBrowseAccess,current:()=>boolean) {
 host.innerHTML='<aside class="public-sign-in"><p>Make tennis yours.</p><span>Sign in for My Lab, follows and your team chats.</span><button type="button" class="secondary">Sign in</button></aside>'
 host.querySelector<HTMLButtonElement>('button')!.onclick=()=>{if(current())access.signIn()}
}
