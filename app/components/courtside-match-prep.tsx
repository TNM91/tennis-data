'use client'

import Link from 'next/link'
import { trackProductUsageEvent } from '@/lib/product-usage-client'
import { matchPrepActionEvent } from '@/lib/match-prep-usage'
import { useEffect, useId, useRef, useState } from 'react'
import styles from './tennis-insight-cards.module.css'

export default function CourtsideMatchPrep({ context, courtPlan, saveHref, doubles, initialOpen = false }: { initialOpen?: boolean; context: string; courtPlan: string; saveHref: string; doubles: boolean }) {
  const [open, setOpen] = useState(initialOpen)
  function toggleCourtside() {
    if (!open) void trackProductUsageEvent(matchPrepActionEvent('open_courtside'))
    setOpen(value => !value)
  }
  const contentId = useId()
  const section = useRef<HTMLElement>(null)
  useEffect(() => { if (initialOpen) section.current?.scrollIntoView({ block: 'start', behavior: 'instant' }) }, [initialOpen])
  return <section ref={section} id="courtside-match-prep" className={styles.card} aria-label="Courtside match prep">
    <div className={styles.header}><h3>Take your focus onto court</h3><button className={styles.button} type="button" aria-expanded={open} aria-controls={contentId} onClick={toggleCourtside}>{open ? 'Close courtside view' : 'Open courtside view'}</button></div>
    <div id={contentId} hidden={!open}>
    {open ? <>
      <p>{context}</p>
      <div className={styles.grid}>
        <div><ol className={styles.cues}><li>{courtPlan}</li><li>{doubles ? 'Agree on a serve target and the partner’s first move before each point.' : 'Choose a reliable serve target and your next-ball pattern.'}</li><li>At the first changeover, keep one pattern that worked and adjust one that did not.</li></ol></div>
        <div><svg className={styles.courtDiagram} viewBox="0 0 200 300" role="img" aria-label="Tennis court with changeover focus marker">
          <rect x="20" y="20" width="160" height="260" fill="#103b36" stroke="#fff" strokeWidth="2" />
          <path d="M40 20V280M160 20V280M20 150H180M40 80H160M40 220H160M100 80V220" fill="none" stroke="#fff" strokeWidth="2" />
          <circle cx="100" cy="250" r="10" fill="#9be11d" /><text x="100" y="295" textAnchor="middle" fill="#b8c8da" fontSize="10">Choose · Play · Review</text>
        </svg><p className={styles.muted}>General preparation cues. Court positions and shot patterns are not inferred from match scores.</p></div>
      </div>
      <Link className={styles.button} href={saveHref}>Save focus to My Lab</Link>
    </> : null}
    </div>
    {!open ? <p className={styles.muted}>Three preparation cues in a compact view for warm-up and changeovers.</p> : null}
  </section>
}
