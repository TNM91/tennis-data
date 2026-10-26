export type RecordBar={key:string;label:string;wins:number;losses:number}
// Native meters keep the chart accessible and avoid inline styles under the app CSP.
export function RecordBars({rows,label,emptyLabel="No decided results"}:{rows:RecordBar[];label:string;emptyLabel?:string}) {
 return <div className="record-chart" role="group" aria-label={label}>{rows.map(row=>{const total=row.wins+row.losses;return <div className="record-chart-row" key={row.key}><div className="record-chart-heading"><strong>{row.label}</strong><span>{row.wins}W · {row.losses}L</span></div>{total?<><meter min={0} max={total} value={row.wins} aria-label={`${row.label}: ${row.wins} ${row.wins===1?'win':'wins'} from ${total} decided ${total===1?'result':'results'}`}>{row.wins}/{total}</meter><small>{Math.round(row.wins/total*100)}% wins · {total} {total===1?'result':'results'}</small></>:<small>{emptyLabel}</small>}</div>})}</div>
}
