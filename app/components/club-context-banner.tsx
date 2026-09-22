'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import type { ClubWorkspaceData } from '@/lib/club-workspace'
import styles from './club-context-banner.module.css'

export default function ClubContextBanner({
  workspace,
  surface,
  detail,
}: {
  workspace: ClubWorkspaceData
  surface: string
  detail: string
}) {
  const { club } = workspace
  const style = { '--club-context-color': club.primaryColor } as CSSProperties
  return (
    <section className={styles.banner} style={style} aria-label={`${club.name} ${surface} context`}>
      <div className={styles.identity}>
        {club.logoUrl
          ? <Image className={styles.logo} src={club.logoUrl} alt={`${club.name} logo`} width={52} height={52} unoptimized />
          : <span className={styles.fallback} aria-hidden="true">{club.name.slice(0, 2).toUpperCase()}</span>}
        <div className={styles.copy}>
          <span className={styles.eyebrow}>{surface} · Club-sponsored</span>
          <strong className={styles.title}>{club.name}</strong>
          <span className={styles.detail}>{detail}</span>
        </div>
      </div>
      <Link className={styles.back} href={`/clubs?clubId=${encodeURIComponent(club.id)}`}>Back to club home</Link>
    </section>
  )
}
