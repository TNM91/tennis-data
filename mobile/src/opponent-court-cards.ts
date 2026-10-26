import {compareOpponentScenarios,type OpponentScenarioContext,type OpponentAssumptions} from '../../lib/native-opponent-scenario-contract'
import type {CaptainScenarioContext} from '../../lib/native-captain-scenario-contract'
import type {LineupPlan} from '../../lib/native-captain-lineup-contract'
import ui from '../generated/website-ui.json'
import {html} from './match-details'
export function opponentCourtCards(own:CaptainScenarioContext,opp:OpponentScenarioContext,plans:LineupPlan[],drafts:OpponentAssumptions[],changesOnly=false){
 const result=compareOpponentScenarios(own,opp,plans[0],plans[1],drafts[0],drafts[1]),rows=result.rows.map((row,index)=>({row,index,changed:row.changed||JSON.stringify([...drafts[0].courts[index].players].sort())!==JSON.stringify([...drafts[1].courts[index].players].sort())})),visible=rows.filter(r=>!changesOnly||r.changed)
 const cards=visible.map(({row:r,index,changed})=>{
  const maximum=Math.max(r.left.strength??0,r.right.strength??0,r.opponentA.strength??0,r.opponentB.strength??0,1),width=(value:number|null)=>String(Math.max(0,Math.min(100,(value??0)/maximum*100)))
  return ([0,1] as const).map(side=>{
   const mine=side===0?r.left:r.right,theirs=side===0?r.opponentA:r.opponentB,margin=side===0?r.marginA:r.marginB
   const ownNames=plans[side].courts[index].players.map(key=>own.lineup.roster.find(p=>p.key===key)?.name||'Open seat').join(' / '),oppNames=drafts[side].courts[index].players.map(id=>opp.records.players.find(p=>p.id===id)?.name||'Open assumption').join(' / ')
   const rating=(strength:number|null,overall:number,reason:string)=>r.defaulted?'Not rated · Defaulted court':strength===null?'Rating unavailable · '+reason:`Average rating ${strength.toFixed(3)}`+(overall?' · Overall used for '+overall+(overall===1?' player':' players'):'')
   const fields:Record<string,string>={TIQ_OPP_HEADING:r.label+' · Alternative '+(side===0?'A':'B'),TIQ_OPP_OWN:ownNames,TIQ_OPP_THEIRS:oppNames,TIQ_OPP_OWNRATING:rating(mine.strength,mine.overall,mine.reason),TIQ_OPP_THEIRRATING:rating(theirs.strength,theirs.overall,drafts[side].courts[index].players.some(id=>!id)?'Open assumption':'Connected player or rating missing'),TIQ_OPP_OWNWIDTH:width(r.defaulted?null:mine.strength),TIQ_OPP_THEIRWIDTH:width(r.defaulted?null:theirs.strength),TIQ_OPP_MARGIN:r.defaulted?'Your working court is defaulted; no matchup margin.':margin===null?'Rating margin unavailable; complete both courts and ratings.':'Rating margin '+(Math.abs(margin)<.0005?'0.000':(margin>0?'+':'')+margin.toFixed(3))}
   return ui.opponentCourts[Number(changed)].replace(/TIQ_OPP_[A-Z]+/g,key=>html(fields[key]??key))
  }).join('')
 }).join('')
 return `<div class="website-ui website-opponent-courts"><h3>Your courts and assumed opponents</h3><button type="button" class="secondary" data-scenario-changes aria-pressed="${changesOnly}">Changes only</button><p role="status">${visible.length} of ${rows.length} courts shown · ${rows.filter(r=>r.changed).length} changed in your assignments or opponent assumptions</p><p>Bars use the same rating scale across A and B for each court. Current TIQ strength does not confirm availability or eligibility.</p>${cards?ui.scenarioGrid.replace('TIQ_COURT_CARDS',cards):'<p>No changed courts or opponent assumptions in these alternatives.</p>'}</div>`
}
