import {createPublicBrowseClient} from './public-browse-client'
import {showExplore,type ExploreVisit} from './explore-directory'
import type {PublicBrowseAccess} from './public-browse-access'
import {publicCompetitionOwner} from '../../lib/native-competitions-contract'
import {openCompetitions} from './competitions-view'
import {firstPartyBuild} from './build-scope'
// Reuse only the isolated in-memory public client across visits. It never receives an account session.
let publicClient:ReturnType<typeof createPublicBrowseClient>|undefined
export function showGuestExplore(app:HTMLElement,current:()=>boolean,signIn:(visit:ExploreVisit)=>void,backToWelcome:()=>void) {
 let disposed=false
 let competitions:ReturnType<typeof openCompetitions>|undefined
 const valid=()=>!disposed&&current()
 const access:PublicBrowseAccess={signIn:player=>{
   if(!valid())return
   const visit=directory.visit()
   const name=player?.name.trim().slice(0,80)??''
   if(player&&name.length>=2&&visit.results?.key!==player.id){
     signIn({category:'Players',term:name,results:{key:player.id}})
   }else signIn(visit)
 }}
 app.innerHTML='<div class="public-explore-toolbar"><button type="button" class="secondary" data-public-back>Back</button><span>Public Explore</span><button type="button" class="secondary" data-public-sign-in>Sign in</button></div><div data-public-explore></div>'
 const content=app.querySelector<HTMLElement>('[data-public-explore]')!
 const client=publicClient??=createPublicBrowseClient()
 const directory=showExplore(content,client,valid,{access,onCompetitions:firstPartyBuild?(trigger,query)=>{
  if(!competitions?.isOpen())competitions=openCompetitions(client,publicCompetitionOwner,valid,'discover',undefined,undefined,trigger,'',undefined,query)
 }:undefined})
 const back=()=>{if(!valid())return false;if(competitions?.isOpen())return competitions.back();if(!directory.back())backToWelcome();return true}
 app.querySelector<HTMLButtonElement>('[data-public-back]')!.onclick=back
 app.querySelector<HTMLButtonElement>('[data-public-sign-in]')!.onclick=()=>access.signIn()
 return {back,dispose:()=>{disposed=true;competitions?.dispose();directory.dispose()}}
}
