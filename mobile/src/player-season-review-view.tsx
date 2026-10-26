import styles from '../../app/components/player-season-review.module.css'
import {useId,useState} from 'react'
import {PlayerSeasonReview} from '../../app/components/player-season-review'
import {playerSeasonReview} from '../../lib/player-season-review'
import {getRatingViewLabel,type RatingView} from '../../lib/player-rating-display'
import type {PlayerPerformanceData} from './player-performance-data'
import {matchDate} from './recent-results'
export function nativeSeasonReview(data:PlayerPerformanceData,view:RatingView,year?:string) {
 if(data.matchesLimited)return null
 const counts=new Map<string,number>()
 for(const s of data.snapshots)if(s.matchId) {const key=`${s.matchId}:${s.view}`;counts.set(key,(counts.get(key)??0)+1)}
 const snapshots=new Map(data.ratingsLimited?[]:data.snapshots.filter(s=>s.matchId).map(s=>[`${s.matchId}:${s.view}`,{delta:counts.get(`${s.matchId}:${s.view}`)===1?s.delta:null}] as const))
 return playerSeasonReview(data.matches,snapshots,year,view)
}
export function NativePlayerSeasonReview({data,view}:{data:PlayerPerformanceData;view:RatingView}) {
 const [chosenYear,setYear]=useState<string|null>(null),id=useId()
 if(data.matchesLimited)return null
 const years=[...new Set(data.matches.map(m=>m.date.slice(0,4)))].sort().reverse()
 const year=chosenYear&&years.includes(chosenYear)?chosenYear:years[0]
 if(!year)return null
 const review=nativeSeasonReview(data,view,year),highlight=review?.biggestSwing
 return <section aria-label="Season check-in"><div className={styles.controls}><label htmlFor={id}>Review year</label><select id={id} value={year} onChange={e=>setYear(e.target.value)}>{years.map(y=><option key={y} value={y}>{y}</option>)}</select></div>{review?<PlayerSeasonReview season={year} total={review.decided.length} wins={review.wins} singles={review.singles.length} doubles={review.doubles.length} swing={highlight?.snap?.delta==null?'—':`${highlight.snap.delta>=0?'+':''}${highlight.snap.delta.toFixed(3)}`} swingNote={highlight?`${matchDate(highlight.match.date)} · ${highlight.match.result==='W'?'Win':'Loss'}`:data.ratingsLimited?'Rating history incomplete':'No recorded change'} focus={review.nextFocus} formatLabel={getRatingViewLabel(view)}><p>{data.ratingsLimited?'Rating highlights are withheld while history is incomplete.':`${review.movementCount} of ${review.decided.length} results have a recorded TIQ change. Missing changes are not zero.`}</p><p>This check-in uses {year} public results, not a forecast or an official USTA rating.</p></PlayerSeasonReview>:<p role="status">No public decided {getRatingViewLabel(view).toLowerCase()} results in {year}. Choose another year or format.</p>}</section>
}
