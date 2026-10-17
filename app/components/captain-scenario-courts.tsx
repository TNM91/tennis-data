'use client'

import { useState } from 'react'
import styles from './tennis-insight-cards.module.css'

type Court = { label: string; leftText: string; rightText: string; changed: boolean; leftStrength: number | null; rightStrength: number | null; diff: number | null }

export default function CaptainScenarioCourts({ rows, leftName, rightName }: { rows: Court[]; leftName: string; rightName: string }) {
  const [changesOnly, setChangesOnly] = useState(false)
  const visible = changesOnly ? rows.filter(row => row.changed) : rows
  return <section className={styles.card} aria-label="Court-by-court lineup comparison">
    <div className={styles.header}><h3>See the swaps court by court</h3><button className={styles.button} type="button" aria-pressed={changesOnly} onClick={() => setChangesOnly(value => !value)}>Changes only</button></div>
    <p className={styles.muted} role="status">{visible.length} of {rows.length} courts shown · {rows.filter(row => row.changed).length} changed</p>
    <p className={styles.muted}>Compare your saved pairings and average rating strength. Confirm availability in the builder before sending a lineup.</p>
    <div className={styles.grid}>
      {visible.map(row => {
        const maximum = Math.max(row.leftStrength ?? 0, row.rightStrength ?? 0, 1)
        return <article key={row.label} className={styles.court} data-changed={row.changed}>
          <h4>{row.label} · {row.changed ? 'Lineup changed' : 'Same lineup'}</h4>
          {[{ name: leftName, text: row.leftText, rating: row.leftStrength }, { name: rightName, text: row.rightText, rating: row.rightStrength }].map((side, index) => <div key={index}>
            <span className={styles.muted}>{index === 0 ? 'A' : 'B'} · {side.name}</span><p>{side.text === '-' ? 'Court unfilled' : side.text}</p>
            <div className={styles.bar} aria-hidden="true"><span style={{ width: `${Math.max(0, (side.rating ?? 0) / maximum * 100)}%` }} /></div>
            <span className={styles.muted}>{side.rating === null ? 'Rating unavailable' : `Average rating ${side.rating.toFixed(3)}`}</span>
          </div>)}
          <p>{row.diff === null ? 'Both ratings are needed to compare strength.' : Math.abs(row.diff) < .001 ? 'Even rating strength.' : `${row.diff > 0 ? 'A' : 'B'} has ${Math.abs(row.diff).toFixed(3)} more rating strength.`}</p>
        </article>
      })}
    </div>
    {!visible.length ? <p>No changed courts in these saved lineups.</p> : null}
  </section>
}
