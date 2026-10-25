import type {CSSProperties} from 'react'
import type {HistoricalCheck} from '../../lib/historical-rating-check'
export default function HistoricalRatingCheck({report,display}:{report:HistoricalCheck;display?:Record<string,string>}){
 const labels={overall:'Overall',high:'Large edge (72%+)',medium:'Medium edge (60–72%)',low:'Small edge (under 60%)'}
 return <div><p style={metricSub}>Current TIQ ratings checked against recent completed {report.kind} results across recorded tennis. This is a retrospective check, not a validated forecast of future matches. Current ratings may include self-rated records and Overall fallbacks.</p>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,150px),1fr))',gap:12,minWidth:0}}>{(['overall','high','medium','low'] as const).map(key=>{const band=report.bands[key];return <div key={key} data-check-band={key} style={metricCard}><div style={metricLabel}>{labels[key]}</div><div style={metricValue}>{display?.[key+'Percent']??(band.total?Math.round(band.correct/band.total*100)+'%':'—')}</div><div style={metricSub}>{display?.[key+'Counts']??`${band.correct} of ${band.total} usable results`}</div></div>})}</div>
 <p style={metricSub}>Checked {display?.scanned??report.scanned} recent results (200-match limit). {display?.coverage??(report.limited?'Older results are outside this search.':'This is a recent sample, not a complete career record.')}</p>
 <p style={metricSub}>Excluded: {display?.pending??report.excluded.pending} pending · {display?.incomplete??report.excluded.incomplete} incomplete sides · {display?.ratings??report.excluded.ratings} missing or invalid ratings · {display?.tied??report.excluded.tied} tied ratings.</p>
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

