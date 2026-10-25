export type ScenarioRatingPlayer={id:string;singles_dynamic_rating:number|null;doubles_dynamic_rating:number|null;overall_dynamic_rating:number|null}
/** Canonical saved-scenario court strength: mode rating, then Overall; doubles average. */
export function scenarioCourtStrength(slotType:'singles'|'doubles',playerIds:string[],players:ScenarioRatingPlayer[]){
 const resolved=playerIds.map(id=>players.find(p=>p.id===id)).filter(Boolean) as ScenarioRatingPlayer[]
 if(!resolved.length)return null
 if(slotType==='singles')return resolved[0].singles_dynamic_rating??resolved[0].overall_dynamic_rating
 const values=resolved.map(p=>p.doubles_dynamic_rating??p.overall_dynamic_rating).filter((v):v is number=>typeof v==='number')
 return values.length?values.reduce((a,b)=>a+b,0)/values.length:null
}
