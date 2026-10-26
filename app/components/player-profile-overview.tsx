import {useId} from 'react'
import story from './player-profile-overview.module.css'
import styles from './player-profile-overview.module.css'
export type ProfileMetric={label:string;value:string;note:string;percent:number}
export function RatingSparkline({points}:{points:Array<{rating:number}>}) {
 const gradient=useId().replace(/:/g,'')
 if(points.length<2)return <div className={story.ratingPulseEmpty} aria-hidden="true"><i/></div>
 const width=220,height=68,padding=5,min=Math.min(...points.map(p=>p.rating)),max=Math.max(...points.map(p=>p.rating)),spread=Math.max(max-min,.08)
 const y=(rating:number)=>height-padding-((rating-min)/spread)*(height-padding*2)
 const path=points.map((p,i)=>`${i?'L':'M'} ${padding+i/(points.length-1)*(width-padding*2)} ${y(p.rating)}`).join(' ')
 return <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Recent TIQ rating movement" preserveAspectRatio="none"><defs><linearGradient id={gradient} x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#58a6ff"/><stop offset="100%" stopColor="#b7ed23"/></linearGradient></defs><path d={path} fill="none" stroke={`url(#${gradient})`} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/><circle cx={width-padding} cy={y(points.at(-1)!.rating)} r="4.5" fill="#d9f84a" stroke="#09192d" strokeWidth="3"/></svg>
}
export function CompactRatingJourney({points,firstLabel,currentLabel,recentChange,firstTitle='First result',currentTitle='TIQ now',note='Open the full chart when you want every reviewed result.'}:{points:Array<{rating:number}>;firstLabel:string;currentLabel:string;recentChange:number|null;firstTitle?:string;currentTitle?:string;note?:string}) {
 return <div className={story.ratingHistorySummary} aria-label="Compact TIQ rating journey"><div className={story.ratingJourneyPulse}><div><span>{firstTitle}</span><strong>{firstLabel}</strong></div><RatingSparkline points={points.slice(-6)}/><div><span>{currentTitle}</span><strong>{currentLabel}</strong></div><div data-direction={recentChange===null?'flat':recentChange>=0?'up':'down'}><span>Recent move</span><strong>{recentChange===null?'Building':`${recentChange>=0?'+':''}${recentChange.toFixed(2)}`}</strong></div></div><small>{note}</small></div>
}
export function PlayerMatchQuality({metrics}:{metrics:ProfileMetric[]}) {
 return <section className={story.matchQualitySnapshot+' '+styles.shell} aria-label="Match quality snapshot"><div className={story.matchQualitySnapshotHeading}><span>Match quality</span><small>Scorecards and competition context</small></div><div className={story.matchQualityGrid}>{metrics.map(metric=><article key={metric.label} className={story.matchQualityMetric}><div><span>{metric.label}</span><strong>{metric.value}</strong></div><small>{metric.note}</small><progress className={styles.meter} max={100} value={Math.max(0,Math.min(100,metric.percent))} aria-label={metric.label}/></article>)}</div></section>
}
