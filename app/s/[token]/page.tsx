import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import CaptainShareRedirect from '@/app/share/captain/[kind]/share-redirect'
import styles from '@/app/share/captain/[kind]/page.module.css'
import { buildCaptainShareMetadata, getCaptainShareConfig } from '@/lib/captain-share-preview'
import { loadCaptainShortShare } from '@/lib/captain-share-links-server'

type ShortSharePageProps = { params: Promise<{ token: string }> }

export async function generateMetadata({ params }: ShortSharePageProps): Promise<Metadata> {
  const { token } = await params
  const share = await loadCaptainShortShare(token)
  if (!share) return {}
  return buildCaptainShareMetadata({
    kind: share.kind,
    teamName: share.teamName,
    opponent: share.opponent,
    detail: share.detail,
    sharePath: `/s/${share.token}`,
  })
}

export default async function CaptainShortSharePage({ params }: ShortSharePageProps) {
  const { token } = await params
  const share = await loadCaptainShortShare(token)
  if (!share) notFound()
  const config = getCaptainShareConfig(share.kind)
  const context = [share.teamName, share.opponent ? `vs ${share.opponent}` : '', share.matchDate].filter(Boolean).join(' · ')

  return (
    <main className={styles.page} style={{ '--share-accent': config.accent } as CSSProperties}>
      <CaptainShareRedirect targetHref={share.targetHref} />
      <section className={styles.card}>
        <Image className={styles.logo} src="/brand/web/header-logo-transparent.png" alt="TenAceIQ" width={300} height={78} priority />
        <p className={styles.eyebrow}>{config.eyebrow}</p>
        <h1>{config.title}</h1>
        {context ? <p className={styles.context}>{context}</p> : null}
        <p className={styles.description}>{share.detail || config.description}</p>
        <Link className={styles.action} href={share.targetHref}>{config.action}</Link>
        <p className={styles.hint}>Opening automatically. Tap the button if it does not open.</p>
      </section>
    </main>
  )
}
