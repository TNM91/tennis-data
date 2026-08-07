'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState, type CSSProperties } from 'react'
import { getClubGroupTypeLabel, type Club, type ClubCompetitionTemplate, type ClubGroup } from '@/lib/club-workspace'
import styles from './club-workspace.module.css'

type PublicCompetition = { id: string; name: string; detail: string; type: 'league' | 'tournament'; href: string }

type PublicClubResponse = {
  ok: boolean
  message?: string
  club?: Club
  groups?: ClubGroup[]
  templates?: ClubCompetitionTemplate[]
  competitions?: PublicCompetition[]
}

export default function PublicClubHome({ slug }: { slug: string }) {
  const [data, setData] = useState<PublicClubResponse | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void fetch(`/api/clubs/public/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then(async (response) => await response.json() as PublicClubResponse)
      .then(setData)
      .catch(() => setData({ ok: false, message: 'This club page could not load.' }))
    return () => controller.abort()
  }, [slug])

  if (!data) return <main className={styles.page}><div className={styles.loading}><p className={styles.eyebrow}>Club</p><h1 className={styles.title}>Opening club home...</h1></div></main>
  if (!data.ok || !data.club) return <main className={styles.page}><div className={styles.empty}><p className={styles.eyebrow}>Club</p><h1 className={styles.title}>Club page not found.</h1><p className={styles.copy}>{data.message}</p><Link className={styles.secondary} href="/clubs">Open Club Workspace</Link></div></main>

  const { club } = data
  const clubStyle = { '--club-color': club.primaryColor } as CSSProperties
  return (
    <main className={styles.page} style={clubStyle}>
      <section className={styles.hero} style={club.heroImageUrl ? { backgroundImage: `linear-gradient(100deg, rgba(5,14,28,.95), rgba(5,14,28,.72)), url(${JSON.stringify(club.heroImageUrl)})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
        <div className={styles.clubIdentity}>
          {club.logoUrl ? <Image className={styles.logo} src={club.logoUrl} alt={`${club.name} logo`} width={64} height={64} unoptimized /> : <div className={styles.logoFallback}>{club.name.slice(0, 2).toUpperCase()}</div>}
          <div><p className={styles.eyebrow}>Tennis club</p><h1 className={styles.clubName}>{club.name}</h1><p className={styles.clubMeta}>{club.locationLabel}</p></div>
        </div>
        <p className={styles.copy}>{club.description || 'Programs, competition, and club tennis in one place.'}</p>
        <div className={styles.heroActions}>
          <Link className={styles.primary} href="/join">Join TenAceIQ</Link>
          {club.contactEmail ? <a className={styles.secondary} href={`mailto:${club.contactEmail}`}>Contact club</a> : null}
          <Link className={styles.secondary} href="/clubs">Club member sign in</Link>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}><p className={styles.eyebrow}>Play here</p><h2>Programs and teams</h2><p>See what is active at the club.</p></div>
        {data.groups?.length ? <div className={styles.cardGrid}>{data.groups.map((group) => <article className={styles.card} key={group.id}><div className={styles.cardTop}><h3>{group.name}</h3><span className={styles.pill}>{getClubGroupTypeLabel(group.groupType)}</span></div><p>{group.description || group.seasonLabel || 'Club program'}</p></article>)}</div> : <p className={styles.copy}>Club programs will appear here as they open.</p>}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}><p className={styles.eyebrow}>Compete</p><h2>Club leagues and tournaments</h2><p>Open schedules, draws, scores, and results from the source.</p></div>
        {data.competitions?.length ? <div className={styles.cardGrid}>{data.competitions.map((competition) => <Link className={styles.actionCard} href={competition.href} key={`${competition.type}-${competition.id}`}><strong>{competition.name}</strong><span>{competition.detail || competition.type}</span><b>Open {competition.type}</b></Link>)}</div> : data.templates?.length ? <div className={styles.cardGrid}>{data.templates.map((template) => <article className={styles.card} key={template.id}><div className={styles.cardTop}><h3>{template.name}</h3><span className={styles.pill}>{template.competitionType}</span></div><p>{[template.divisionLabel, template.formatId.replaceAll('_', ' ')].filter(Boolean).join(' · ')}</p></article>)}</div> : <p className={styles.copy}>Club competitions will appear here when registration opens.</p>}
      </section>
    </main>
  )
}
