import {useId,useState} from 'react'
import PlayerSetScoreGrid from '../../app/components/player-set-score-grid'
import type {PlayerSetScoreMatch} from '../../lib/player-set-score-grid'
import type {RatingView} from '../../lib/player-rating-display'
import type {PlayerPerformanceData} from './player-performance-data'
import styles from '../../app/components/player-season-review.module.css'
export function nativeSetScoreMatches(data:PlayerPerformanceData,year:string,playerId?:string):PlayerSetScoreMatch[]|null {
 if(data.matchesLimited)return null
 const context=new Map((data.opponentHistory??[]).map(m=>[m.id,m]))
 return data.matches.filter(m=>year==='all'||m.date.slice(0,4)===year).map(m=>{const players=context.get(m.id);return {...m,score:m.score??null,opponent:players?.opponent??null,partner:players&&playerId&&players.players.some(p=>p.id===playerId&&p.side===players.side)?players.players.filter(p=>p.side===players.side&&p.id!==playerId).map(p=>p.name).join(' / ')||null:null}})
}
export function NativePlayerSetScores({data,view,onView,playerName='Selected player',playerId}:{data:PlayerPerformanceData;view:RatingView;onView:(view:RatingView)=>void;playerName?:string;playerId?:string}) {
 const [year,setYear]=useState('all'),id=useId(),matches=nativeSetScoreMatches(data,year,playerId),years=[...new Set(data.matches.map(m=>m.date.slice(0,4)))].sort().reverse()
 if(matches===null)return <p role="status">Set-score analysis is withheld while public match history is incomplete.</p>
 const mode=view==='overall'?(matches.some(m=>m.matchType==='singles')?'singles':'doubles'):view
 return <section aria-label="Set-score analysis"><div className={styles.controls}><label htmlFor={id}>Set-score year</label><select id={id} value={year} onChange={e=>setYear(e.target.value)}><option value="all">All years</option>{years.map(y=><option key={y} value={y}>{y}</option>)}</select></div><p>Choose Singles or Doubles to compare set scores. Both won and lost sets count, including sets inside a lost match.</p>{data.opponentHistory==null?<p>Player names are unavailable; set totals still use confirmed match outcomes.</p>:null}<PlayerSetScoreGrid matches={matches} playerName={playerName} activeMode={mode} onModeChange={onView} scopeKey={year} scopeLabel={year==='all'?'Loaded public history':`${year} public results`}/></section>
}
