import {Clipboard} from '@capacitor/clipboard'
import {Share} from '@capacitor/share'
import type {NativeTeamRoom} from './team-room-data'
import {currentTeamPlan,ownTeamCourt,teamMatchOverview} from './team-hub'
import {matchDate} from './recent-results'
import {html} from './match-details'
export function matchShareDetails(room:NativeTeamRoom,owner:string){
 const match=teamMatchOverview(room);if(!match)throw Error('No upcoming match is available to share.')
 const plan=currentTeamPlan(room),court=plan?.card?.published?ownTeamCourt(room,owner):null
 const lines=[room.teamName,`Match: ${matchDate(match.matchDate)}`,`Opponent: ${match.opponent||'Not recorded'}`,`Time: ${match.matchTime||'Not recorded'}`,`Facility: ${match.facility||'Not recorded'}`,...(court?[`Court: ${court.courtLabel}`]:[]),'Check TenAceIQ for the latest team plan.']
 return {text:lines.join('\n'),key:JSON.stringify([room.id,room.teamName,room.leagueName,room.flight,plan?.id||'',plan?.card?.lineupVersion||0,plan?.card?.published===true,lines])}
}
export async function shareReviewedMatch(review:ReturnType<typeof matchShareDetails>,roomId:string,owner:string,read:()=>Promise<NativeTeamRoom>,current:()=>boolean,mode:'copy'|'share',write:typeof Clipboard.write=options=>Clipboard.write(options),share:typeof Share.share=options=>Share.share(options)){
 const room=await read();if(!current()||room.id!==roomId)throw Error('This team is no longer open.')
 const fresh=matchShareDetails(room,owner)
 if(fresh.key!==review.key||fresh.text!==review.text)return {sent:false,details:fresh}
 if(mode==='copy')await write({string:fresh.text});else await share({title:'TenAceIQ match details',text:fresh.text,dialogTitle:'Share match details'})
 return {sent:true,details:fresh}
}
/** Exact match text is reviewed before invoking existing native share/clipboard plugins. No clipboard read, roster, contacts, private captain notes or token links. */
export function openMatchPlanShare(owner:string,roomId:string,read:()=>Promise<NativeTeamRoom>,current:()=>boolean,canShare:typeof Share.canShare=()=>Share.canShare()){
 const dialog=document.createElement('dialog');dialog.className='chat-post-dialog';dialog.setAttribute('aria-label','Share match details')
 let disposed=false,busy=false,details:ReturnType<typeof matchShareDetails>|null=null,notice='',shareAvailable=false
 const active=()=>!disposed&&current(),close=()=>{disposed=true;details=null;dialog.remove()}
 const render=()=>{if(!active())return;dialog.innerHTML=`<h2 tabindex="-1">Share match details</h2><p>Review the text before copying it or choosing where to share it.</p>${details?`<pre class="match-share-preview">${html(details.text)}</pre><button type="button" data-copy ${busy?'disabled':''}>Copy match details</button>${shareAvailable?`<button type="button" class="secondary" data-share ${busy?'disabled':''}>Choose where to share</button>`:''}`:''}<p role="status" tabindex="-1">${html(notice)}</p><button type="button" class="secondary" data-refresh ${busy?'disabled':''}>Refresh match details</button><button type="button" class="secondary" data-close ${busy?'disabled':''}>Close</button>`
 dialog.querySelector<HTMLButtonElement>('[data-close]')!.onclick=close;dialog.querySelector<HTMLButtonElement>('[data-refresh]')!.onclick=()=>{void refresh()}
 for(const mode of ['copy','share'] as const)dialog.querySelector<HTMLButtonElement>(`[data-${mode}]`)?.addEventListener('click',()=>{void (async()=>{if(!active()||busy||!details)return;busy=true;notice='Checking the latest match details…';const reviewed=details;render();try{const result=await shareReviewedMatch(reviewed,roomId,owner,read,active,mode);if(active()){details=result.details;notice=result.sent?(mode==='copy'?'Match details copied.':'Share sheet closed. Check the destination you chose to confirm delivery.'):'Match details changed. Review them before copying or sharing.'}}catch{if(active()){details=null;notice='Couldn’t confirm current match details or complete this action. Refresh before trying again.'}}finally{if(active()){busy=false;render();dialog.querySelector<HTMLElement>('[role=status]')?.focus()}}})()})
 }
 const refresh=async()=>{if(!active()||busy)return;busy=true;details=null;notice='Checking the latest team match…';render();try{const room=await read();if(!active()||room.id!==roomId)throw Error('Team changed');details=matchShareDetails(room,owner);shareAvailable=(await canShare().catch(()=>({value:false}))).value;if(active())notice=''}catch{if(active())notice='Match details are unavailable. Your team access or match plan may have changed.'}finally{if(active()){busy=false;render();dialog.querySelector<HTMLElement>('h2')?.focus()}}}
 dialog.oncancel=event=>{event.preventDefault();if(!busy)close()};document.body.append(dialog);dialog.showModal();void refresh();return {dispose:close,isOpen:()=>!disposed}
}
