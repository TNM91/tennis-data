import {matchResult,matchDate,type RecentMatchRow} from './recent-results'
import {html} from './match-details'
/** Only confirmed results from the already loaded latest ten; never a full-record claim. */
export function labRecentFormHtml(rows:RecentMatchRow[],playerId:string){
 const decided=rows.flatMap((row,index)=>{if(!Array.isArray(row.match_players))return [];const outcome=matchResult(row,playerId);return outcome==='Result pending'?[]:[{row,index,outcome}]}).slice(0,5)
 if(!decided.length)return ''
 const wins=decided.filter(item=>item.outcome==='Won').length
 return `<section class="lab-form-strip" aria-labelledby="lab-form-title"><div class="lab-form-heading"><h2 id="lab-form-title">Recent form</h2><span>${wins}W · ${decided.length-wins}L</span></div><p>Latest ${decided.length} decided ${decided.length===1?'result':'results'} in your loaded matches</p><div class="lab-form-marks">${decided.map(({row,index,outcome})=>`<button type="button" class="secondary lab-form-mark ${outcome==='Won'?'is-win':'is-loss'}" data-lab-form-index="${index}" aria-label="${outcome} · ${html(matchDate(row.match_date))}. Open scorecard"><strong>${outcome==='Won'?'W':'L'}</strong><span>${html(row.match_type==='singles'?'Singles':row.match_type==='doubles'?'Doubles':'Match')}</span></button>`).join('')}</div></section>`
}
