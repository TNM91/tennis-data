import {matchResult,matchDate,type RecentMatchRow} from './recent-results'
import {html} from './match-details'
import {statDonutHtml} from './stat-donut'
/** The latest five decided individual courts from the already loaded sample. */
export function labRecentSample(rows:RecentMatchRow[],playerId:string){
 const seen=new Set<string>()
 return rows.flatMap((row,index)=>{
  const format=(row.match_type||'').trim().toLowerCase()
  if(!row.id||seen.has(row.id)||!['singles','doubles'].includes(format)||!Array.isArray(row.match_players)||!row.match_players.some(player=>player.player_id===playerId))return []
  seen.add(row.id)
  const outcome=matchResult(row,playerId)
  return outcome==='Result pending'?[]:[{row,index,outcome,format}]
 }).slice(0,5)
}
export function labRecentFormHtml(rows:RecentMatchRow[],playerId:string){
 const decided=labRecentSample(rows,playerId)
 if(!decided.length)return ''
 const wins=decided.filter(item=>item.outcome==='Won').length,percent=Math.round(wins/decided.length*100)
 return `<section class="lab-form-strip" aria-labelledby="lab-form-title"><div class="lab-form-heading"><h2 id="lab-form-title">Recent form</h2><span>${decided.length} decided</span></div><p>Latest ${decided.length} decided ${decided.length===1?'result':'results'} in your loaded matches</p><div class="lab-form-overview">${statDonutHtml(percent,'Wins in your latest '+decided.length+' decided individual results')}<div class="lab-form-record"><strong>${wins}W · ${decided.length-wins}L</strong><span>Decided win rate</span><dl>${(['singles','doubles'] as const).map(format=>{const sample=decided.filter(item=>item.format===format),won=sample.filter(item=>item.outcome==='Won').length;return `<div><dt>${format==='singles'?'Singles':'Doubles'}</dt><dd>${sample.length?won+'W · '+(sample.length-won)+'L':'No results'}</dd></div>`}).join('')}</dl></div></div><div class="lab-form-marks">${decided.map(({row,index,outcome,format})=>`<button type="button" class="secondary lab-form-mark ${outcome==='Won'?'is-win':'is-loss'}" data-lab-form-index="${index}" aria-label="${outcome} · ${html(matchDate(row.match_date))}. Open scorecard"><strong>${outcome==='Won'?'W':'L'}</strong><span>${format==='singles'?'Singles':'Doubles'}</span></button>`).join('')}</div><p class="lab-form-help">Newest first · tap a result for its scorecard</p></section>`
}

export function bindLabFormScorecards(host:HTMLElement,rows:RecentMatchRow[],current:()=>boolean,open:(row:RecentMatchRow)=>void){
 host.querySelectorAll<HTMLButtonElement>('[data-lab-form-index]').forEach(button=>{
  const index=Number(button.dataset.labFormIndex),row=Number.isSafeInteger(index)&&index>=0?rows[index]:undefined
  button.onclick=()=>{if(row&&current()&&host.isConnected&&button.isConnected&&host.contains(button))open(row)}
 })
}
