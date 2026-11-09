export function competitionFiltersHtml(view:'draw'|'schedule'|'results'|'standings',form:string,activeCount:number) {
 return `<details class="competition-filter-disclosure ${view}-filters"${activeCount?' open':''}>
  <summary><span>Filter ${view}</span>${activeCount?`<small>${activeCount} active</small>`:''}</summary>
  ${form}
 </details>`
}

export function competitionMatchFilterEmptyHtml(view:'draw'|'schedule'|'results') {
 const label={draw:'Show full draw',schedule:'Show all matches',results:'Show all results'}[view]
 return `<div class="competition-empty">
  <h4>No matches fit these filters</h4>
  <button type="button" class="secondary" data-competition-clear-match-filters>${label}</button>
 </div>`
}
