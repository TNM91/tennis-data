/** Published current USTA context only; never infer it from a dynamic estimate or flight. */
export function publishedUstaRating(player:{overall_rating?:unknown;rating_source?:string|null}|null|undefined):number|null {
 if(player?.rating_source!=='verified')return null
 const raw=player.overall_rating
 if(typeof raw!=='number'&&typeof raw!=='string'||typeof raw==='string'&&!raw.trim())return null
 const value=Number(raw)
 return Number.isFinite(value)&&value>=1.5&&value<=7&&Number.isInteger(value*2)?value:null
}
export function publishedUstaLabel(player:Parameters<typeof publishedUstaRating>[0]){
 const value=publishedUstaRating(player)
 return value===null?'Pending verification':value.toFixed(1)
}
