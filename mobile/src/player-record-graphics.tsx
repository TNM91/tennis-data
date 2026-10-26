import {playerSeasonPerformance} from '../../lib/player-performance'
import {getRatingViewLabel,type RatingView} from '../../lib/player-rating-display'
import type {PlayerPerformanceData} from './player-performance-data'
import {matchDate} from './recent-results'
import {RecordBars} from './record-graphics'
export function playerRecordGraphicData(data:PlayerPerformanceData,view:RatingView) {
 if(data.matchesLimited)return null
 const selected=data.matches.filter(m=>view==='overall'||m.matchType===view),wins=selected.filter(m=>m.result==='W').length
 return {wins,losses:selected.length-wins,total:selected.length,seasons:playerSeasonPerformance(selected,new Map()),recent:selected.slice(0,5)}
}
export function PlayerRecordGraphics({data,view}:{data:PlayerPerformanceData;view:RatingView}) {
 const record=playerRecordGraphicData(data,view),label=getRatingViewLabel(view)
 if(!record)return <p role="status">Record graphics are withheld while public match history is incomplete.</p>
 if(!record.total)return <p role="status">No public decided {label.toLowerCase()} results for record graphics yet.</p>
 return <section className="native-record-graphics" aria-label={`${label} record graphics`}><small className="stat-eyebrow">Competitive record</small><h2>{label} results at a glance</h2><p>All loaded public decided {label.toLowerCase()} results. Scheduled and pending matches are excluded.</p><RecordBars label={`${label} win rates by season`} rows={[{key:'all',label:'All loaded years',wins:record.wins,losses:record.losses},...record.seasons.slice(0,6).map(s=>({key:s.year,label:s.year,wins:s.wins,losses:s.losses}))]}/>{record.seasons.length>6?<p>Showing the latest six of {record.seasons.length} recorded years. The all-year record includes every loaded year.</p>:null}<div className="record-form"><h3>Recent form</h3><ol aria-label={`${label} form, newest first`}>{record.recent.map(match=><li data-outcome={match.result} key={match.id} aria-label={`${matchDate(match.date)}: ${match.result==='W'?'Win':'Loss'}`}><strong>{match.result}</strong><span>{matchDate(match.date)}</span></li>)}</ol><p>Newest first · up to five {label.toLowerCase()} results</p></div></section>
}
