import {readLineupPlan,type LineupEditorData,type LineupPlan,type LineupCourt} from './native-captain-lineup-contract'
import {scenarioCourtStrength,type ScenarioRatingPlayer} from './captain-scenario-strength'
export type CaptainScenarioContext={owner:string;lineup:LineupEditorData;ratings:ScenarioRatingPlayer[];checkedAt:string}
export type CaptainScenarioSeed={baselineSignature:string;plan:LineupPlan}
export function scenarioBaselineSignature(data:LineupEditorData){return JSON.stringify([data.scope,data.match,data.version,data.sent,[...data.roster].sort((a,b)=>a.key.localeCompare(b.key)),readLineupPlan(data.plan,data.roster)])}
export function scenarioRatings(value:unknown,roster:LineupEditorData['roster']):ScenarioRatingPlayer[]{
 if(!Array.isArray(value)||value.length>250)throw Error('Ratings unavailable.')
 const ids=roster.map(p=>p.playerId).filter(Boolean)
 if(new Set(ids).size!==ids.length)throw Error('Roster identities need review.')
 const rows=value.map(v=>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Ratings unavailable.');const p=v as ScenarioRatingPlayer;if(typeof p.id!=='string'||!ids.includes(p.id)||(['singles_dynamic_rating','doubles_dynamic_rating','overall_dynamic_rating'] as const).some(k=>p[k]!==null&&(typeof p[k]!=='number'||!Number.isFinite(p[k])||p[k]<0||p[k]>10)))throw Error('Ratings unavailable.');return {id:p.id,singles_dynamic_rating:p.singles_dynamic_rating,doubles_dynamic_rating:p.doubles_dynamic_rating,overall_dynamic_rating:p.overall_dynamic_rating}})
 if(new Set(rows.map(p=>p.id)).size!==rows.length)throw Error('Ratings unavailable.')
 return rows.sort((a,b)=>a.id.localeCompare(b.id))
}
export function scenarioPlan(base:LineupEditorData,value:unknown){const p=readLineupPlan(value,base.roster),saved=readLineupPlan(base.plan,base.roster),shape=(courts:LineupCourt[])=>JSON.stringify(courts.map(({id,label,slotType,ratingLevel,defaulted})=>({id,label,slotType,ratingLevel,defaulted})))
 if(shape(p.courts)!==shape(saved.courts)||(['notes','location','directions','arrivalTime','teamNotes'] as const).some(k=>p[k]!==saved[k]))throw Error('Keep the saved court format and match details. Edit them in Plan lineup.')
 return p
}
function ratedCourt(court:LineupCourt,ctx:CaptainScenarioContext){
 if(court.defaulted)return {strength:null,overall:0,reason:'Defaulted court'}
 if(court.players.some(k=>!k))return {strength:null,overall:0,reason:'Open seat'}
 const ids=court.players.map(k=>ctx.lineup.roster.find(p=>p.key===k)?.playerId||''),rows=ids.map(id=>ctx.ratings.find(p=>p.id===id)),mode=court.slotType==='singles'?'singles_dynamic_rating':'doubles_dynamic_rating'
 if(ids.some(id=>!id)||new Set(ids).size!==ids.length||rows.some(p=>!p||p[mode]===null&&p.overall_dynamic_rating===null))return {strength:null,overall:0,reason:'Connected player or rating missing'}
 return {strength:scenarioCourtStrength(court.slotType,ids,ctx.ratings),overall:rows.filter(p=>p![mode]===null).length,reason:''}
}
export function compareCaptainScenarios(ctx:CaptainScenarioContext,left:LineupPlan,right:LineupPlan){
 const a=scenarioPlan(ctx.lineup,left),b=scenarioPlan(ctx.lineup,right),rows=a.courts.map((court,i)=>{const other=b.courts[i],left=ratedCourt(court,ctx),right=ratedCourt(other,ctx);return {id:court.id,label:court.label,slotType:court.slotType,changed:JSON.stringify([...court.players].sort())!==JSON.stringify([...other.players].sort()),left,right,diff:left.strength!==null&&right.strength!==null?left.strength-right.strength:null,defaulted:court.defaulted}})
 const played=rows.filter(r=>!r.defaulted),comparable=played.filter(r=>r.diff!==null),complete=played.length>0&&comparable.length===played.length
 return {rows,changed:rows.filter(r=>r.changed).length,comparable:comparable.length,played:played.length,meanDiff:complete?comparable.reduce((sum,r)=>sum+r.diff!,0)/played.length:null,biggest:[...comparable].sort((a,b)=>Math.abs(b.diff!)-Math.abs(a.diff!))[0]||null}
}
export function scenarioSeed(ctx:CaptainScenarioContext,plan:LineupPlan):CaptainScenarioSeed{return {baselineSignature:scenarioBaselineSignature(ctx.lineup),plan:structuredClone(scenarioPlan(ctx.lineup,plan))}}
export function applyScenarioSeed(fresh:LineupEditorData,seed:CaptainScenarioSeed){if(scenarioBaselineSignature(fresh)!==seed.baselineSignature)throw Error('The fixture, saved plan or roster changed. Refresh your alternatives.');return scenarioPlan(fresh,seed.plan)}
