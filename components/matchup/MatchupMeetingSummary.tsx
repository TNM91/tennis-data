import type {CSSProperties} from 'react'
export type MeetingRecord={total:number;winsA:number;winsB:number;singlesA:number;singlesB:number;doublesA:number;doublesB:number}
type Display={total:string;overall:string;singles:string;doubles:string;pending:string;lead:string}
export default function MatchupMeetingSummary({record,leftLabel,rightLabel,display}:{record:MeetingRecord;leftLabel:string;rightLabel:string;display?:Display}){
 const completed=record.winsA+record.winsB,pending=Math.max(0,record.total-completed),pct=completed?Math.round(record.winsA/completed*100):0
 const lead=record.winsA>record.winsB?leftLabel+' leads':record.winsB>record.winsA?rightLabel+' leads':'Even'
 const cards=[['Total matches',display?.total??String(record.total)],['Overall record',display?.overall??`${record.winsA} - ${record.winsB}`],['Singles record',display?.singles??`${record.singlesA} - ${record.singlesB}`],['Doubles record',display?.doubles??`${record.doublesA} - ${record.doublesB}`],['Pending',display?.pending??String(pending)]]
 return <div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,150px),1fr))',gap:12,minWidth:0}}>{cards.map(([label,value])=><div key={label} data-meeting-metric={label} style={metricCard}><div style={metricLabel}>{label}</div><div style={metricValue}>{value}</div>{label==='Overall record'?<div style={metricSub}>{leftLabel} vs {rightLabel}</div>:null}</div>)}</div>
 {completed>0?<div style={headToHeadDominanceStyle}><div style={headToHeadDominanceKickerStyle}>Head-to-head dominance | {display?.lead??lead}</div><div role="img" aria-label={`${leftLabel} ${pct}%, ${rightLabel} ${100-pct}% of completed meetings`} style={headToHeadBarStyle}><div style={headToHeadBarFillStyle(pct)}/><div style={headToHeadBarRemainderStyle}/></div><div style={headToHeadPercentRowStyle}><span style={headToHeadPercentLabelGreenStyle}>{leftLabel} {pct}%</span><span style={headToHeadPercentLabelBlueStyle}>{100-pct}% {rightLabel}</span></div><p style={metricSub}>Win share uses completed meetings only. Pending results are excluded.</p></div>:<p style={metricSub}>No completed opposing results in this search. Pending meetings do not count as wins or losses.</p>}
 </div>
}
const metricCard: CSSProperties = {
  borderRadius: '18px',
  padding: '16px',
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  minWidth: 0,
}

const metricLabel: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  marginBottom: '8px',
  fontWeight: 700,
  overflowWrap: 'anywhere',
}

const metricValue: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '28px',
  lineHeight: 1.1,
  fontWeight: 900,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const metricSub: CSSProperties = {
  marginTop: '6px',
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  lineHeight: 1.5,
  fontWeight: 600,
  overflowWrap: 'anywhere',
}

const headToHeadDominanceStyle: CSSProperties = {
  marginTop: 18,
  minWidth: 0,
}

const headToHeadDominanceKickerStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontWeight: 800,
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 10,
  overflowWrap: 'anywhere',
}

const headToHeadBarStyle: CSSProperties = {
  display: 'flex',
  borderRadius: 999,
  overflow: 'hidden',
  height: 12,
  background: 'var(--shell-chip-bg)',
  minWidth: 0,
}

function headToHeadBarFillStyle(value: number): CSSProperties {
  return {
    width: `${value}%`,
    background: 'linear-gradient(90deg, var(--brand-green), var(--brand-lime))',
    transition: 'width 500ms ease',
    minWidth: value > 0 ? 4 : 0,
  }
}

const headToHeadBarRemainderStyle: CSSProperties = {
  flex: 1,
  background: 'color-mix(in srgb, var(--brand-blue-2) 28%, var(--shell-chip-bg) 72%)',
  minWidth: 0,
}

const headToHeadPercentRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  marginTop: 8,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const headToHeadPercentLabelGreenStyle: CSSProperties = {
  color: '#d9f84a',
  fontWeight: 800,
  fontSize: 13,
  maxWidth: '100%',
  minWidth: 0,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const headToHeadPercentLabelBlueStyle: CSSProperties = {
  ...headToHeadPercentLabelGreenStyle,
  color: '#93c5fd',
}

