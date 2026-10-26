import {trajectoryGeometry} from '../../lib/rating-trajectory'
import {ratingSignal} from '../../lib/rating-signal'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {ComparedPlayer} from './comparison-data'
import type {RatingView} from '../../lib/player-rating-display'
import {formatRating} from '../../lib/captain-formatters'
import {isValidCalendarDate} from '../../lib/calendar-date'
import {sumLastFiveRatingDeltas} from '../../lib/rating-form'
import {canFollowPlayers} from './follows-data'
import {html} from './match-details'
import websiteUi from '../generated/website-ui.json'
const validRating=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=1.5&&value<=7
export function sharedComparisonCards(players:ComparedPlayer[],view:RatingView){
 if(![2,4].includes(players.length))return ''
 const engine=players.length===4?'doubles':'singles',split=players.length/2,sides=[players.slice(0,split),players.slice(split)]
 const average=(side:ComparedPlayer[],track:'tiq'|'usta',kind:RatingView)=>{const values=side.map(p=>p.ratings?.[(track==='tiq'?`${kind}_dynamic_rating`:`${kind}_usta_dynamic_rating`) as keyof NonNullable<ComparedPlayer['ratings']>]);return values.every(validRating)?values.reduce((sum,n)=>sum+n,0)/values.length:null}
 const projection=(side:ComparedPlayer[])=>{const values=side.map(p=>p.ratings?.[`${engine}_dynamic_rating`]??p.ratings?.overall_dynamic_rating);return values.every(validRating)?values.reduce((sum,n)=>sum+n,0)/values.length:null}
 const projections=sides.map(projection)
 return '<div class="website-ui website-comparison-cards">'+sides.map((side,index)=>{
  const self=side.some(p=>p.ratings?.rating_source==='self'),tiq=average(side,'tiq',view),usta=average(side,'usta',view),diff=tiq!==null&&usta!==null?tiq-usta:null
  const tone=self?'self':diff===null?'none':ratingSignal(diff).tone,signal=self?'Self-rated - verified results will replace the S signal.':diff===null?'':`${ratingSignal(diff).label} - TIQ signal ${diff>=0?'+':''}${diff.toFixed(2)}`
  const favored=projections.every(validRating)&&projections[index]!>projections[1-index]!
  const values:Record<string,string>={TIQ_COMPARE_TITLE:side.map(p=>p.player.name).join(' / '),TIQ_COMPARE_SUBTITLE:players.length===4?index===0?'Your side':'Other side':side[0].player.location||'No location set',TIQ_COMPARE_PROJECTION:formatRating(projections[index])+(self?' S':''),TIQ_COMPARE_SIGNAL:signal}
  for(const kind of ['overall','singles','doubles'] as const){const value=average(side,'tiq',kind);values['TIQ_TIQ_'+kind.toUpperCase()]=formatRating(value)+(self&&value!==null?' S':'');values['TIQ_USTA_'+kind.toUpperCase()]=self?'Pending':formatRating(average(side,'usta',kind))}
  const key=`${view}:${Number(favored)}:${tone}` as keyof typeof websiteUi.compareCards
  return websiteUi.compareCards[key].replace('Singles projection rating',engine==='doubles'?'Doubles projection rating':'Singles projection rating').replace(/TIQ_[A-Z_]+/g,key=>html(values[key]??key))
 }).join('')+'</div><p class="rating-context">USTA dynamic is a recorded estimate, not an official USTA rating. Missing split ratings stay blank; projection ratings may use Overall. Side ratings average both players only when both are recorded.</p>'
}
export type RatingSnapshot={id:string;player_id:string;rating_type:string;snapshot_date:string;dynamic_rating:number|null;delta:number|null;track:'tiq'}
export type PlayerRatingHistory={playerId:string;overall:RatingSnapshot[];specific:RatingSnapshot[];moreOverall:boolean;moreSpecific:boolean;unavailable:boolean}
export function parseRatingSnapshots(value:unknown,playerId:string,type:string,limit:number){
 if(!Number.isInteger(limit)||limit<1||limit>60||!['overall','singles','doubles'].includes(type)||!Array.isArray(value)||value.length>limit+1)throw Error('Rating history unavailable.')
 const rows=value.map(v=>{
  if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Rating history unavailable.')
  const r=v as Record<string,unknown>,id=String(r.id??''),date=r.snapshot_date
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id)||r.player_id!==playerId||r.track!=='tiq'||r.rating_type!==type||typeof date!=='string'||date.length>40||!isValidCalendarDate(date.slice(0,10))||!Number.isFinite(Date.parse(date))||r.dynamic_rating!==null&&!validRating(r.dynamic_rating)||r.delta!==null&&(typeof r.delta!=='number'||!Number.isFinite(r.delta)||Math.abs(r.delta)>10))throw Error('Rating history unavailable.')
  return {id,player_id:playerId,rating_type:type,snapshot_date:date,dynamic_rating:r.dynamic_rating as number|null,delta:r.delta as number|null,track:'tiq' as const}
 })
 if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Rating history unavailable.')
 rows.sort((a,b)=>Date.parse(b.snapshot_date)-Date.parse(a.snapshot_date)||b.id.localeCompare(a.id,undefined,{numeric:true}))
 return {rows:rows.slice(0,limit),more:rows.length>limit}
}
export async function loadComparisonRatingHistory(client:SupabaseClient,players:ComparedPlayer[],current:()=>boolean){
 if(![2,4].includes(players.length)||new Set(players.map(p=>p.player.id)).size!==players.length)throw Error('Choose different players.')
 const own=async(owner?:string)=>{const {data,error}=await client.auth.getSession();if(error||!current()||!data.session||owner&&owner!==data.session.user.id)throw Error('Comparison is no longer open.');return data.session.user.id}
 const owner=await own();if(!await canFollowPlayers(client,current))throw Error('Player access is required.');await own(owner)
 const engine=players.length===4?'doubles':'singles'
 const result=await Promise.all(players.map(async p=>{
  try{
   const query=(kind:string,limit:number)=>client.from('rating_snapshots').select('id,player_id,rating_type,snapshot_date,dynamic_rating,delta,track').eq('player_id',p.player.id).eq('track','tiq').eq('rating_type',kind).order('snapshot_date',{ascending:false}).order('id',{ascending:false}).limit(limit+1).abortSignal(AbortSignal.timeout(12000))
   const [overall,specific]=await Promise.all([query('overall',60),query(engine,30)])
   if(overall.error||specific.error)throw Error('Rating history unavailable.')
   const a=parseRatingSnapshots(overall.data,p.player.id,'overall',60),b=parseRatingSnapshots(specific.data,p.player.id,engine,30)
   return {playerId:p.player.id,overall:a.rows,specific:b.rows,moreOverall:a.more,moreSpecific:b.more,unavailable:false}
  }catch{return {playerId:p.player.id,overall:[],specific:[],moreOverall:false,moreSpecific:false,unavailable:true}}
 }))
 await own(owner);return result
}
export function comparisonTrajectoriesHtml(players:ComparedPlayer[],history:PlayerRatingHistory[]){
 if(![2,4].includes(players.length))return ''
 const pairs=players.length===2?[[0,1]]:[[0,1],[2,3]]
 return pairs.map(([a,b],index)=>{
  const left=history.find(h=>h.playerId===players[a].player.id),right=history.find(h=>h.playerId===players[b].player.id),title=players.length===2?'Rating trajectory comparison':(index===0?'Your side':'Other side')+' · individual rating histories'
  if(!left||!right||left.unavailable||right.unavailable)return '<h3>'+html(title)+'</h3><p>Both player histories are needed for this chart. Refresh rating history to try again.</p>'
  const points=(h:PlayerRatingHistory)=>h.overall.map(r=>({date:r.snapshot_date,rating:r.dynamic_rating})),chart=trajectoryGeometry(points(left),points(right))
  if(!chart)return '<h3>'+html(title)+'</h3><p>Each player needs three dated Overall TIQ ratings to draw this comparison. Review the dated histories below.</p>'
  const values:Record<string,string>={TIQ_CHART_LEFT:players[a].player.name,TIQ_CHART_RIGHT:players[b].player.name,TIQ_CHART_LEFTPATH:chart.left.path,TIQ_CHART_RIGHTPATH:chart.right.path,TIQ_CHART_LEFTX:String(chart.left.last.x),TIQ_CHART_LEFTY:String(chart.left.last.y),TIQ_CHART_RIGHTX:String(chart.right.last.x),TIQ_CHART_RIGHTY:String(chart.right.last.y),TIQ_CHART_START:chart.start,TIQ_CHART_END:chart.end,TIQ_CHART_RANGE:chart.min.toFixed(2)+'–'+chart.max.toFixed(2)}
  return '<h3>'+html(title)+'</h3><div class="website-ui website-rating-trajectory">'+websiteUi.trajectory.replace(/TIQ_CHART_[A-Z]+/g,key=>html(values[key]??key))+'</div><p class="rating-context">Latest loaded Overall snapshots only; this is not a complete season.'+(players.length===4?' These are individual curves, not a combined pair rating.':'')+'</p>'
 }).join('')
}
export function ratingHistoryHtml(players:ComparedPlayer[],history:PlayerRatingHistory[]|null){
 if(!history)return '<p>Load recent form and dated Overall TIQ snapshots for the selected players.</p>'
 const engine=players.length===4?'doubles':'singles'
 return comparisonTrajectoriesHtml(players,history)+players.map(p=>{
  const h=history.find(h=>h.playerId===p.player.id)
  if(!h||h.unavailable)return `<article><h3>${html(p.player.name)}</h3><p>Rating history unavailable. Refresh to try again.</p></article>`
  const form=sumLastFiveRatingDeltas(h.specific,p.player.id,engine),usable=h.specific.slice(0,5).filter(r=>r.delta!==null).length,points=h.overall.filter(r=>r.dynamic_rating!==null),first=points.at(-1),last=points[0],change=first&&last&&points.length>=2?last.dynamic_rating!-first.dynamic_rating!:null
  return `<article><h3>${html(p.player.name)}</h3><p>${engine==='doubles'?'Doubles':'Singles'} form: <strong>${form===null?'No recorded signal':(form>=0?'+':'')+form.toFixed(2)}</strong> · ${usable} usable delta${usable===1?'':'s'} in the latest ${Math.min(5,h.specific.length)} ${engine} snapshots.</p><p>Overall trend: ${change===null?'Not enough recorded ratings':(change>=0?'+':'')+change.toFixed(2)+' across '+points.length+' recorded ratings from '+first!.snapshot_date.slice(0,10)+' to '+last!.snapshot_date.slice(0,10)}.</p><details><summary>Overall TIQ history · ${h.overall.length} snapshots</summary><p>Latest ${h.overall.length} of ${h.moreOverall?'more saved':'the loaded'} Overall snapshots, shown oldest to newest. Missing values remain blank. This is not a complete season or match count.</p>${h.overall.length?'<div class="horizontal-data" role="region" tabindex="0" aria-label="'+html(p.player.name)+' dated rating history"><table><caption>'+html(p.player.name)+' · Overall TIQ</caption><thead><tr><th scope="col">Date</th><th scope="col">TIQ</th><th scope="col">Delta</th></tr></thead><tbody>'+[...h.overall].reverse().map(r=>'<tr><td>'+html(r.snapshot_date.slice(0,10))+'</td><td>'+formatRating(r.dynamic_rating)+'</td><td>'+(r.delta===null?'—':(r.delta>=0?'+':'')+r.delta.toFixed(3))+'</td></tr>').join('')+'</tbody></table></div>':'<p>No saved Overall snapshots.</p>'}</details>${h.moreSpecific?'<p>Form uses only the latest 30 '+engine+' snapshots loaded.</p>':''}</article>`
 }).join('')
}
