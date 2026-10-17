'use client'

import { useState } from 'react'
import styles from './tennis-insight-cards.module.css'

export type RatingJourneyPoint = { id: string; date: string; rating: number; delta: number | null; opponent?: string; score?: string; result?: string }

export default function RatingJourneyExplorer({ points }: { points: RatingJourneyPoint[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  if (!points.length) return null
  const foundIndex = selectedId === null ? -1 : points.findIndex(point => point.id === selectedId)
  const selectedIndex = foundIndex < 0 ? points.length - 1 : foundIndex
  const selected = points[selectedIndex]
  const bounds = points.reduce((range, point) => ({ low: Math.min(range.low, point.rating), high: Math.max(range.high, point.rating) }), { low: Infinity, high: -Infinity })
  const low = bounds.low - .05
  const spread = bounds.high + .05 - low
  const x = (index: number) => points.length === 1 ? 300 : 12 + index / (points.length - 1) * 576
  const y = (rating: number) => 112 - (rating - low) / spread * 100
  const date = new Date(selected.date)
  const dateLabel = Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })
  return <section className={styles.card} aria-label="Explore your rating journey">
    <h3>Every result has a story</h3>
    <p className={styles.muted}>Choose a reviewed result to connect the rating move to the match.</p>
    <div className={styles.chartLayout}>
    <div className={styles.chartScale} aria-hidden="true"><span>{(bounds.high + .05).toFixed(2)}</span><span>TIQ</span><span>{low.toFixed(2)}</span></div>
    <svg className={styles.chart} viewBox="0 0 600 130" preserveAspectRatio="none" role="img" aria-label={`Rating trend across ${points.length} reviewed results`}>
      {[12, 62, 112].map(height => <line key={height} x1="12" x2="588" y1={height} y2={height} className={styles.chartGridline} />)}
      <polyline points={points.map((point, index) => `${x(index)},${y(point.rating)}`).join(' ')} fill="none" stroke="#9be11d" strokeWidth="3" />
      <line x1={x(selectedIndex)} x2={x(selectedIndex)} y1="8" y2="122" className={styles.chartMarker} strokeDasharray="4 4" />
      <circle cx={x(selectedIndex)} cy={y(selected.rating)} r="6" fill="#9be11d" />
    </svg>
    </div>
    <div className={styles.chartDates}><span>First reviewed result</span><span>Latest reviewed result</span></div>
    <label>Reviewed result {selectedIndex + 1} of {points.length}
      <input className={styles.range} type="range" min="0" max={points.length - 1} value={selectedIndex} disabled={points.length === 1} onChange={event => setSelectedId(points[Number(event.target.value)].id)} aria-valuetext={`${dateLabel}, rating ${selected.rating.toFixed(3)}`} />
    </label>
    <div className={styles.chartNavigation} role="group" aria-label="Navigate reviewed results">
      <button className={styles.button} type="button" aria-label="Previous result" disabled={selectedIndex === 0} onClick={() => setSelectedId(points[selectedIndex - 1].id)}>Previous</button>
      <button className={styles.button} type="button" aria-label="Next result" disabled={selectedIndex === points.length - 1} onClick={() => setSelectedId(points[selectedIndex + 1].id)}>Next</button>
      <button className={styles.button} type="button" aria-label="Latest result" disabled={selectedIndex === points.length - 1} onClick={() => setSelectedId(points[points.length - 1].id)}>Latest</button>
    </div>
    <div className={styles.detail} aria-live="polite">
      <span>{dateLabel}</span><strong>TIQ {selected.rating.toFixed(3)}</strong>
      <p>{selected.delta === null ? 'Rating change unavailable for this result.' : `${selected.delta >= 0 ? '+' : ''}${selected.delta.toFixed(3)} rating change after this reviewed result.`}</p>
      <p>{selected.opponent ? `${selected.result || 'Result'} vs ${selected.opponent} · ${selected.score || 'Score unavailable'}` : 'Match details are unavailable for this rating snapshot.'}</p>
    </div>
    <p className={styles.muted}>{points.length < 8 ? 'Limited history: a few results can move the trend quickly.' : 'The trend reflects reviewed results in the selected window.'} Rating movement reflects the rating model, not a diagnosis of your technique.</p>
  </section>
}
