import type {SupabaseClient} from '@supabase/supabase-js'
import type {InternalNotification} from '../../lib/internal-notification-record'
import {html} from './match-details'
import websiteUi from '../generated/website-ui.json'
import {loadUpdates,markUpdatesRead,resolveUpdateAction,updateAction,UPDATE_LOADED_LIMIT,type UpdateFilter,type UpdateCursor,type ResolvedUpdateAction} from './updates-data'

export type UpdatesChild={dispose:()=>void;isOpen:()=>boolean;back?:()=>unknown}
export function openUpdates(client:SupabaseClient,owner:string,current:()=>boolean,refreshCount:()=>Promise<number|null>,open:(action:ResolvedUpdateAction,trigger:HTMLButtonElement,active:()=>boolean)=>UpdatesChild|null,trigger?:HTMLElement){
  const dialog=document.createElement('dialog');dialog.className='native-updates-screen';dialog.setAttribute('aria-label','Updates')
  let disposed=false,busy=false,loaded=false,failed=false,uncertain=false,notice='',total:number|null=null
  let rows:InternalNotification[]=[],cursor:UpdateCursor|null=null,more=false,review:string[]|null=null,child:UpdatesChild|null=null
  let filter:UpdateFilter={unread:false,category:'all'}
  const active=()=>!disposed&&current()
  const focus=()=>dialog.querySelector<HTMLElement>('h1')?.focus({preventScroll:true})
  const dispose=()=>{if(disposed)return;disposed=true;child?.dispose();child=null;rows=[];review=null;dialog.close();dialog.remove();if(current()&&trigger?.isConnected)trigger.focus({preventScroll:true})}
  const back=()=>{if(child?.isOpen()){if(child.back)child.back();else child.dispose();return true}if(review&&!busy){review=null;render();focus();return true}dispose();return true}
  const run=async(older=false)=>{
    if(!active()||busy||older&&(!more||rows.length>=UPDATE_LOADED_LIMIT))return
    busy=true;failed=false;review=null;notice=older?'Loading older updates…':'Refreshing your updates…'
    if(!older){rows=[];cursor=null;more=false;loaded=false}
    render(!older)
    try{
      const result=await loadUpdates(client,owner,active,filter,older?cursor:null)
      if(!active())return
      if(older&&result.rows.some(row=>rows.some(old=>old.id===row.id)))throw Error('Updates changed. Refresh to check the latest list.')
      rows=older?[...rows,...result.rows]:result.rows;cursor=result.cursor;more=result.more;loaded=true;uncertain=false
      if(!older)total=await refreshCount()
      if(!active())return
      notice=total===null?'Unread total is unavailable. You can still review these updates.':older?result.rows.length+' older updates loaded.':''
    }catch(error){if(active()){failed=true;notice=error instanceof Error?error.message:'Updates couldn’t load. Try again.'}}
    finally{if(active()){busy=false;render();focus()}}
  }
  const mark=async(ids:string[],action?:{row:InternalNotification;button:HTMLButtonElement})=>{
    if(!active()||busy||uncertain)return
    busy=true;review=null;notice=action?'Opening your update…':'Saving read status…';render()
    try{
      const target=action?updateAction(action.row):null
      const resolved=target?await resolveUpdateAction(client,owner,active,target):null
      if(action&&!resolved)throw Error('This update has no supported app destination.')
      if(!active())return
      if(ids.length){
        // Keep interrupted writes locked until the account has explicitly refreshed.
        uncertain=true
        const confirmed=await markUpdatesRead(client,owner,active,ids)
        if(!active())return
        rows=rows.map(row=>{const hit=confirmed.find(item=>item.id===row.id);return hit?{...row,readAt:hit.read_at}:row})
        if(filter.unread)rows=rows.filter(row=>!row.readAt)
        uncertain=false
        total=await refreshCount()
        if(!active())return
      }
      notice=!ids.length?'':ids.length===1?'Update marked read.':ids.length+' updates marked read.'
      if(resolved&&action){
        busy=false;render()
        const opener=dialog.querySelector<HTMLButtonElement>('[data-open-update="'+action.row.id+'"]')||dialog.querySelector<HTMLButtonElement>('[data-updates-close]')!
        child=open(resolved,opener,active)
        if(!active()){child?.dispose();child=null}
        return
      }
    }catch(error){if(active())notice=error instanceof Error?error.message:'Read status was not confirmed. Refresh before trying again.'}
    finally{if(active()){busy=false;if(!child?.isOpen())render();if(uncertain)focus()}}
  }
  const grouped=()=>{
    const today=new Date(),yesterday=new Date(today);yesterday.setDate(today.getDate()-1)
    const day=(date:Date)=>[date.getFullYear(),date.getMonth(),date.getDate()].join('-')
    let last=''
    return rows.map(row=>{
      const date=new Date(row.createdAt),group=day(date)===day(today)?'Today':day(date)===day(yesterday)?'Yesterday':'Earlier'
      const heading=group!==last?'<h2 class="updates-day">'+group+'</h2>':'';last=group
      const action=updateAction(row),kind=row.notificationType==='message'?'Message':row.notificationType==='schedule'?'Schedule':row.notificationType==='support'?'Support':'Account'
      const icon=row.notificationType==='message'?'teams':row.notificationType==='schedule'?'leagues':'alerts'
      return heading+`<article class="updates-item ${row.readAt?'':'is-unread'}" data-update="${row.id}"><div class="updates-item-icon" aria-hidden="true">${websiteUi.icons[icon]}</div><div class="updates-item-copy"><div class="updates-meta"><span>${kind}${row.readAt?'':' · Unread'}</span><time datetime="${html(row.createdAt)}">${html(date.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}))}</time></div><h3>${html(row.title||'Tennis update')}</h3>${row.body?'<p>'+html(row.body)+'</p>':''}<div class="updates-item-actions">${action?'<button type="button" data-open-update="'+row.id+'" '+(busy||uncertain?'disabled':'')+'>'+html(action.label)+' <span aria-hidden="true">›</span></button>':''}${!row.readAt?'<button type="button" class="secondary" data-read-update="'+row.id+'" '+(busy||uncertain?'disabled':'')+'>Mark read</button>':''}</div></div></article>`
    }).join('')
  }
  const render=(resetScroll=false)=>{
    if(!active())return
    const scrollTop=resetScroll?0:dialog.querySelector('.updates-body')?.scrollTop||0
    const unread=rows.filter(row=>!row.readAt)
    dialog.innerHTML=`<header class="updates-heading"><div><small class="stat-eyebrow">Your tennis</small><h1 tabindex="-1">Updates</h1></div><button type="button" class="secondary" data-updates-close>Close</button></header><div class="updates-body"><div class="updates-summary"><span class="updates-summary-icon" aria-hidden="true">${websiteUi.icons.alerts}</span><div><strong>${total===null?'Your latest updates':total===0?'No unread updates':total+' unread '+(total===1?'update':'updates')}</strong><p>Messages, schedule changes and account news.</p></div></div><div class="updates-filters"><div role="group" aria-label="Read status"><button type="button" data-updates-status="all" aria-pressed="${!filter.unread}" ${busy?'disabled':''}>All</button><button type="button" data-updates-status="unread" aria-pressed="${filter.unread}" ${busy?'disabled':''}>Unread</button></div><label>Type<select data-updates-category ${busy?'disabled':''}><option value="all" ${filter.category==='all'?'selected':''}>All types</option><option value="message" ${filter.category==='message'?'selected':''}>Messages</option><option value="schedule" ${filter.category==='schedule'?'selected':''}>Schedule</option><option value="other" ${filter.category==='other'?'selected':''}>Account & support</option></select></label></div><div class="updates-toolbar"><button type="button" class="secondary" data-updates-refresh ${busy?'disabled':''}>${failed?'Retry updates':'Refresh'}</button>${unread.length?'<button type="button" class="secondary" data-updates-review '+(busy||uncertain?'disabled':'')+'>Mark shown read</button>':''}</div>${review?'<section class="updates-review"><h2 tabindex="-1">Mark '+review.length+' '+(review.length===1?'update':'updates')+' read?</h2><p>Only these loaded updates will change. Older updates keep their current status.</p><ul>'+rows.filter(row=>review!.includes(row.id)).map(row=>'<li>'+html(row.title||'Tennis update')+'</li>').join('')+'</ul><button type="button" data-updates-confirm '+(busy?'disabled':'')+'>Mark '+review.length+' read</button><button type="button" class="secondary" data-updates-cancel '+(busy?'disabled':'')+'>Keep unread</button></section>':''}<p class="updates-notice" role="${failed||uncertain?'alert':'status'}">${html(notice)}</p><div class="updates-list" aria-label="Your updates">${grouped()}${loaded&&!rows.length?'<div class="updates-empty"><h2>'+(!filter.unread?'No updates in this view.':more?'No unread updates remain in this loaded batch.':'No unread updates in this view.')+'</h2><p>'+(more?'Load older updates to continue.':'Try another type or refresh when you’re ready.')+'</p></div>':''}</div>${more?rows.length<UPDATE_LOADED_LIMIT?'<button type="button" class="secondary updates-older" data-updates-older '+(busy||uncertain?'disabled':'')+'>Load older updates</button>':'<p class="updates-limit">100 updates loaded. Choose a type or refresh to see a different view.</p>':''}</div>`
    dialog.querySelector('[data-updates-close]')!.addEventListener('click',dispose)
    dialog.querySelector('[data-updates-refresh]')!.addEventListener('click',()=>{void run()})
    dialog.querySelector('[data-updates-older]')?.addEventListener('click',()=>{void run(true)})
    dialog.querySelectorAll<HTMLButtonElement>('[data-updates-status]').forEach(button=>{button.onclick=()=>{if(busy)return;filter={...filter,unread:button.dataset.updatesStatus==='unread'};void run()}})
    dialog.querySelector<HTMLSelectElement>('[data-updates-category]')!.onchange=event=>{if(busy)return;filter={...filter,category:(event.target as HTMLSelectElement).value as UpdateFilter['category']};void run()}
    dialog.querySelector('[data-updates-review]')?.addEventListener('click',()=>{review=unread.map(row=>row.id);render();dialog.querySelector<HTMLElement>('.updates-review h2')?.focus()})
    dialog.querySelector('[data-updates-cancel]')?.addEventListener('click',()=>{review=null;render();focus()})
    dialog.querySelector('[data-updates-confirm]')?.addEventListener('click',()=>{if(review)void mark([...review])})
    dialog.querySelectorAll<HTMLButtonElement>('[data-read-update]').forEach(button=>{button.onclick=()=>{const row=rows.find(row=>row.id===button.dataset.readUpdate);if(row)void mark([row.id])}})
    dialog.querySelectorAll<HTMLButtonElement>('[data-open-update]').forEach(button=>{button.onclick=()=>{const row=rows.find(row=>row.id===button.dataset.openUpdate);if(row)void mark(row.readAt?[]:[row.id],{row,button})}})
    dialog.querySelector('.updates-body')!.scrollTop=scrollTop
  }
  dialog.oncancel=event=>{event.preventDefault();back()}
  document.body.append(dialog);dialog.showModal();render();void run()
  return {dispose,back,isOpen:()=>!disposed,hasChild:()=>Boolean(child?.isOpen())}
}
