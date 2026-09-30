'use client'

import Link from 'next/link'
import { CaretDownIcon } from '@phosphor-icons/react/dist/csr/CaretDown'
import { CheckCircleIcon } from '@phosphor-icons/react/dist/csr/CheckCircle'
import { CircleIcon } from '@phosphor-icons/react/dist/csr/Circle'
import type { TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import TiqFeatureIcon from '@/components/brand/TiqFeatureIcon'
import type { RoleHomeAction, RoleHomeQuickAction } from './role-action-home'
import styles from './league-office-home.module.css'

export type LeagueOfficeProgressItem = {
  label: string
  complete: boolean
  current?: boolean
}

export type LeagueOfficePulseItem = {
  label: string
  value: string
  detail: string
  href: string
  icon: TiqFeatureIconName
  attention?: boolean
}

export default function LeagueOfficeHome({
  planLabel,
  leagueName,
  leagueMeta,
  leagueCount,
  leagueHref,
  deskHref,
  deskLabel,
  primaryAction,
  quickActions,
  progress,
  pulse,
  onAction,
}: {
  planLabel: string
  leagueName: string
  leagueMeta: string
  leagueCount: number
  leagueHref: string
  deskHref: string
  deskLabel: string
  primaryAction: RoleHomeAction
  quickActions: readonly RoleHomeQuickAction[]
  progress: readonly LeagueOfficeProgressItem[]
  pulse: readonly LeagueOfficePulseItem[]
  onAction?: (action: Pick<RoleHomeAction, 'title' | 'href'>) => void
}) {
  return (
    <section className={styles.shell} aria-label="League Office home">
      <div className={styles.topline}>
        <span className={styles.plan}>Your plan · {planLabel}</span>
        <Link href={leagueHref} className={styles.allLeagues}>
          {leagueCount > 1 ? `All ${leagueCount} leagues` : 'League record'}
        </Link>
      </div>

      <Link href={leagueHref} className={styles.leagueSelector} aria-label={`Current league: ${leagueName}`}>
        <span className={styles.leagueMark} aria-hidden="true">
          <TiqFeatureIcon name="teamRankings" size="sm" variant="ghost" />
        </span>
        <span className={styles.leagueCopy}>
          <small>Active league</small>
          <strong>{leagueName}</strong>
          <span>{leagueMeta}</span>
        </span>
        <CaretDownIcon className={styles.selectorCue} size={18} weight="bold" aria-hidden="true" />
      </Link>

      <div className={styles.heading}>
        <span>League Office</span>
        <h1>Your next league decision.</h1>
      </div>

      <article className={styles.primaryCard}>
        <div className={styles.primaryIcon}>
          <TiqFeatureIcon name={primaryAction.icon} size="md" variant="surface" />
        </div>
        <div className={styles.primaryCopy}>
          <span>{primaryAction.label}</span>
          <strong>{primaryAction.title}</strong>
          <p>{primaryAction.detail}</p>
        </div>
        <Link
          href={primaryAction.href}
          className={styles.primaryAction}
          onClick={() => onAction?.(primaryAction)}
        >
          {primaryAction.cta}
        </Link>
      </article>

      <div className={styles.progress} aria-label="League season progress">
        {progress.map((item) => (
          <div
            key={item.label}
            className={`${styles.progressItem} ${item.complete ? styles.complete : ''} ${item.current ? styles.current : ''}`}
          >
            <span className={styles.progressDot} aria-hidden="true">
              {item.complete
                ? <CheckCircleIcon size={28} weight="fill" />
                : <CircleIcon size={28} weight={item.current ? 'bold' : 'regular'} />}
            </span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <div className={styles.sectionHeading}>
        <div>
          <span>Season pulse</span>
          <h2>Know what is ready.</h2>
        </div>
        <Link href={deskHref}>{deskLabel}</Link>
      </div>

      <div className={styles.pulseGrid}>
        {pulse.map((item) => (
          <Link key={item.label} href={item.href} className={styles.pulseCard}>
            <span className={item.attention ? styles.pulseIconAttention : styles.pulseIcon}>
              <TiqFeatureIcon name={item.icon} size="sm" variant="ghost" />
            </span>
            <span className={styles.pulseCopy}>
              <small>{item.label}</small>
              <strong>{item.value}</strong>
              <span>{item.detail}</span>
            </span>
          </Link>
        ))}
      </div>

      <nav className={styles.quickGrid} aria-label="League Office shortcuts">
        {quickActions.slice(0, 4).map((action) => (
          <Link
            key={action.title}
            href={action.href}
            className={styles.quickAction}
            onClick={() => onAction?.(action)}
          >
            <TiqFeatureIcon name={action.icon} size="sm" variant="ghost" />
            <span>{action.title}</span>
          </Link>
        ))}
      </nav>
    </section>
  )
}
