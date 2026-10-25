export type RatingDeltaRow={player_id:string;rating_type:string;delta:number|null}
// Keep the website's rule: take five snapshots first, then skip missing deltas.
export function sumLastFiveRatingDeltas(rows:readonly RatingDeltaRow[],id:string,view:string){
 const deltas=rows.filter(s=>s.player_id===id&&s.rating_type===view).slice(0,5).map(s=>s.delta).filter((d):d is number=>d!=null)
 return deltas.length?Math.round(deltas.reduce((sum,d)=>sum+d,0)*1000)/1000:null
}
