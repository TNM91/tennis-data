'use client'

import Link from 'next/link'
import { useAuth } from '@/app/components/auth-provider'
import { useClubCommunicationAttention } from '@/app/components/use-club-communication-attention'
import styles from './club-communication-attention-card.module.css'

export default function ClubCommunicationAttentionCard() {
  const { authResolved, session, userId } = useAuth()
  const { attention } = useClubCommunicationAttention({ accessToken: session?.access_token, userId })

  if (!authResolved || !attention) return null

  const countLabel = attention.attentionCount === 1 ? '1 conversation' : `${attention.attentionCount} conversations`
  const detail = [
    attention.unreadCount ? `${attention.unreadCount} new` : '',
    attention.needsReplyCount ? `${attention.needsReplyCount} ${attention.needsReplyCount === 1 ? 'needs a reply' : 'need replies'}` : '',
  ].filter(Boolean).join(' · ')

  return (
    <section className={styles.card} aria-label={`${countLabel} need attention in ${attention.clubName}`}>
      <div className={styles.count} aria-hidden="true">{formatAttentionCount(attention.attentionCount)}</div>
      <div className={styles.copy}>
        <p>Club communication</p>
        <h2>{countLabel} need attention.</h2>
        <span>{attention.clubName}{detail ? ` · ${detail}` : ''}</span>
      </div>
      <Link className={styles.action} href={attention.href}>Review</Link>
    </section>
  )
}

function formatAttentionCount(count: number) {
  return count > 9 ? '9+' : String(count)
}
