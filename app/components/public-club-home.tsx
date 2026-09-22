'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState, type CSSProperties } from 'react'
import { buildClubToolHref, getClubGroupTypeLabel, type Club, type ClubCompetitionTemplate, type ClubGroup } from '@/lib/club-workspace'
import ContextualTennisVisual from '@/app/components/contextual-tennis-visual'
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

  if (!data) return <PublicClubOpeningState />
  if (!data.ok || !data.club) return <main className={styles.page}><div className={styles.empty}><p className={styles.eyebrow}>Club</p><h1 className={styles.title}>Club page not found.</h1><p className={styles.copy}>{data.message}</p><Link className={styles.secondary} href="/clubs">Open Club</Link></div></main>

  const { club } = data
  const activeGroups = data.groups ?? []
  const activeCompetitions = data.competitions ?? []
  const clubStyle = { '--club-color': club.primaryColor } as CSSProperties
  return (
    <main className={styles.page} style={clubStyle}>
      <section className={`${styles.hero} ${styles.publicHero}`} style={club.heroImageUrl ? { backgroundImage: `linear-gradient(100deg, rgba(5,14,28,.97) 8%, rgba(5,14,28,.76) 65%), url(${JSON.stringify(club.heroImageUrl)})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
        <div className={styles.publicHeroTop}>
          <div className={styles.clubIdentity}>
            {club.logoUrl ? <Image className={styles.publicLogo} src={club.logoUrl} alt={`${club.name} logo`} width={86} height={86} unoptimized /> : <div className={`${styles.logoFallback} ${styles.publicLogo}`}>{club.name.slice(0, 2).toUpperCase()}</div>}
            <div><p className={styles.eyebrow}>Official club home</p><h1 className={styles.clubName}>{club.name}</h1><p className={styles.clubMeta}>{club.locationLabel}</p></div>
          </div>
          <span className={styles.powered}>Powered by TenAceIQ</span>
        </div>
        <p className={`${styles.copy} ${styles.heroCopy}`}>{club.description || 'Programs, coaching, competition, and your tennis journey in one place.'}</p>
        <div className={styles.heroProof} aria-label="Club activity">
          <span><strong>{activeGroups.length}</strong> active programs</span>
          <span><strong>{activeCompetitions.length}</strong> live competitions</span>
          <span><strong>1</strong> connected player experience</span>
        </div>
        <div className={styles.heroActions}>
          <Link className={styles.primary} href={`/login?next=${encodeURIComponent(`/clubs?clubId=${club.id}&clubSlug=${club.slug}`)}`}>Member sign in</Link>
          {club.contactEmail ? <a className={styles.secondary} href={`mailto:${club.contactEmail}`}>Contact club</a> : null}
          <Link className={styles.secondary} href="/join">Join TenAceIQ</Link>
        </div>
      </section>

      <section className={`${styles.panel} ${styles.publicExperience}`}>
        <div className={styles.panelHeading}><p className={styles.eyebrow}>Connected by TenAceIQ</p><h2>One club relationship. A better tennis experience.</h2><p>Join once, then carry the same club context through your coaching, programs, teams, matches, and next steps.</p></div>
        <div className={styles.experienceStrip}>
          <div><b>01</b><strong>My tennis</strong><span>Goals, coach work, follows, match context, and the next useful step.</span></div>
          <div><b>02</b><strong>Coach connection</strong><span>Lesson follow-through, assignments, video feedback, and visible progress.</span></div>
          <div><b>03</b><strong>Club competition</strong><span>Teams, leagues, tournaments, schedules, draws, results, and player history.</span></div>
        </div>
        <div className={styles.heroActions}>
          <Link className={styles.secondary} href={buildClubToolHref('/mylab', club)}>Open My Lab</Link>
          <Link className={styles.secondary} href={buildClubToolHref('/compete', club)}>See club competition</Link>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}><p className={styles.eyebrow}>Play here</p><h2>Programs and teams</h2><p>See what is active at the club.</p></div>
        {data.groups?.length ? <div className={styles.cardGrid}>{data.groups.map((group) => <article className={styles.card} key={group.id}><div className={styles.cardTop}><h3>{group.name}</h3><span className={styles.pill}>{getClubGroupTypeLabel(group.groupType)}</span></div><p>{group.description || group.seasonLabel || 'Club program'}</p>{group.groupType === 'clinic' ? <div className={styles.heroActions}>{group.registrationUrl ? <a className={styles.primary} href={group.registrationUrl} target="_blank" rel="noreferrer">Register with club</a> : null}<Link className={styles.secondary} href={`/login?next=${encodeURIComponent(`/clubs/clinics/${group.id}?clubId=${club.id}`)}`}>Member view</Link></div> : null}</article>)}</div> : <p className={styles.copy}>Club programs will appear here as they open.</p>}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}><p className={styles.eyebrow}>Compete</p><h2>Club leagues and tournaments</h2><p>Open schedules, draws, scores, and results from the source.</p></div>
        {data.competitions?.length ? <div className={styles.cardGrid}>{data.competitions.map((competition) => <Link className={styles.actionCard} href={competition.href} key={`${competition.type}-${competition.id}`}><strong>{competition.name}</strong><span>{competition.detail || competition.type}</span><b>Open {competition.type}</b></Link>)}</div> : data.templates?.length ? <div className={styles.cardGrid}>{data.templates.map((template) => <article className={styles.card} key={template.id}><div className={styles.cardTop}><h3>{template.name}</h3><span className={styles.pill}>{template.competitionType}</span></div><p>{[template.divisionLabel, template.formatId.replaceAll('_', ' ')].filter(Boolean).join(' · ')}</p></article>)}</div> : <p className={styles.copy}>Club competitions will appear here when registration opens.</p>}
      </section>
    </main>
  )
}

function PublicClubOpeningState() {
  return (
    <main className={styles.page}>
      <section className={`${styles.clubWelcome} ${styles.publicOpening}`} role="status" aria-live="polite">
        <ContextualTennisVisual visual="club" />
        <p className={styles.eyebrow}>Official Club home</p>
        <h1 className={styles.title}>Opening the connected Club experience.</h1>
        <p className={styles.copy}>Loading club branding, active programs, and live competition.</p>
        <div className={styles.heroProof} aria-hidden="true"><span>Club identity</span><span>Programs and teams</span><span>Leagues and tournaments</span></div>
      </section>
    </main>
  )
}
