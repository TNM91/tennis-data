export function competitionFiltersHtml(view:'draw'|'schedule'|'results'|'standings',form:string,activeCount:number) {
 return `<details class="competition-filter-disclosure ${view}-filters"${activeCount?' open':''}>
  <summary><span>Filter ${view}</span>${activeCount?`<small>${activeCount} active</small>`:''}</summary>
  ${form}
 </details>`
}
