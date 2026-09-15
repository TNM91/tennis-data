import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  buildCaptainShareMetadata,
  getCaptainShareConfig,
  isCaptainShareKind,
  safeCaptainShareTarget,
} from '@/lib/captain-share-preview'
import CaptainShareRedirect from './share-redirect'
import styles from './page.module.css'

type SharePageProps = {
  params: Promise<{ kind: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || '' : value || ''
}

export async function generateMetadata({ params, searchParams }: SharePageProps): Promise<Metadata> {
  const { kind } = await params
  if (!isCaptainShareKind(kind)) return {}
  const query = await searchParams
  return buildCaptainShareMetadata({
    kind,
    teamName: firstParam(query.team),
    opponent: firstParam(query.opponent),
    detail: firstParam(query.detail),
  })
}

export default async function CaptainSharePage({ params, searchParams }: SharePageProps) {
  const { kind } = await params
  if (!isCaptainShareKind(kind)) notFound()
  const query = await searchParams
  const config = getCaptainShareConfig(kind)
  const teamName = firstParam(query.team)
  const opponent = firstParam(query.opponent)
  const matchDate = firstParam(query.date)
  const detail = firstParam(query.detail)
  const targetHref = safeCaptainShareTarget(firstParam(query.to))
  const context = [teamName, opponent ? `vs ${opponent}` : '', matchDate].filter(Boolean).join(' · ')

  return (
    <main className={styles.page} style={{ '--share-accent': config.accent } as CSSProperties}>
      <CaptainShareRedirect targetHref={targetHref} />
      <section className={styles.card}>
        <Image className={styles.logo} src="/brand/web/header-logo-transparent.png" alt="TenAceIQ" width={300} height={78} priority />
        <p className={styles.eyebrow}>{config.eyebrow}</p>
        <h1>{config.title}</h1>
        {context ? <p className={styles.context}>{context}</p> : null}
        <p className={styles.description}>{detail || config.description}</p>
        <Link className={styles.action} href={targetHref}>{config.action}</Link>
        <p className={styles.hint}>Opening automatically. Tap the button if it does not open.</p>
      </section>
    </main>
  )
}
