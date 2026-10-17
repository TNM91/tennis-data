'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { getVisitUpdates, readVisitTimestamp } from '@/lib/tennis-visit-updates'
import styles from './tennis-insight-cards.module.css'

type VisitItem = { id: string; title: string; createdAt: string | null; href?: string }

export default function WatchlistVisitSummary({ userId, items, ready }: { userId: string | null; items: VisitItem[]; ready: boolean }) {
  const initialized = useRef(false)
  const [visit, setVisit] = useState<{ previous: number | null; now: number; stored: boolean } | null>(null)
  const storageKey = `tenaceiq:watchlist-visit:v1:${userId}`
  useEffect(() => {
    if (!ready || !userId || initialized.current) return
    const timeout = window.setTimeout(() => {
      const now = Date.now()
      let previous: number | null = null
      let stored = true
      try {
        previous = readVisitTimestamp(localStorage.getItem(storageKey), now)
        localStorage.setItem(storageKey, String(now))
      } catch { stored = false }
      initialized.current = true
      setVisit({ previous, now, stored })
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [ready, storageKey, userId])
  if (!ready || !userId || !visit) return null
  const updates = getVisitUpdates(items, visit.previous, visit.now)
  return <section className={styles.card} aria-label="Watchlist visit updates">
    <div className={styles.header}><h3>Since your last visit</h3>{updates.length ? <button className={styles.button} type="button" onClick={() => {
      const now = Date.now()
      let stored = true
      try { localStorage.setItem(storageKey, String(now)) } catch { stored = false }
      setVisit({ previous: now, now, stored })
    }}>Mark reviewed</button> : null}</div>
    <p className={styles.muted}>{!visit.stored ? 'Visit tracking is unavailable in this browser. Your watchlist still works below.' : visit.previous === null ? 'Your next visit on this device will highlight new dated updates in your watchlist.' : updates.length ? `${updates.length} new dated update${updates.length === 1 ? '' : 's'} in this watchlist view since your last visit on this device.` : 'No new dated updates in this watchlist view since your last visit on this device.'}</p>
    {updates.length ? <ul className={styles.cues}>{updates.slice(0, 3).map(item => <li key={item.id}>{item.href ? <Link href={item.href}>{item.title}</Link> : item.title}</li>)}</ul> : null}
  </section>
}
