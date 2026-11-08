import {html} from './match-details'
import {nativeActionIcon} from './native-action-icons'

export function showExploreSearchEmpty(host:HTMLElement,input:HTMLInputElement,status:HTMLElement,{title,detail,reset}:{
 title:string
 detail:string
 reset?:{label:string;search:()=>void}
}){
 host.innerHTML=`<section class="explore-search-empty">
  <span class="explore-search-empty-icon" aria-hidden="true">${nativeActionIcon('search')}</span>
  <div><h2>${html(title)}</h2><p>${html(detail)}</p></div>
  <div class="explore-search-empty-actions">
   <button type="button" class="secondary" data-explore-edit-search>Edit search</button>
   ${reset?`<button type="button" class="secondary" data-explore-reset-search>${html(reset.label)}</button>`:''}
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
}
