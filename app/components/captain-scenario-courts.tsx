'use client'

import { useState, type ReactNode } from 'react'
import styles from './tennis-insight-cards.module.css'

export type ScenarioCourt = { label: string; leftText: string; rightText: string; changed: boolean; leftStrength: number | null; rightStrength: number | null; diff: number | null }

export default function CaptainScenarioCourts({ rows, leftName, rightName }: { rows: ScenarioCourt[]; leftName: string; rightName: string }) {
  const [changesOnly, setChangesOnly] = useState(false)
  const visible = changesOnly ? rows.filter(row => row.changed) : rows
  return <section className={styles.card} aria-label="Court-by-court lineup comparison">
    <div className={styles.header}><h3>See the swaps court by court</h3><button className={styles.button} type="button" aria-pressed={changesOnly} onClick={() => setChangesOnly(value => !value)}>Changes only</button></div>
    <p className={styles.muted} role="status">{visible.length} of {rows.length} courts shown · {rows.filter(row => row.changed).length} changed</p>
    <p className={styles.muted}>Compare your saved pairings and average rating strength. Confirm availability in the builder before sending a lineup.</p>
    <CaptainScenarioCourtGrid>
      {visible.map(row => <CaptainScenarioCourt key={row.label} row={row} leftName={leftName} rightName={rightName}/>)}
    </CaptainScenarioCourtGrid>
    {!visible.length ? <p>No changed courts in these saved lineups.</p> : null}
  </section>
}

export function CaptainScenarioCourt({row,leftName,rightName,display}:{row:ScenarioCourt;leftName:string;rightName:string;display?:{leftRating:string;rightRating:string;difference:string;leftWidth:string;rightWidth:string}}){
 const maximum=Math.max(row.leftStrength??0,row.rightStrength??0,1)
 return <article className={styles.court} data-changed={row.changed}>
  <h4>{row.label} · {row.changed?'Lineup changed':'Same lineup'}</h4>
  {[{name:leftName,text:row.leftText,rating:row.leftStrength},{name:rightName,text:row.rightText,rating:row.rightStrength}].map((side,index)=><div key={index}>
   <span className={styles.muted}>{index===0?'A':'B'} · {side.name}</span><p>{side.text==='-'?'Court unfilled':side.text}</p>
   {display?<svg className={styles.bar} viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true"><rect width={index===0?display.leftWidth:display.rightWidth} height="8" fill="#9be11d"/></svg>:<div className={styles.bar} aria-hidden="true"><span style={{width:`${Math.max(0,(side.rating??0)/maximum*100)}%`}}/></div>}
   <span className={styles.muted}>{display?(index===0?display.leftRating:display.rightRating):side.rating===null?'Rating unavailable':`Average rating ${side.rating.toFixed(3)}`}</span>
  </div>)}
  <p>{display?display.difference:row.diff===null?'Both ratings are needed to compare strength.':Math.abs(row.diff)<.001?'Even rating strength.':`${row.diff>0?'A':'B'} has ${Math.abs(row.diff).toFixed(3)} more rating strength.`}</p>
 </article>
}

export function CaptainScenarioCourtGrid({children}:{children:ReactNode}){return <div className={styles.grid}>{children}</div>}
