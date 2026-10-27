import {Clipboard} from '@capacitor/clipboard'
import {Share} from '@capacitor/share'
import type {SupabaseClient} from '@supabase/supabase-js'
import {html} from './match-details'
import {readPublicScorecardShare,type PublicScorecardShare} from './match-scorecard-share-data'
export async function shareReviewedScorecard(review:PublicScorecardShare,read:()=>Promise<PublicScorecardShare>,current:()=>boolean,mode:'copy'|'share',write:typeof Clipboard.write=options=>Clipboard.write(options),share:typeof Share.share=options=>Share.share(options)){
 const fresh=await read();if(!current())throw Error('Match visit closed.')
 if(fresh.key!==review.key||fresh.text!==review.text||fresh.url!==review.url||fresh.title!==review.title)return {done:false,review:fresh}
 if(mode==='copy')await write({string:fresh.text+'\n'+fresh.url});else await share({title:fresh.title,text:fresh.text,url:fresh.url,dialogTitle:'Share tennis scorecard'})
 return {done:true,review:fresh}
}
export function openScorecardShare(client:SupabaseClient,matchId:string,playerId:string,current:()=>boolean,canShare:typeof Share.canShare=()=>Share.canShare()){
 const previous=document.activeElement instanceof HTMLElement?document.activeElement:null,dialog=document.createElement('dialog');dialog.className='chat-post-dialog scorecard-share-dialog';dialog.setAttribute('aria-label','Share public scorecard')
 let disposed=false,busy=false,review:PublicScorecardShare|null=null,available=false,notice=''
 const active=()=>!disposed&&current(),close=()=>{if(disposed)return;disposed=true;review=null;dialog.remove();if(current()&&previous?.isConnected)previous.focus({preventScroll:true})}
 const read=()=>readPublicScorecardShare(client,matchId,playerId,active)
 const render=()=>{if(!active())return;dialog.innerHTML=`<h2 tabindex="-1">Share public scorecard</h2><p>Review the recorded details and public link before copying or choosing where to share.</p>${review?`<pre class="match-share-preview">${html(review.text)}</pre><p class="scorecard-share-url">${html(review.url)}</p><p>This is a public scorecard link. Its availability can change. No team messages, private notes or sign-in tokens are included.</p><button type="button" data-copy ${busy?'disabled':''}>Copy scorecard details</button>${available?`<button type="button" class="secondary" data-share ${busy?'disabled':''}>Choose where to share</button>`:''}`:''}<p role="status" tabindex="-1">${html(notice)}</p><button type="button" class="secondary" data-refresh ${busy?'disabled':''}>Refresh public scorecard</button><button type="button" class="secondary" data-close ${busy?'disabled':''}>Back to match details</button>`
 dialog.querySelector<HTMLButtonElement>('[data-close]')!.onclick=close;dialog.querySelector<HTMLButtonElement>('[data-refresh]')!.onclick=()=>{void refresh()}
 for(const mode of ['copy','share'] as const)dialog.querySelector<HTMLButtonElement>(`[data-${mode}]`)?.addEventListener('click',()=>{void (async()=>{if(!active()||busy||!review)return;const checked=review;busy=true;notice='Checking the current public scorecard...';render();try{const result=await shareReviewedScorecard(checked,read,active,mode);if(active()){review=result.review;notice=result.done?(mode==='copy'?'Scorecard details copied.':'Share sheet closed. Check the destination you chose to confirm delivery.'):'This scorecard changed. Review the updated preview before copying or sharing again.'}}catch{if(active()){review=null;notice='The public result could not be confirmed or sharing did not finish. Refresh to try again.'}}finally{if(active()){busy=false;render();dialog.querySelector<HTMLElement>('[role=status]')?.focus()}}})()})
 }
 const refresh=async()=>{if(!active()||busy)return;busy=true;review=null;notice='Checking the public scorecard...';render();try{const checked=await read();if(!active())return;available=(await canShare().catch(()=>({value:false}))).value;if(active()){review=checked;notice=''}}catch{if(active())notice='A current public scorecard is unavailable. This match may be private, changed or unavailable to your account.'}finally{if(active()){busy=false;render();dialog.querySelector<HTMLElement>('h2')?.focus()}}}
 dialog.oncancel=event=>{event.preventDefault();if(!busy)close()};document.body.append(dialog);dialog.showModal();void refresh();return {dispose:close,isOpen:()=>!disposed}
}
