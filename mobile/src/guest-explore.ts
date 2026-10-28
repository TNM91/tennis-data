import {createPublicBrowseClient} from './public-browse-client'
import {showExplore} from './explore-directory'
// Reuse only the isolated in-memory public client across visits. It never receives an account session.
let publicClient:ReturnType<typeof createPublicBrowseClient>|undefined
export function showGuestExplore(app:HTMLElement,current:()=>boolean,signIn:()=>void) {
 let disposed=false
 const valid=()=>!disposed&&current(),access={signIn:()=>{if(valid())signIn()}}
 app.innerHTML='<div class="public-explore-toolbar"><button type="button" class="secondary" data-public-back>Back</button><span>Public Explore</span><button type="button" class="secondary" data-public-sign-in>Sign in</button></div><div data-public-explore></div>'
 const content=app.querySelector<HTMLElement>('[data-public-explore]')!
 const directory=showExplore(content,publicClient??=createPublicBrowseClient(),valid,'Overview',access)
 const back=()=>{if(!valid())return false;if(!directory.back())access.signIn();return true}
 app.querySelector<HTMLButtonElement>('[data-public-back]')!.onclick=back
 app.querySelector<HTMLButtonElement>('[data-public-sign-in]')!.onclick=access.signIn
 return {back,dispose:()=>{disposed=true;directory.dispose()}}
}
