import type {SupabaseClient} from '@supabase/supabase-js'
import {CapacitorHttp} from '@capacitor/core'
import {getTiqEvidence,type TiqEvidenceShape} from '../../lib/tiq-rating-evidence'
import {unknownImportFreshness,type PlayerImportFreshness} from '../../lib/player-import-freshness'
import {parsePerformancePlayer} from './player-performance-data'
import {playerPublishedBaseline} from '../../lib/player-performance'
import {formatRatingValue,type RatingView,type PlayerRatingShape} from '../../lib/player-rating-display'
export type ProfileHeaderPlayer=PlayerRatingShape&TiqEvidenceShape&{id:string;name:string;location:string|null;flight:string|null;rating_source:string|null}
export function parseProfileHeaderPlayer(value:unknown,id:string):ProfileHeaderPlayer|null {
 if(!value||typeof value!=='object'||Array.isArray(value))return null
 const r=value as Record<string,unknown>,ratings=parsePerformancePlayer(r,id);if(!ratings||typeof r.name!=='string'||!r.name.trim()||r.name.length>200)return null
 for(const field of ['location','flight'])if(r[field]!=null&&(typeof r[field]!=='string'||String(r[field]).length>200))return null
 const evidence:TiqEvidenceShape={}
 if(r.tiq_rating_status!=null&&!['current','provisional','review'].includes(String(r.tiq_rating_status)))return null
 if(r.tiq_rating_model!=null&&(typeof r.tiq_rating_model!=='string'||r.tiq_rating_model.length>100))return null
 for(const field of ['tiq_rating_season','tiq_singles_matches','tiq_doubles_matches'] as const){const n=r[field];if(n!=null&&(!Number.isSafeInteger(n)||Number(n)<0||Number(n)>1000000))return null;evidence[field]=n as number|null|undefined}
 evidence.tiq_rating_status=r.tiq_rating_status as TiqEvidenceShape['tiq_rating_status'];evidence.tiq_rating_model=r.tiq_rating_model as string|null|undefined
 return {...ratings,...evidence,id,name:r.name.trim(),location:typeof r.location==='string'?r.location.trim()||null:null,flight:typeof r.flight==='string'?r.flight.trim()||null:null}
}
export function headerRating(player:ProfileHeaderPlayer|null,view:RatingView) {
 const evidence=getTiqEvidence(player,view),raw=player?.[`${view}_dynamic_rating`]??player?.overall_dynamic_rating??null
 const value=evidence.status==='review'?'Under review':evidence.status==='unknown'?'Awaiting refresh':raw==null?'Not recorded':formatRatingValue(raw)
 return {evidence,value,baseline:playerPublishedBaseline(player,view),fallback:view!=='overall'&&player?.[`${view}_dynamic_rating`]==null&&raw!==null}
}
export function parseHeaderFreshness(value:unknown,now=Date.now()):PlayerImportFreshness {
 if(!value||typeof value!=='object'||Array.isArray(value))return {...unknownImportFreshness}
 const r=value as Record<string,unknown>;if(!['current','overdue','pending','review','unknown'].includes(String(r.status)))return {...unknownImportFreshness}
 for(const field of ['pendingPages','reviewPages'])if(!Number.isSafeInteger(r[field])||Number(r[field])<0||Number(r[field])>1000000)return {...unknownImportFreshness}
 for(const field of ['lastImportedAt','nextRefreshAt'])if(r[field]!==null&&(typeof r[field]!=='string'||String(r[field]).length>40||!Number.isFinite(Date.parse(String(r[field])))))return {...unknownImportFreshness}
 if(r.lastImportedAt&&Date.parse(String(r.lastImportedAt))>now+300000)return {...unknownImportFreshness}
 if(r.status==='current'&&(!r.lastImportedAt||!r.nextRefreshAt))return {...unknownImportFreshness}
 return {status:r.status==='current'&&Date.parse(String(r.nextRefreshAt))<now?'overdue':r.status as PlayerImportFreshness['status'],lastImportedAt:r.lastImportedAt as string|null,nextRefreshAt:r.nextRefreshAt as string|null,pendingPages:Number(r.pendingPages),reviewPages:Number(r.reviewPages)}
}
export async function loadProfileHeader(client:SupabaseClient,id:string,current:()=>boolean,request:typeof CapacitorHttp.get=options=>CapacitorHttp.get(options)) {
 if(!current()||!/^[a-zA-Z0-9_-]{1,100}$/.test(id))throw Error('Player visit closed.')
 const own=async(owner?:string)=>{const {data,error}=await client.auth.getSession();if(error||!current()||!data.session||owner&&owner!==data.session.user.id)throw Error('Player visit closed.');return data.session.user.id}
 const owner=await own()
 const [player,freshness]=await Promise.all([
 (async()=>{try{const {data,error}=await client.from('players').select('id,name,location,flight,overall_rating,singles_rating,doubles_rating,overall_dynamic_rating,singles_dynamic_rating,doubles_dynamic_rating,rating_source,tiq_rating_status,tiq_rating_model,tiq_rating_season,tiq_singles_matches,tiq_doubles_matches').eq('id',id).limit(1).abortSignal(AbortSignal.timeout(12000)).maybeSingle();return error?null:parseProfileHeaderPlayer(data,id)}catch{return null}})(),
 (async()=>{if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return {...unknownImportFreshness};try{const response=await request({url:'https://www.tenaceiq.com/api/player/import-freshness?playerId='+encodeURIComponent(id),responseType:'json',disableRedirects:true,connectTimeout:12000,readTimeout:12000});return response.status===200?parseHeaderFreshness(response.data):{...unknownImportFreshness}}catch{return {...unknownImportFreshness}}})()
 ])
 await own(owner);return {player,freshness}
}
