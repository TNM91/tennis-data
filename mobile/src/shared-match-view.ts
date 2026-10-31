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
 const dialog=document.createElement('dialog');dialog.className='captain-lineup-dialog shared-match-dialog';dialog.setAttribute('aria-label','Shared match scorecard')
 const host=document.createElement('div');dialog.append(host)
 let disposed=false,busy=false,details:ReturnType<typeof createMatchDetails>|null=null
 const active=()=>!disposed&&current()
 const dispose=()=>{if(disposed)return;disposed=true;details?.dispose();dialog.close();dialog.remove();if(current()&&trigger?.isConnected)trigger.focus({preventScroll:true})}
 const read=async()=>{
  if(!active()||busy)return;busy=true
  host.innerHTML='<h2 tabindex="-1">Match scorecard</h2><p role="status">Loading the recorded court…</p><button type="button" data-shared-close>Close scorecard</button>'
  host.querySelector('button')!.onclick=dispose
  try{
   const session=await client.auth.getSession();if(session.error||session.data.session?.user.id!==owner||!active())return
   const today=new Date().toISOString().slice(0,10)
   const {data,error}=await client.from('matches').select('id,match_date,match_type,league_name,score,winner_side,public_history_eligible').eq('id',id).eq('public_history_eligible',true).in('match_type',['singles','doubles']).lte('match_date',today).limit(1).abortSignal(AbortSignal.timeout(12000)).maybeSingle()
   if(!active())return;if(error)throw error
   const row=readLinkedMatch(data,id,today)
   host.innerHTML='';details=createMatchDetails(host,client,active,{neutral:true,local:true,backLabel:'Close scorecard',scrollHost:dialog,onClose:dispose});details.open(row,'')
  }catch{if(active()){host.innerHTML='<h2 tabindex="-1">Scorecard unavailable</h2><p role="alert">This court may no longer be public, or your connection was interrupted.</p><button type="button" data-shared-retry>Try again</button><button type="button" class="secondary" data-shared-close>Close scorecard</button>';host.querySelector<HTMLButtonElement>('[data-shared-retry]')!.onclick=()=>{void read()};host.querySelector<HTMLButtonElement>('[data-shared-close]')!.onclick=dispose}}
  finally{if(active()){busy=false;host.querySelector<HTMLElement>('h2')?.focus()}}
 }
 dialog.oncancel=e=>{e.preventDefault();dispose()};document.body.append(dialog);dialog.showModal();void read()
 return {dispose,isOpen:()=>!disposed}
}
