import {coachOwner} from './native-coach'
import {createTacticalTemplate} from '../../lib/tactical/templates'
import {readTacticsIntent} from '../../lib/native-tactics-contract'
import type {TacticalScenarioSummary} from '../../lib/tactical/scenarioStorage'
const saved={...createTacticalTemplate('poach'),id:'saved-poach',name:'Saturday poach pattern'}
const rows:TacticalScenarioSummary[]=[{id:saved.id,name:saved.name,focus:saved.focus,scenario:saved,updatedAt:'2026-10-31T06:00:00.123456Z'}]
let lose=false,writes=0
export function tacticsPreviewControls(host:HTMLElement){host.insertAdjacentHTML('beforeend','<button type="button" data-tactics-lose>Lose next tactics confirmation</button><p data-tactics-writes>Tactics writes: 0</p>');host.querySelector('[data-tactics-lose]')?.addEventListener('click',()=>{lose=true})}
export function tacticsPreviewRequest(method:string,url:URL,body?:BodyInit|null){
 let id=url.searchParams.get('id')||''
 if(method!=='GET'){
  const draft=readTacticsIntent(JSON.parse(String(body)));id=draft.action==='save'?draft.scenario.id:draft.id
  const row=rows.find(r=>r.id===id)
  writes++;const count=document.querySelector('[data-tactics-writes]');if(count)count.textContent='Tactics writes: '+writes
  if(draft.action==='delete'){if(!row||row.updatedAt!==draft.expectedUpdatedAt)return Response.json({}, {status:409});rows.splice(rows.indexOf(row),1)}
  else{if((row?.updatedAt??null)!==draft.expectedUpdatedAt)return Response.json({}, {status:409});const next={id,name:draft.scenario.name,focus:draft.scenario.focus,scenario:draft.scenario,updatedAt:new Date(Math.max(Date.now(),row?Date.parse(row.updatedAt)+1:0)).toISOString()};if(row)rows.splice(rows.indexOf(row),1);rows.unshift(next)}
  if(lose){lose=false;throw Error('Synthetic tactics confirmation lost')}
 }
 return Response.json({ok:true,owner:coachOwner,scenarios:rows,more:false,detail:rows.find(row=>row.id===id)||null})
}
