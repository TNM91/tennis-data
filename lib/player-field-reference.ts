import type {SupabaseClient} from '@supabase/supabase-js'
export type PlayerFieldReference={average:number;sample:number;total:number;limited:boolean}
export function parsePlayerFieldReference(rows:unknown,total:unknown):PlayerFieldReference|null {
  if(!Array.isArray(rows)||rows.length>501||typeof total!=='number'||!Number.isSafeInteger(total)||total<rows.length)return null
  const seen=new Set<string>(),values:number[]=[]
  for(const row of rows){if(!row||typeof row!=='object'||typeof row.id!=='string'||!row.id||seen.has(row.id)||typeof row.overall_dynamic_rating!=='number'||!Number.isFinite(row.overall_dynamic_rating)||row.overall_dynamic_rating<1.5||row.overall_dynamic_rating>7)return null;seen.add(row.id);values.push(row.overall_dynamic_rating)}
  const sample=values.slice(0,500);if(!sample.length)return null
  return {average:sample.reduce((sum,r)=>sum+r,0)/sample.length,sample:sample.length,total,limited:total>sample.length}
}
/** A bounded, stable Overall reference, never advertised as a population average when sampled. */
export async function loadPlayerFieldReference(client:SupabaseClient):Promise<PlayerFieldReference|null> {
  try{const {data,count,error}=await client.from('players').select('id,overall_dynamic_rating',{count:'exact'}).gte('overall_dynamic_rating',1.5).lte('overall_dynamic_rating',7).order('id',{ascending:true}).limit(501).abortSignal(AbortSignal.timeout(12000));return error?null:parsePlayerFieldReference(data,count)}catch{return null}
}
