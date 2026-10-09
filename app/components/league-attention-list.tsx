'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { LeagueAttentionItem } from '@/lib/league-attention-items'
import styles from './tennis-insight-cards.module.css'

export default function LeagueAttentionList({ items, ready, warning }: { items: LeagueAttentionItem[]; ready: boolean; warning?: string }) {
  const [filter, setFilter] = useState<'all' | 'results' | 'approvals'>('all')
  const visible = items.filter(item => filter === 'all' || item.category === filter)
  return <section className={styles.card} aria-label="League items needing attention">
    <div className={styles.header}><h3>Needs your attention</h3><span className={styles.muted}>{ready ? `${items.length} action${items.length === 1 ? '' : 's'}` : 'Loading league checks…'}</span></div>
    <div className={styles.header} role="group" aria-label="Filter league attention">{(['all', 'results', 'approvals'] as const).map(value => <button key={value} className={styles.button} aria-pressed={filter === value} type="button" onClick={() => setFilter(value)}>{value === 'all' ? 'All' : value === 'results' ? 'Results' : 'Approvals'}</button>)}</div>
    {warning ? <p className={styles.muted}>Some league checks are unavailable. {warning}</p> : null}
    {ready ? <><div className={styles.grid}>{visible.map(item => <article key={item.id} className={styles.court}><span className={styles.muted}>{item.leagueName}</span><h4>{item.title}</h4><p>{item.detail}</p><Link href={item.href}>{item.action}</Link></article>)}</div>{!visible.length ? <p>{warning ? 'No actions found in the loaded records.' : 'No open items in these loaded result and approval checks.'}</p> : null}</> : null}
  </section>
}
