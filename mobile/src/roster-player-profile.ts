import type {SupabaseClient} from '@supabase/supabase-js'
import type {PlayerChoice} from './player-connection'
import type {TeamRosterPlayer} from './team-roster-data'
export type RosterPlayerProfile={back:()=>boolean;dispose:()=>void;isOpen:()=>boolean}
export type RosterProfileNavigation={profile:RosterPlayerProfile|null}
export function rosterPlayerChoice(row:TeamRosterPlayer):PlayerChoice|null {
 const player=row.player
 if(!player||player.id!==row.id||!/^[a-zA-Z0-9_-]{1,100}$/.test(player.id)||!player.name.trim()||player.name.length>200)return null
 return {id:player.id,name:player.name,location:player.location,flight:player.flight}
}
export function openRosterPlayerProfile(client:SupabaseClient,choice:PlayerChoice,current:()=>boolean):RosterPlayerProfile {
 const previous=document.activeElement instanceof HTMLElement?document.activeElement:null,scroll={x:window.scrollX,y:window.scrollY},dialog=document.createElement('dialog'),host=document.createElement('div'),backButton=document.createElement('button')
 dialog.className='captain-lineup-dialog roster-player-dialog';dialog.setAttribute('aria-label',`${choice.name} player profile`);host.className='roster-player-content';host.setAttribute('data-roster-player','');backButton.type='button';backButton.className='secondary roster-profile-back';backButton.textContent='Back to team roster';dialog.append(backButton,host)
 let disposed=false,profile:ReturnType<typeof import('./explore').showExplore>|null=null
 const valid=()=>!disposed&&current()&&dialog.isConnected
 const dispose=()=>{if(disposed)return;disposed=true;profile?.dispose();profile=null;dialog.remove();if(current()){window.scrollTo(scroll.x,scroll.y);if(previous?.isConnected)previous.focus({preventScroll:true})}}
 const back=()=>{if(disposed)return false;if(profile?.back())return true;dispose();return true}
 backButton.onclick=dispose;dialog.oncancel=e=>{e.preventDefault();back()};host.innerHTML='<p role="status">Loading player profile...</p>';document.body.append(dialog);dialog.showModal();backButton.focus()
 const load=async()=>{try{const {data,error}=await client.auth.getSession();if(error||!data.session||!valid())throw Error('Visit closed.');const owner=data.session.user.id;const playerView=await import('./explore');const next=await client.auth.getSession();if(next.error||next.data.session?.user.id!==owner||!valid())throw Error('Visit closed.');profile=playerView.showExplore(host,client,valid,{player:choice,back:dispose,backLabel:'Back to team roster',localMatches:true,scrollHost:dialog,hideRootBack:true,onPlayerChange:nextPlayer=>dialog.setAttribute('aria-label',`${nextPlayer.name} player profile`)})}catch{if(valid()){host.innerHTML='<p role="alert">The player profile could not be opened. Return to the roster and try again.</p>';backButton.focus()}}}
 void load();return {dispose,back,isOpen:()=>!disposed}
}
