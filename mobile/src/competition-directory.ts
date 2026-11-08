import websiteUi from '../generated/website-ui.json'
import {html} from './match-details'

export function competitionDirectoryHtml(kind:'league'|'tournament',query:string,busy:boolean,controls='') {
 const leagues=kind==='league'
 const label=leagues?'Find a TiQ league':'Find a tournament'
 const title=leagues?'Leagues':'Tournaments'
 const id=`${kind}-directory-search`
 const disabled=busy?' disabled':''
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
   ${query?`<button class="secondary competition-search-clear" type="reset"${disabled}>Clear search</button>`:''}
  </form>
 </div>`
}

export function bindCompetitionSearch(dialog:HTMLElement,onSearch:(query:string)=>void) {
 const form=dialog.querySelector<HTMLFormElement>('.competition-search')
 if(!form)return
 form.addEventListener('submit',event=>{
  event.preventDefault()
  onSearch(String(new FormData(form).get('q')||'').trim())
 })
 form.addEventListener('reset',event=>{
  event.preventDefault()
  onSearch('')
 })
}
