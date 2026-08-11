import Image from 'next/image'
import type { CSSProperties } from 'react'
import type { TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import TiqFeatureIcon from '@/components/brand/TiqFeatureIcon'
import styles from './tennis-state-art.module.css'

export type TennisStateVisual =
  | 'player'
  | 'team'
  | 'matchup'
  | 'captain'
  | 'coach'
  | 'league'
  | 'tournament'
  | 'generic'

type TennisStateVisualConfig = {
  src: string
  objectPosition: string
  opacity: number
  icon: TiqFeatureIconName
}

const VISUAL_CONFIG: Record<TennisStateVisual, TennisStateVisualConfig> = {
  player: {
    src: '/player-profile/journey-hero.png',
    objectPosition: '72% center',
    opacity: 0.24,
    icon: 'playerRatings',
  },
  team: {
    src: '/player-profile/player-id-court.png',
    objectPosition: 'center',
    opacity: 0.2,
    icon: 'teamRankings',
  },
  matchup: {
    src: '/tiq/courts/tiq-court-master.png',
    objectPosition: 'center 42%',
    opacity: 0.2,
    icon: 'matchupAnalysis',
  },
  captain: {
    src: '/tiq/courts/tiq-court-master.png',
    objectPosition: 'center 38%',
    opacity: 0.19,
    icon: 'captainDashboard',
  },
  coach: {
    src: '/player-profile/journey-hero.png',
    objectPosition: '70% center',
    opacity: 0.2,
    icon: 'coachTennis',
  },
  league: {
    src: '/tiq/courts/tiq-court-master.png',
    objectPosition: 'center 44%',
    opacity: 0.19,
    icon: 'leagueTennis',
  },
  tournament: {
    src: '/tiq/courts/tiq-court-master.png',
    objectPosition: 'center 42%',
    opacity: 0.19,
    icon: 'competeTennis',
  },
  generic: {
    src: '/player-profile/player-id-court.png',
    objectPosition: 'center',
    opacity: 0.16,
    icon: 'exploreTennis',
  },
}

export function getTennisStateIcon(visual: TennisStateVisual): TiqFeatureIconName {
  return VISUAL_CONFIG[visual].icon
}

export default function TennisStateArt({
  visual,
  compact = false,
}: {
  visual: TennisStateVisual
  compact?: boolean
}) {
  const config = VISUAL_CONFIG[visual]

  return (
    <div
      aria-hidden="true"
      className={`${styles.art} ${compact ? styles.compact : ''}`}
      style={{ '--tennis-state-art-opacity': config.opacity } as CSSProperties}
    >
      <Image
        alt=""
        className={styles.image}
        fill
        loading="lazy"
        quality={75}
        sizes="(max-width: 720px) 78vw, 44vw"
        src={config.src}
        style={{ objectPosition: config.objectPosition }}
      />
      <TiqFeatureIcon
        className={styles.icon}
        name={config.icon}
        signature={false}
        size="hero"
        variant="ghost"
      />
    </div>
  )
}
