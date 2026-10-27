import type {SupabaseClient} from '@supabase/supabase-js'
import type {PlayerChoice} from './player-connection'
import type {RosterPlayerProfile} from './roster-player-profile'
import {comparisonSeedPlayers} from './roster-comparison-selection'
export function openRosterComparison(client:SupabaseClient,players:readonly PlayerChoice[],current:()=>boolean):RosterPlayerProfile|null{
 const seeds=comparisonSeedPlayers(players);if(!seeds||!current())return null
 const previous=document.activeElement instanceof HTMLElement?document.activeElement:null,scroll={x:window.scrollX,y:window.scrollY},dialog=document.createElement('dialog'),host=document.createElement('div'),button=document.createElement('button')
 dialog.className='captain-lineup-dialog roster-player-dialog roster-comparison-dialog';dialog.setAttribute('aria-label','Roster player comparison');host.className='roster-player-content';button.type='button';button.className='secondary roster-profile-back';button.textContent='Back to team roster';dialog.append(button,host)
 let disposed=false,comparison:ReturnType<typeof import('./comparison-view').showComparison>|null=null
 const valid=()=>!disposed&&current()&&dialog.isConnected
 const dispose=()=>{if(disposed)return;disposed=true;comparison?.dispose();comparison=null;dialog.remove();if(current()){window.scrollTo(scroll.x,scroll.y);if(previous?.isConnected)previous.focus({preventScroll:true})}}
 const back=()=>{if(disposed)return false;if(comparison?.back())return true;dispose();return true}
 button.onclick=back;dialog.oncancel=event=>{event.preventDefault();back()};host.innerHTML='<p role="status">Opening roster comparison...</p>';document.body.append(dialog);dialog.showModal();button.focus()
 const load=async()=>{try{const before=await client.auth.getSession();if(before.error||!before.data.session||!valid())throw Error();const owner=before.data.session.user.id,view=await import('./comparison-view'),after=await client.auth.getSession();if(after.error||after.data.session?.user.id!==owner||!valid())throw Error();comparison=view.showComparison(host,client,valid,{players:seeds,localMatches:true,scrollHost:dialog})}catch{if(valid()){host.innerHTML='<p role="alert">Could not open comparison. Return to the roster and try again.</p>';button.focus()}}}
 void load();return {dispose,back,isOpen:()=>!disposed}
}
