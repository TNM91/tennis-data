import websiteUi from '../generated/website-ui.json'
import {html} from './match-details'
import {showExploreSearchEmpty} from './explore-search-empty'

export function competitionDirectoryHtml(kind:'league'|'tournament',query:string,busy:boolean,{controls='',count,resetLabel}: {
 controls?:string;count?:number;resetLabel?:string
} = {}) {
 const leagues=kind==='league'
 const label=leagues?'Find a TiQ league':'Find a tournament'
 const title=leagues?'Leagues':'Tournaments'
 const id=`${kind}-directory-search`
 const disabled=busy?' disabled':''
 const emptySearch=Boolean(query)&&count===0
 return `<div class="competition-directory">
  <div class="competition-directory-heading">
   <span aria-hidden="true">${websiteUi.icons[leagues?'leagues':'tournaments']}</span>
   <h2 tabindex="-1">${title}</h2>
  </div>
  ${controls}
  <form class="competition-search" role="search" aria-label="${leagues?'League search':'Tournament search'}">
   <label for="${id}">${label}</label>
   <div class="competition-search-fields">
    <input id="${id}" type="search" name="q" maxlength="80" enterkeyhint="search" value="${html(query)}"${disabled}>
    <button type="submit"${disabled}>Search</button>
   </div>
   ${query&&!emptySearch?`<button class="secondary competition-search-clear" type="reset"${disabled}>Clear search</button>`:''}
  </form>
  ${emptySearch?`<div data-competition-search-empty="${kind}" data-reset-label="${html(resetLabel||`Show all ${kind}s`)}"></div>`:
   count?`<p class="competition-search-results" tabindex="-1" data-competition-search-results>${count} ${kind}${count===1?'':'s'} shown</p>`:''}
 </div>`
}

export function bindCompetitionSearch(dialog:HTMLElement,onSearch:(query:string)=>void) {
 const form=dialog.querySelector<HTMLFormElement>('.competition-search')
 if(!form)return
 const input=form.querySelector<HTMLInputElement>('input')!
 form.addEventListener('submit',event=>{
  event.preventDefault()
  if(!input.disabled)onSearch(input.value.trim())
 })
 form.addEventListener('reset',event=>{
  event.preventDefault()
  if(!input.disabled)onSearch('')
 })
 const empty=dialog.querySelector<HTMLElement>('[data-competition-search-empty]')
 if(empty){
  const noun=empty.dataset.competitionSearchEmpty==='league'?'league':'tournament'
  showExploreSearchEmpty(empty,input,empty,{
   title:`No ${noun}s found`,
   detail:'Try a shorter name.',
   heading:'h3',
   reset:{label:empty.dataset.resetLabel!,search:()=>onSearch('')},
  })
 }
}

export function focusCompetitionSearchResults(dialog:HTMLElement) {
 const target=dialog.querySelector<HTMLElement>('[data-competition-search-results],[data-competition-search-empty] h3,.competition-empty h3')
 if(!target)return false
 target.tabIndex=-1
 target.focus()
 return true
}
