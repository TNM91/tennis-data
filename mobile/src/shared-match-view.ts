import type {SupabaseClient} from '@supabase/supabase-js'
import {createMatchDetails} from './match-details'
import type {RecentMatchRow} from './recent-results'
import {isValidCalendarDate} from '../../lib/calendar-date'

export function readLinkedMatch(value:unknown,id:string,today:string):RecentMatchRow {
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Scorecard unavailable')
 const r=value as Record<string,unknown>
 if(r.id!==id||r.public_history_eligible!==true||typeof r.match_date!=='string'||!isValidCalendarDate(r.match_date.slice(0,10))||!Number.isFinite(Date.parse(r.match_date))||r.match_date.slice(0,10)>today||!['singles','doubles'].includes(String(r.match_type))||!['A','B',null].includes(r.winner_side as string|null))throw Error('Scorecard unavailable')
 for(const [field,max] of [['league_name',300],['score',500]] as const)if(r[field]!==null&&(typeof r[field]!=='string'||r[field].length>max))throw Error('Scorecard unavailable')
 return {id,match_date:r.match_date,match_type:String(r.match_type),league_name:r.league_name as string|null,score:r.score as string|null,winner_side:r.winner_side as string|null,match_players:[]}
}
export function openSharedMatch(client:SupabaseClient,owner:string,current:()=>boolean,id:string,trigger?:HTMLElement){
 const dialog=document.createElement('dialog')
 dialog.className='captain-lineup-dialog shared-match-dialog'
 dialog.setAttribute('aria-label','Shared match scorecard')
 dialog.innerHTML=`
  <div class="shared-match-toolbar">
   <span>Shared scorecard</span>
   <button type="button" class="secondary" aria-label="Close scorecard">Close</button>
  </div>
  <div class="shared-match-body"></div>
 `
 const host=dialog.querySelector<HTMLElement>('.shared-match-body')!
 const closeButton=dialog.querySelector<HTMLButtonElement>('.shared-match-toolbar button')!
 let disposed=false,busy=false,details:ReturnType<typeof createMatchDetails>|null=null
 const active=()=>!disposed&&current()
 const dispose=()=>{if(disposed)return;disposed=true;details?.dispose();dialog.close();dialog.remove();if(current()&&trigger?.isConnected)trigger.focus({preventScroll:true})}
 const read=async()=>{
  if(!active()||busy)return
  busy=true
  host.innerHTML='<h2 tabindex="-1">Match scorecard</h2><p role="status">Loading the recorded court…</p>'
  host.scrollTop=0
  host.querySelector('h2')!.focus({preventScroll:true})
  try{
   const session=await client.auth.getSession()
   if(!active())return
   if(session.error||session.data.session?.user.id!==owner)throw Error('Scorecard unavailable')
   const today=new Date().toISOString().slice(0,10)
   const {data,error}=await client.from('matches').select('id,match_date,match_type,league_name,score,winner_side,public_history_eligible').eq('id',id).eq('public_history_eligible',true).in('match_type',['singles','doubles']).lte('match_date',today).limit(1).abortSignal(AbortSignal.timeout(12000)).maybeSingle()
   if(!active())return;if(error)throw error
   const row=readLinkedMatch(data,id,today)
   const closeFocused=document.activeElement===closeButton
   host.innerHTML=''
   details=createMatchDetails(host,client,active,{neutral:true,local:true,scrollHost:host,externalBack:true})
   details.open(row,'')
   if(closeFocused)closeButton.focus({preventScroll:true})
  }catch{
   if(!active())return
   host.innerHTML='<h2 tabindex="-1">Scorecard unavailable</h2><p role="alert">This court may no longer be public, or your connection was interrupted.</p><button type="button" data-shared-retry>Try again</button>'
   host.querySelector<HTMLButtonElement>('[data-shared-retry]')!.onclick=()=>{void read()}
   if(document.activeElement!==closeButton)host.querySelector('h2')!.focus({preventScroll:true})
  }finally{
   busy=false
  }
 }
 closeButton.onclick=dispose
 dialog.oncancel=e=>{e.preventDefault();dispose()};document.body.append(dialog);dialog.showModal();void read()
 return {dispose,isOpen:()=>!disposed}
}
