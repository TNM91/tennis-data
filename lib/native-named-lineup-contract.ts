import {lineupRecord,type LineupEditorData,type LineupPlan} from './native-captain-lineup-contract'
import {savedSlots} from './native-saved-lineups-contract'
import {scenarioBaselineSignature,scenarioPlan} from './native-captain-scenario-contract'
import {isValidCalendarDate} from './calendar-date'
export type NamedLineupRequest=ReturnType<typeof readNamedLineupRequest>
const text=(v:unknown,max:number)=>{if(typeof v!=='string'||v.length>max||!v.trim())throw Error('Check the saved lineup details.');return v.trim()}
export function readNamedLineupRequest(value:unknown){
 const r=lineupRecord(value),s=lineupRecord(r.scope),m=lineupRecord(r.match),id=text(r.id,36).toLowerCase()
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))throw Error('Save identity unavailable.')
 const date=text(m.date,10);if(!isValidCalendarDate(date))throw Error('Choose a valid fixture.')
 const slots=savedSlots(r.slots);if(!slots.length)throw Error('Choose courts to save.')
 return {id,name:text(r.name,240),scope:{teamName:text(s.teamName,160),leagueName:text(s.leagueName,160),flight:typeof s.flight==='string'&&s.flight.length<=120?s.flight.trim():text(null,120)},match:{id:text(m.id,120),date,opponent:text(m.opponent,160)},baseline:text(r.baseline,50000),slots}
}
export function namedLineupRequest(base:LineupEditorData,plan:LineupPlan,name:string,id:string){
 const checked=scenarioPlan(base,plan),slots=checked.courts.map(c=>({...c,players:c.players.map(key=>{const p=base.roster.find(p=>p.key===key);if(key&&!p?.playerId)throw Error('Connect every selected player before saving to the library.');return {playerId:p?.playerId||'',playerName:p?.name||''}})}))
 return readNamedLineupRequest({id,name,scope:base.scope,match:base.match,baseline:scenarioBaselineSignature(base),slots})
}
export function namedLineupPayload(r:NamedLineupRequest,owner:string){return {id:r.id,owner_user_id:owner,scenario_name:r.name,team_name:r.scope.teamName,league_name:r.scope.leagueName,flight:r.scope.flight,match_date:r.match.date,opponent_team:r.match.opponent,slots_json:r.slots,opponent_slots_json:[],known_defaults_json:[],notes:null}}
export function assertNamedLineupBaseline(r:NamedLineupRequest,base:LineupEditorData){
 if(scenarioBaselineSignature(base)!==r.baseline||JSON.stringify(base.scope)!==JSON.stringify(r.scope)||JSON.stringify(base.match)!==JSON.stringify(r.match))throw Error('The working plan, roster or fixture changed. Refresh comparison.')
 const plan={...base.plan,courts:r.slots.map(s=>({...s,defaulted:Boolean(s.defaulted),players:s.players.map(p=>{if(!p.playerId&&!p.playerName)return '';const found=base.roster.filter(x=>x.playerId===p.playerId&&x.name===p.playerName);if(found.length!==1)throw Error('Roster identity changed.');return found[0].key})}))}
 const canonical=namedLineupRequest(base,plan,r.name,r.id);if(JSON.stringify(canonical)!==JSON.stringify(r))throw Error('Review this lineup again.')
}
export function namedLineupMatches(row:unknown,r:NamedLineupRequest,owner:string){const v=lineupRecord(row),expected=namedLineupPayload(r,owner);try{return Object.entries(expected).every(([k,value])=>k==='slots_json'?JSON.stringify(savedSlots(v[k]))===JSON.stringify(value):JSON.stringify(v[k])===JSON.stringify(value))}catch{return false}}
