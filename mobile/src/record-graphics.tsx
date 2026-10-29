export type RecordBar={key:string;label:string;wins:number;losses:number}
// Native meters keep the chart accessible and avoid inline styles under the app CSP.
export function RecordBars({rows,label,emptyLabel="No decided results"}:{rows:RecordBar[];label:string;emptyLabel?:string}) {
 return <div className="record-chart" role="group" aria-label={label}>{rows.map(row=>{const total=row.wins+row.losses;return <div className="record-chart-row" key={row.key}><div className="record-chart-heading"><strong>{row.label}</strong><span>{row.wins}W · {row.losses}L</span></div>{total?<><meter min={0} max={total} value={row.wins} aria-label={`${row.label}: ${row.wins} ${row.wins===1?'win':'wins'} from ${total} decided ${total===1?'result':'results'}`}>{row.wins}/{total}</meter><small>{Math.round(row.wins/total*100)}% wins · {total} {total===1?'result':'results'}</small></>:<small>{emptyLabel}</small>}</div>})}</div>
}

/** A confirmed match/court record; empty coverage never becomes a 0% loss record. */
export function RecordScoreboard({wins,losses,label,unit='matches'}:{wins:number;losses:number;label:string;unit?:'matches'|'courts'}){
 const valid=[wins,losses].every(value=>Number.isSafeInteger(value)&&value>=0)&&Number.isSafeInteger(wins+losses)
 const total=valid?wins+losses:null,percent=total?Math.round(wins/total*100):null
 return <div className="native-record-scoreboard" role="group" aria-label={label}>
  <div className={'stat-donut'+(percent===null?' is-empty':'')} role="img" aria-label={`${label}: ${percent===null?'no decided results':percent+'% wins'}`}><svg viewBox="0 0 120 120" aria-hidden="true" focusable="false"><circle className="stat-donut-track" cx="60" cy="60" r="50"/>{percent!==null&&percent>0?<circle className="stat-donut-fill" cx="60" cy="60" r="50" pathLength="100" strokeDasharray={`${percent} 100`} transform="rotate(-90 60 60)"/>:null}</svg><span className="stat-donut-value" aria-hidden="true">{percent===null?'—':<>{percent}<small>%</small></>}</span></div>
  <div className="record-scoreboard-read"><small>{label}</small><strong>{valid?`${wins}W · ${losses}L`:'—'}</strong><span>{total===null?'Record unavailable':total===0?'No decided results':`${total} decided ${unit==='courts'?(total===1?'court':'courts'):(total===1?'match':'matches')}`}</span></div>
 </div>
}
