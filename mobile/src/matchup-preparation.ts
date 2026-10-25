import type {ComparedPlayer} from './comparison-data'
import {readMatchupPrepDraft,type MatchupPrepDraft} from '../../lib/matchup-prep-note'
import {expectedScore,getConfidenceLabel,matchupCourtPlan} from '../../lib/matchup-preparation'
import {buildResumeMatchPrepHref} from '../../lib/resume-match-prep'
import type {LabGoal} from '../../lib/my-lab-goal-sync'
import websiteUi from '../generated/website-ui.json'
import {html} from './match-details'
export function comparisonPreparation(players:ComparedPlayer[]):MatchupPrepDraft|null{
 if(![2,4].includes(players.length)||new Set(players.map(p=>p.player.id)).size!==players.length)return null
 const doubles=players.length===4,view=doubles?'doubles':'singles'
 const ratings=players.map(p=>{const value=p.ratings?.[`${view}_dynamic_rating`]??p.ratings?.overall_dynamic_rating;return typeof value==='number'&&Number.isFinite(value)&&value>=1.5&&value<=7?value:null})
 if(ratings.some(r=>r===null))return null
 const values=ratings as number[],left=doubles?(values[0]+values[1])/2:values[0],right=doubles?(values[2]+values[3])/2:values[1]
 const leftLabel=players.slice(0,doubles?2:1).map(p=>p.player.name).join(' / '),rightLabel=players.slice(doubles?2:1).map(p=>p.player.name).join(' / ')
 const probability=expectedScore(left,right),favoriteProbability=Math.max(probability,1-probability),favorite=probability>=.5?leftLabel:rightLabel
 const id=(doubles?'doubles:':'singles:')+players.map(p=>p.player.id).join(':')
 if(id.length>180||!buildResumeMatchPrepHref('matchup-prep-'+id))return null
 return readMatchupPrepDraft(JSON.stringify({id,title:`Match prep: ${leftLabel} vs ${rightLabel}`,context:`${leftLabel} ${Math.round(probability*100)}% vs ${rightLabel} ${Math.round((1-probability)*100)}% - ${getConfidenceLabel(favoriteProbability)} confidence`,evidence:`Rating-based estimate using ${view} TIQ with Overall fallback. ${players.some(p=>p.ratings?.rating_source==='self')?'Includes self-rated records. ':''}Recent results shown separately are a limited sample; no shot patterns or complete head-to-head are inferred.`,courtPlan:matchupCourtPlan(favoriteProbability,favorite)}))
}
export function prepGoalFields(prep:MatchupPrepDraft):Partial<LabGoal>{return {goal:prep.title,progressStatus:'in-progress',progressUpdate:prep.context,doingWell:prep.evidence,improveNext:prep.courtPlan,notes:`Saved Match Prep\n\n${prep.evidence}\n\nCourt plan: ${prep.courtPlan}`}}
export function courtsideHtml(context:string,plan:string,doubles:boolean,prefix='comparison'){
 const values:Record<string,string>={TIQ_PREP_CONTEXT:context,TIQ_PREP_PLAN:plan}
 return '<div class="website-ui website-courtside">'+websiteUi.courtside[doubles?1:0].replace(/TIQ_PREP_(?:CONTEXT|PLAN)/g,key=>html(values[key])).replace(/(id|aria-controls)="([^"]+)"/g,(_,attribute,id)=>`${attribute}="${prefix}-${id}"`)+'</div>'
}
export function bindCourtside(host:HTMLElement,save?:()=>void){
 const toggle=host.querySelector<HTMLButtonElement>('button[aria-controls]'),content=Array.from(host.querySelectorAll<HTMLElement>('[id]')).find(e=>e.id===toggle?.getAttribute('aria-controls'))
 if(toggle&&content)toggle.onclick=()=>{content.hidden=!content.hidden;toggle.setAttribute('aria-expanded',String(!content.hidden));toggle.textContent=content.hidden?'Open courtside view':'Close courtside view'}
 const button=host.querySelector<HTMLButtonElement>('[data-native-ui-action="prep-save"]');if(button){if(save)button.onclick=save;else button.remove()}
}
