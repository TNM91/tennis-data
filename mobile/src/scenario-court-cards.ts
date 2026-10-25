import {compareCaptainScenarios,type CaptainScenarioContext} from '../../lib/native-captain-scenario-contract'
import type {LineupPlan} from '../../lib/native-captain-lineup-contract'
import ui from '../generated/website-ui.json'
import {html} from './match-details'
export function scenarioCourtCards(ctx:CaptainScenarioContext,plans:LineupPlan[],changesOnly=false){
 const result=compareCaptainScenarios(ctx,plans[0],plans[1]),visible=result.rows.map((row,index)=>({row,index})).filter(({row})=>!changesOnly||row.changed)
 const cards=visible.map(({row:r,index})=>{
  const names=(side:number)=>plans[side].courts[index].players.map(key=>ctx.lineup.roster.find(p=>p.key===key)?.name||'Open seat').join(' / ')
  const rating=(side:typeof r.left)=>side.strength===null?'Rating unavailable · '+side.reason:`Average rating ${side.strength.toFixed(3)}`+(side.overall?' · Overall used for '+side.overall+(side.overall===1?' player':' players'):'')
  const maximum=Math.max(r.left.strength??0,r.right.strength??0,1),width=(v:number|null)=>String(Math.max(0,Math.min(100,(v??0)/maximum*100)))
  const fields:Record<string,string>={TIQ_COURT_LABEL:r.label,TIQ_COURT_LEFT:names(0),TIQ_COURT_RIGHT:names(1),TIQ_COURT_LEFTRATING:rating(r.left),TIQ_COURT_RIGHTRATING:rating(r.right),TIQ_COURT_LEFTWIDTH:width(r.left.strength),TIQ_COURT_RIGHTWIDTH:width(r.right.strength),TIQ_COURT_DIFFERENCE:r.defaulted?'Defaulted courts are not compared.':r.diff===null?'Both complete ratings are needed.':Math.abs(r.diff)<.0005?'Even rating strength.':`${r.diff>0?'A':'B'} has ${Math.abs(r.diff).toFixed(3)} more rating strength.`}
  return ui.scenarioCourts[Number(r.changed)].replace(/TIQ_COURT_[A-Z]+/g,key=>html(fields[key]??key))
 }).join('')
 return `<div class="website-ui website-scenario-courts"><h3>See the swaps court by court</h3><button type="button" class="secondary" data-scenario-changes aria-pressed="${changesOnly}">Changes only</button><p role="status">${visible.length} of ${result.rows.length} courts shown · ${result.changed} changed</p>${cards?ui.scenarioGrid.replace('TIQ_COURT_CARDS',cards):'<p>No changed courts in these alternatives.</p>'}</div>`
}
