import type {SupabaseClient} from '@supabase/supabase-js'
import {getCoachAssignmentDueState} from '../../lib/coach-storage'
import {formatWeekdayDate} from '../../lib/captain-formatters'
import websiteUi from '../generated/website-ui.json'
import {loadTrainingCoachWork,trainingAssignmentQueue,type TrainingCoachWork} from './training-inbox-data'

const cacheMs=5*60_000
export function createCoachNextAssignment(client:SupabaseClient,currentOwner:()=>string|undefined){
 let cached:{owner:string;expires:number;read:Promise<TrainingCoachWork|null>}|null=null
 const clear=()=>{cached=null}
 const mount=(host:HTMLElement,owner:string,current:()=>boolean,open:(button:HTMLButtonElement,id:string)=>void)=>{
  host.innerHTML=`<button type="button" class="secondary app-tool">
   <span class="app-tool-icon" aria-hidden="true">${websiteUi.icons.inbox}</span>
   <span class="app-tool-copy"><small>Next assignment</small><strong></strong><span data-assignment-due></span>
    <span class="lab-next-action">View assignment</span></span>
   <span aria-hidden="true">›</span>
  </button>`
  const button=host.querySelector<HTMLButtonElement>('button')!
  const title=button.querySelector('strong')!
  const due=button.querySelector<HTMLElement>('[data-assignment-due]')!
  const active=()=>host.isConnected&&current()
  let assignmentId:string|undefined
  const paint=(work:TrainingCoachWork|null)=>{
   if(!active())return
   const now=new Date()
   const next=work?trainingAssignmentQueue(work,now).active[0]:undefined
   assignmentId=next?.id
   if(!next&&button===document.activeElement){
    host.parentElement?.querySelector<HTMLElement>('[data-app-destination="training-inbox"]')?.focus({preventScroll:true})
   }
   host.hidden=!next
   if(!next)return
   const state=getCoachAssignmentDueState(next.dueDate,now)
   const link=work?.links.find(item=>item.id===next.studentLinkId)
   title.textContent=next.title
   due.textContent=[
    state.tone==='future'&&next.dueDate?`Due ${formatWeekdayDate(next.dueDate)}`:state.label,
    link?.status==='paused'?'Coach connection paused':'',
   ].filter(Boolean).join(' · ')
  }
  button.onclick=()=>{if(active()&&assignmentId)open(button,assignmentId)}

  if(cached?.owner!==owner||Date.now()>=cached.expires){
   const read=loadTrainingCoachWork(client,owner,()=>currentOwner()===owner).catch(()=>null)
   cached={owner,expires:Date.now()+cacheMs,read}
  }
  const entry=cached
  void entry.read.then(work=>{
   if(cached!==entry)return
   if(!work)entry.expires=Math.min(entry.expires,Date.now()+30_000)
   paint(work)
  })
  return (work:TrainingCoachWork|null)=>{
   if(!active())return
   cached=work?{owner,expires:Date.now()+cacheMs,read:Promise.resolve(work)}:null
   paint(work)
  }
 }
 return {mount,clear}
}
