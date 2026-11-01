import type {SupabaseClient} from '@supabase/supabase-js'
import type {InternalNotification} from '../../lib/internal-notification-record'
import {html} from './match-details'
import websiteUi from '../generated/website-ui.json'
import {createUpdatesFinder} from './updates-finder'
import {loadUpdates,markUpdatesRead,resolveUpdateAction,updateAction,UPDATE_LOADED_LIMIT,type UpdateFilter,type UpdateCursor,type ResolvedUpdateAction} from './updates-data'

export type UpdatesChild={dispose:()=>void;isOpen:()=>boolean;back?:()=>unknown}
export function openUpdates(client:SupabaseClient,owner:string,current:()=>boolean,refreshCount:()=>Promise<number|null>,open:(action:ResolvedUpdateAction,trigger:HTMLButtonElement,active:()=>boolean)=>UpdatesChild|null,trigger?:HTMLElement){
  const dialog=document.createElement('dialog');dialog.className='native-updates-screen';dialog.setAttribute('aria-label','Updates')
  let disposed=false,busy=false,loaded=false,failed=false,uncertain=false,notice='',total:number|null=null
  let rows:InternalNotification[]=[],cursor:UpdateCursor|null=null,more=false,review:string[]|null=null,child:UpdatesChild|null=null
  let filter:UpdateFilter={unread:false,category:'all'}
  let query='',queryRevision=0,indexedRows:InternalNotification[]|null=null,finder:ReturnType<typeof createUpdatesFinder>|null=null
  const shown=()=>{if(indexedRows!==rows){indexedRows=rows;finder=createUpdatesFinder(rows)}return finder!.find(query)}
  const active=()=>!disposed&&current()
  const focus=()=>dialog.querySelector<HTMLElement>('h1')?.focus({preventScroll:true})
  const focusKey=(element:Element|null=document.activeElement)=>{
    if(!(element instanceof HTMLElement)||!dialog.contains(element))return ''
    for(const key of ['data-updates-query','data-updates-clear','data-updates-refresh','data-updates-older','data-updates-status','data-updates-category','data-updates-review','data-read-update','data-open-update'])if(element.hasAttribute(key))return '['+key+'="'+CSS.escape(element.getAttribute(key)||'')+'"]'
    return ''
  }
  const restoreFocus=(key:string,fallback?:string)=>{
    const element=(key?dialog.querySelector<HTMLElement>(key):null)|| (fallback?dialog.querySelector<HTMLElement>(fallback):null)||dialog.querySelector<HTMLElement>('[data-updates-query]')
    if(element&&!element.matches(':disabled,[hidden]'))element.focus({preventScroll:true})
  }
  const dispose=()=>{if(disposed)return;disposed=true;child?.dispose();child=null;rows=[];review=null;query='';finder=null;indexedRows=null;dialog.close();dialog.remove();if(current()&&trigger?.isConnected)trigger.focus({preventScroll:true})}
  const back=()=>{if(child?.isOpen()){if(child.back)child.back();else child.dispose();return true}if(review&&!busy){review=null;render();restoreFocus("[data-updates-review]");return true}dispose();return true}
  const run=async(older=false,opener?:HTMLElement)=>{
    if(!active()||busy||older&&(!more||rows.length>=UPDATE_LOADED_LIMIT))return
    const returnTo=focusKey(opener),revision=queryRevision,previousIds=new Set(rows.map(row=>row.id))
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
    finally{if(active()){busy=false;render();if(opener&&queryRevision===revision||!dialog.contains(document.activeElement)||document.activeElement===dialog){const added=older?shown().find(row=>!previousIds.has(row.id)):null;if(added||returnTo)restoreFocus(added?'[data-update="'+added.id+'"] button':returnTo)}}}
  }
  const mark=async(ids:string[],action?:{row:InternalNotification;button:HTMLButtonElement})=>{
    if(!active()||busy||uncertain)return
    const returnTo=focusKey(),position=Math.max(0,shown().findIndex(row=>row.id===(action?.row.id||ids[0])))
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
    finally{if(active()){busy=false;if(!child?.isOpen()){render();if(uncertain)focus();else if(focusKey()!=='[data-updates-query=""]'){const next=shown()[Math.min(position,shown().length-1)];restoreFocus(returnTo,next?'[data-update="'+next.id+'"] button':undefined)}}}}
  }
  const grouped=()=>{
    const today=new Date(),yesterday=new Date(today);yesterday.setDate(today.getDate()-1)
    const day=(date:Date)=>[date.getFullYear(),date.getMonth(),date.getDate()].join('-')
    let last=''
    return shown().map(row=>{
      const date=new Date(row.createdAt),group=day(date)===day(today)?'Today':day(date)===day(yesterday)?'Yesterday':'Earlier'
      const heading=group!==last?'<h2 class="updates-day">'+group+'</h2>':'';last=group
      const action=updateAction(row),kind=row.notificationType==='message'?'Message':row.notificationType==='schedule'?'Schedule':row.notificationType==='support'?'Support':'Account'
      const icon=row.notificationType==='message'?'teams':row.notificationType==='schedule'?'leagues':'alerts'
      return heading+`<article class="updates-item ${row.readAt?'':'is-unread'}" data-update="${row.id}"><div class="updates-item-icon" aria-hidden="true">${websiteUi.icons[icon]}</div><div class="updates-item-copy"><div class="updates-meta"><span>${kind}${row.readAt?'':' · Unread'}</span><time datetime="${html(row.createdAt)}">${html(date.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}))}</time></div><h3>${html(row.title||'Tennis update')}</h3>${row.body?'<p>'+html(row.body)+'</p>':''}<div class="updates-item-actions">${action?'<button type="button" data-open-update="'+row.id+'" '+(busy||uncertain?'disabled':'')+'>'+html(action.label)+' <span aria-hidden="true">›</span></button>':''}${!row.readAt?'<button type="button" class="secondary" data-read-update="'+row.id+'" '+(busy||uncertain?'disabled':'')+'>Mark read</button>':''}</div></div></article>`
    }).join('')
  }
  const resultCount=()=>!loaded?failed?'Updates unavailable':'Loading updates…':query.trim()?shown().length+' of '+rows.length+' loaded updates':rows.length+' loaded updates'
  const results=()=>grouped()+(loaded&&!shown().length?'<div class="updates-empty"><h2>'+(query.trim()?'No matching updates loaded.':!filter.unread?'No updates in this view.':more?'No unread updates remain in this loaded batch.':'No unread updates in this view.')+'</h2><p>'+(more&&rows.length<UPDATE_LOADED_LIMIT?'Load older updates to continue.':query.trim()?'Try another search or clear it to see these loaded updates.':'Try another type or refresh when you’re ready.')+'</p></div>':'')
  const bindRows=()=>{
    const choose=(button:HTMLButtonElement,key:string,openRow:boolean)=>{button.onclick=()=>{if(!active()||!button.isConnected||child?.isOpen()||review)return;const row=shown().find(row=>row.id===button.getAttribute(key));if(row)void mark(openRow?(row.readAt?[]:[row.id]):[row.id],openRow?{row,button}:undefined)}}
    dialog.querySelectorAll<HTMLButtonElement>('[data-read-update]').forEach(button=>choose(button,'data-read-update',false))
    dialog.querySelectorAll<HTMLButtonElement>('[data-open-update]').forEach(button=>choose(button,'data-open-update',true))
  }
  const paintResults=()=>{
    if(!active()||child?.isOpen()||review)return
    dialog.querySelector('.updates-list')!.innerHTML=results()
    dialog.querySelector('[data-updates-matches]')!.textContent=resultCount()
    dialog.querySelector<HTMLButtonElement>('[data-updates-clear]')!.hidden=!query
    const bulk=dialog.querySelector<HTMLButtonElement>('[data-updates-review]')!
    bulk.hidden=!shown().some(row=>!row.readAt);bulk.disabled=busy||uncertain
    bindRows()
  }
  const render=(resetScroll=false)=>{
    if(!active())return
    const scrollTop=resetScroll?0:dialog.querySelector('.updates-body')?.scrollTop||0
    const unread=shown().filter(row=>!row.readAt)
    const retainedSearch=dialog.querySelector<HTMLElement>('.updates-search'),key=focusKey(),prior=dialog.querySelector<HTMLInputElement>('[data-updates-query]'),selection=prior?[prior.selectionStart,prior.selectionEnd]:null
    dialog.innerHTML=`<header class="updates-heading"><div><small class="stat-eyebrow">Your tennis</small><h1 tabindex="-1">Updates</h1></div><button type="button" class="secondary" data-updates-close>Close</button></header><div class="updates-body"><div class="updates-summary"><span class="updates-summary-icon" aria-hidden="true">${websiteUi.icons.alerts}</span><div><strong>${total===null?'Your latest updates':total===0?'No unread updates':total+' unread '+(total===1?'update':'updates')}</strong><p>Messages, schedule changes and account news.</p></div></div><div class="updates-filters"><div role="group" aria-label="Read status"><button type="button" data-updates-status="all" aria-pressed="${!filter.unread}" ${busy?'disabled':''}>All</button><button type="button" data-updates-status="unread" aria-pressed="${filter.unread}" ${busy?'disabled':''}>Unread</button></div><label>Type<select data-updates-category ${busy?'disabled':''}><option value="all" ${filter.category==='all'?'selected':''}>All types</option><option value="message" ${filter.category==='message'?'selected':''}>Messages</option><option value="schedule" ${filter.category==='schedule'?'selected':''}>Schedule</option><option value="other" ${filter.category==='other'?'selected':''}>Account & support</option></select></label></div><div class="updates-search"><label for="updates-query">Find an update</label><div class="updates-search-field"><input id="updates-query" data-updates-query type="search" maxlength="160" autocomplete="off" placeholder="Search titles and previews" aria-describedby="updates-search-help" value="${html(query)}"><button type="button" class="secondary" data-updates-clear ${query?'':'hidden'}>Clear</button></div><p id="updates-search-help">Search loaded updates. Load older updates to include more.</p><p data-updates-matches role="status" aria-live="polite" aria-atomic="true">${resultCount()}</p></div><div class="updates-toolbar"><button type="button" class="secondary" data-updates-refresh ${busy?'disabled':''}>${failed?'Retry updates':'Refresh'}</button><button type="button" class="secondary" data-updates-review ${unread.length?'':'hidden'} ${busy||uncertain||review?'disabled':''}>Mark shown read</button></div>${review?'<section class="updates-review"><h2 tabindex="-1">Mark '+review.length+' '+(review.length===1?'update':'updates')+' read?</h2><p>Only these loaded updates will change. Older updates keep their current status.</p><ul>'+rows.filter(row=>review!.includes(row.id)).map(row=>'<li>'+html(row.title||'Tennis update')+'</li>').join('')+'</ul><button type="button" data-updates-confirm '+(busy?'disabled':'')+'>Mark '+review.length+' read</button><button type="button" class="secondary" data-updates-cancel '+(busy?'disabled':'')+'>Keep unread</button></section>':''}<p class="updates-notice" role="${failed||uncertain?'alert':'status'}">${html(notice)}</p><div class="updates-list" aria-label="Your updates">${results()}</div>${more?rows.length<UPDATE_LOADED_LIMIT?'<button type="button" class="secondary updates-older" data-updates-older '+(busy||uncertain?'disabled':'')+'>Load older updates</button>':'<p class="updates-limit">100 updates loaded. Choose a type or refresh to see a different view.</p>':''}</div>`
    if(retainedSearch)dialog.querySelector('.updates-search')!.replaceWith(retainedSearch)
    const input=dialog.querySelector<HTMLInputElement>('[data-updates-query]')!,clear=dialog.querySelector<HTMLButtonElement>('[data-updates-clear]')!
    if(input.value!==query)input.value=query
    input.disabled=Boolean(review);clear.disabled=Boolean(review);clear.hidden=!query
    dialog.querySelector('[data-updates-matches]')!.textContent=resultCount()
    input.oninput=()=>{if(!active()||child?.isOpen()||review)return;query=input.value.slice(0,160);queryRevision++;if(input.value!==query)input.value=query;paintResults()}
    const clearSearch=()=>{if(!active()||child?.isOpen()||review)return;query='';queryRevision++;input.value='';paintResults();input.focus({preventScroll:true})}
    clear.onclick=clearSearch
    input.onkeydown=event=>{if(event.key==='Escape'&&query&&!review){event.preventDefault();event.stopPropagation();clearSearch()}}
    if(key){restoreFocus(key);if(key==='[data-updates-query=""]'&&selection&&selection[0]!==null&&selection[1]!==null)input.setSelectionRange(selection[0],selection[1])}
    dialog.querySelector('[data-updates-close]')!.addEventListener('click',dispose)
    const refresh=dialog.querySelector<HTMLButtonElement>('[data-updates-refresh]')!,older=dialog.querySelector<HTMLButtonElement>('[data-updates-older]')
    refresh.onclick=()=>{void run(false,refresh)}
    if(older)older.onclick=()=>{void run(true,older)}
    dialog.querySelectorAll<HTMLButtonElement>('[data-updates-status]').forEach(button=>{button.onclick=()=>{if(busy)return;filter={...filter,unread:button.dataset.updatesStatus==='unread'};void run()}})
    dialog.querySelector<HTMLSelectElement>('[data-updates-category]')!.onchange=event=>{if(busy)return;filter={...filter,category:(event.target as HTMLSelectElement).value as UpdateFilter['category']};void run()}
    dialog.querySelector('[data-updates-review]')?.addEventListener('click',()=>{if(!active()||busy||uncertain||review||child?.isOpen())return;const ids=shown().filter(row=>!row.readAt).map(row=>row.id);if(!ids.length)return;review=ids;render();dialog.querySelector<HTMLElement>('.updates-review h2')?.focus()})
    dialog.querySelector('[data-updates-cancel]')?.addEventListener('click',()=>{review=null;render();restoreFocus('[data-updates-review]')})
    dialog.querySelector('[data-updates-confirm]')?.addEventListener('click',()=>{if(review)void mark([...review])})
    bindRows()
    dialog.querySelector('.updates-body')!.scrollTop=scrollTop
  }
  dialog.oncancel=event=>{event.preventDefault();back()}
  document.body.append(dialog);dialog.showModal();render();focus();void run()
  return {dispose,back,isOpen:()=>!disposed,hasChild:()=>Boolean(child?.isOpen())}
}
