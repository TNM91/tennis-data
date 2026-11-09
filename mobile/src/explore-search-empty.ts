import {html} from './match-details'
import {nativeActionIcon} from './native-action-icons'

export function showExploreSearchEmpty(host:HTMLElement,input:HTMLInputElement,status:HTMLElement,{title,detail,reset,action,heading='h2'}:{
 title:string
 detail:string
 heading?:'h2'|'h3'
 reset?:{label:string;search:()=>void}
 action?:{label:string;open:(trigger:HTMLButtonElement)=>void}
}){
 host.innerHTML=`<section class="explore-search-empty">
  <span class="explore-search-empty-icon" aria-hidden="true">${nativeActionIcon('search')}</span>
  <div><${heading}>${html(title)}</${heading}><p>${html(detail)}</p></div>
  <div class="explore-search-empty-actions">
   <button type="button" class="secondary" data-explore-edit-search>Edit search</button>
   ${reset?`<button type="button" class="secondary" data-explore-reset-search>${html(reset.label)}</button>`:''}
   ${action?`<button type="button" class="secondary" data-empty-search-action>${html(action.label)}</button>`:''}
  </div>
 </section>`
 host.querySelector<HTMLButtonElement>('[data-explore-edit-search]')!.onclick=()=>{
  input.focus()
  input.select()
 }
 if(reset)host.querySelector<HTMLButtonElement>('[data-explore-reset-search]')!.onclick=()=>{
  input.value=''
  status.tabIndex=-1
  status.focus()
  reset.search()
 }
 const actionButton=host.querySelector<HTMLButtonElement>('[data-empty-search-action]')
 if(actionButton&&action)actionButton.onclick=()=>action.open(actionButton)
}
