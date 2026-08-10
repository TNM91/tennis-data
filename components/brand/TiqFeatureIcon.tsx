'use client'

import type { Icon } from '@phosphor-icons/react'
import { BellRingingIcon } from '@phosphor-icons/react/dist/csr/BellRinging'
import { BinocularsIcon } from '@phosphor-icons/react/dist/csr/Binoculars'
import { BuildingsIcon } from '@phosphor-icons/react/dist/csr/Buildings'
import { CalendarBlankIcon } from '@phosphor-icons/react/dist/csr/CalendarBlank'
import { ChartLineUpIcon } from '@phosphor-icons/react/dist/csr/ChartLineUp'
import { ChalkboardTeacherIcon } from '@phosphor-icons/react/dist/csr/ChalkboardTeacher'
import { ChatCircleDotsIcon } from '@phosphor-icons/react/dist/csr/ChatCircleDots'
import { ClipboardTextIcon } from '@phosphor-icons/react/dist/csr/ClipboardText'
import { FlaskIcon } from '@phosphor-icons/react/dist/csr/Flask'
import { GaugeIcon } from '@phosphor-icons/react/dist/csr/Gauge'
import { ListChecksIcon } from '@phosphor-icons/react/dist/csr/ListChecks'
import { LockKeyIcon } from '@phosphor-icons/react/dist/csr/LockKey'
import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/csr/MagnifyingGlass'
import { PresentationChartIcon } from '@phosphor-icons/react/dist/csr/PresentationChart'
import { RankingIcon } from '@phosphor-icons/react/dist/csr/Ranking'
import { ShieldCheckIcon } from '@phosphor-icons/react/dist/csr/ShieldCheck'
import { TargetIcon } from '@phosphor-icons/react/dist/csr/Target'
import { TennisBallIcon } from '@phosphor-icons/react/dist/csr/TennisBall'
import { TreeStructureIcon } from '@phosphor-icons/react/dist/csr/TreeStructure'
import { TrophyIcon } from '@phosphor-icons/react/dist/csr/Trophy'
import { UsersThreeIcon } from '@phosphor-icons/react/dist/csr/UsersThree'
import type { CSSProperties } from 'react'

export type TiqFeatureIconName =
  | 'exploreTennis'
  | 'improveTennis'
  | 'competeTennis'
  | 'captainTennis'
  | 'coachTennis'
  | 'leagueTennis'
  | 'clubTennis'
  | 'captainDashboard'
  | 'matchupAnalysis'
  | 'lineupBuilder'
  | 'scenarioBuilder'
  | 'messagingCenter'
  | 'playerRatings'
  | 'opponentScouting'
  | 'matchPrep'
  | 'reliabilityIndex'
  | 'teamRankings'
  | 'schedule'
  | 'reports'
  | 'alerts'
  | 'myLab'
  | 'accountSecurity'
  | 'clubOperations'

export type TiqFeatureIconSize = 'sm' | 'md' | 'lg' | 'xl'
export type TiqFeatureIconVariant = 'default' | 'surface' | 'ghost'

type TiqFeatureIconProps = {
  name: TiqFeatureIconName
  size?: TiqFeatureIconSize
  variant?: TiqFeatureIconVariant
  signature?: boolean
  title?: string
  className?: string
  style?: CSSProperties
}

const iconSizes: Record<TiqFeatureIconSize, number> = {
  sm: 32,
  md: 48,
  lg: 72,
  xl: 96,
}

export const tiqFeatureIconNames: TiqFeatureIconName[] = [
  'exploreTennis',
  'improveTennis',
  'competeTennis',
  'captainTennis',
  'coachTennis',
  'leagueTennis',
  'clubTennis',
  'captainDashboard',
  'matchupAnalysis',
  'lineupBuilder',
  'scenarioBuilder',
  'messagingCenter',
  'playerRatings',
  'opponentScouting',
  'matchPrep',
  'reliabilityIndex',
  'teamRankings',
  'schedule',
  'reports',
  'alerts',
  'myLab',
  'accountSecurity',
  'clubOperations',
]

export const tiqFeatureIconLabels: Record<TiqFeatureIconName, string> = {
  exploreTennis: 'Explore tennis',
  improveTennis: 'Improve your tennis',
  competeTennis: 'Compete',
  captainTennis: 'Captain your team',
  coachTennis: 'Coach players',
  leagueTennis: 'Run leagues and tournaments',
  clubTennis: 'Run your club',
  captainDashboard: 'Captain dashboard',
  matchupAnalysis: 'Matchup analysis',
  lineupBuilder: 'Lineup builder',
  scenarioBuilder: 'Scenario builder',
  messagingCenter: 'Messaging center',
  playerRatings: 'Player ratings',
  opponentScouting: 'Opponent scouting',
  matchPrep: 'Match prep',
  reliabilityIndex: 'Reliability index',
  teamRankings: 'Team rankings',
  schedule: 'Schedule',
  reports: 'Reports',
  alerts: 'Alerts',
  myLab: 'My Lab',
  accountSecurity: 'Account security',
  clubOperations: 'Club operations',
}

const iconRegistry: Record<TiqFeatureIconName, Icon> = {
  exploreTennis: MagnifyingGlassIcon,
  improveTennis: TargetIcon,
  competeTennis: TrophyIcon,
  captainTennis: ListChecksIcon,
  coachTennis: ChalkboardTeacherIcon,
  leagueTennis: TreeStructureIcon,
  clubTennis: BuildingsIcon,
  captainDashboard: GaugeIcon,
  matchupAnalysis: TennisBallIcon,
  lineupBuilder: UsersThreeIcon,
  scenarioBuilder: ChalkboardTeacherIcon,
  messagingCenter: ChatCircleDotsIcon,
  playerRatings: ChartLineUpIcon,
  opponentScouting: BinocularsIcon,
  matchPrep: ClipboardTextIcon,
  reliabilityIndex: ShieldCheckIcon,
  teamRankings: RankingIcon,
  schedule: CalendarBlankIcon,
  reports: PresentationChartIcon,
  alerts: BellRingingIcon,
  myLab: FlaskIcon,
  accountSecurity: LockKeyIcon,
  clubOperations: BuildingsIcon,
}

export default function TiqFeatureIcon({
  name,
  size = 'md',
  variant = 'default',
  signature = name === 'myLab',
  title,
  className,
  style,
}: TiqFeatureIconProps) {
  const pixelSize = iconSizes[size]
  const glyphSize = Math.round(pixelSize * 0.8)
  const badgeSize = Math.max(9, Math.round(pixelSize * 0.25))
  const IconBody = iconRegistry[name]
  const label = title || tiqFeatureIconLabels[name]
  const showTennisBadge = name !== 'matchupAnalysis'

  return (
    <span
      className={[
        'tiq-feature-icon',
        signature ? 'tiq-feature-icon--signature' : null,
        className,
      ].filter(Boolean).join(' ')}
      data-icon-treatment={signature ? 'signature' : undefined}
      style={{
        ...shellStyle(pixelSize, variant),
        ...style,
      }}
      aria-label={label}
      role="img"
    >
      <IconBody
        aria-hidden="true"
        className="tiq-feature-icon__glyph"
        color="currentColor"
        focusable="false"
        size={glyphSize}
        weight={variant === 'ghost' ? 'regular' : 'duotone'}
      />
      {showTennisBadge ? (
        <TennisBallIcon
          aria-hidden="true"
          className="tiq-feature-icon__badge"
          color="var(--tiq-icon-accent)"
          focusable="false"
          size={badgeSize}
          weight="fill"
        />
      ) : null}
      <style jsx>{`
        .tiq-feature-icon {
          --tiq-icon-primary: var(--foreground-strong, #f8fbff);
          --tiq-icon-accent: var(--brand-green, #9be11d);
          isolation: isolate;
        }

        .tiq-feature-icon :global(.tiq-feature-icon__glyph) {
          filter: drop-shadow(0 3px 7px rgba(2, 10, 24, 0.28));
          transition: color 160ms ease, transform 160ms ease;
        }

        .tiq-feature-icon :global(.tiq-feature-icon__badge) {
          position: absolute;
          right: 8%;
          bottom: 8%;
          filter: drop-shadow(0 2px 4px rgba(2, 10, 24, 0.3));
          transition: transform 160ms ease;
        }

        .tiq-feature-icon--signature {
          position: relative;
          isolation: isolate;
          border-color: color-mix(in srgb, var(--brand-green, #9be11d) 54%, var(--brand-blue-2, #74beff) 18%) !important;
          background:
            radial-gradient(circle at 72% 24%, rgba(155, 225, 29, 0.2), transparent 28%),
            linear-gradient(145deg, rgba(13, 38, 64, 0.96), rgba(7, 20, 38, 0.98)) !important;
          box-shadow:
            0 14px 34px rgba(70, 158, 255, 0.14),
            0 0 0 1px rgba(155, 225, 29, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.12) !important;
        }

        .tiq-feature-icon--signature::after {
          position: absolute;
          inset: 10%;
          z-index: 0;
          border: 1px solid rgba(155, 225, 29, 0.16);
          border-radius: 28%;
          pointer-events: none;
          content: '';
        }

        .tiq-feature-icon--signature > svg {
          position: relative;
          z-index: 1;
        }

        .tiq-feature-icon--signature:hover {
          box-shadow:
            0 16px 38px rgba(155, 225, 29, 0.2),
            0 0 0 1px rgba(155, 225, 29, 0.16),
            inset 0 1px 0 rgba(255, 255, 255, 0.14) !important;
        }

        .tiq-feature-icon:hover {
          transform: translateY(-1px);
          border-color: color-mix(in srgb, var(--tiq-icon-accent) 48%, transparent);
          box-shadow: 0 12px 26px color-mix(in srgb, var(--tiq-icon-accent) 14%, transparent);
        }

        .tiq-feature-icon:hover :global(.tiq-feature-icon__glyph) {
          color: color-mix(in srgb, var(--tiq-icon-primary) 84%, var(--tiq-icon-accent) 16%);
          transform: scale(1.035);
        }

        .tiq-feature-icon:hover :global(.tiq-feature-icon__badge) {
          transform: rotate(7deg) scale(1.08);
        }

        @media (prefers-reduced-motion: reduce) {
          .tiq-feature-icon,
          .tiq-feature-icon :global(.tiq-feature-icon__glyph),
          .tiq-feature-icon :global(.tiq-feature-icon__badge) {
            transition: none;
          }
        }
      `}</style>
    </span>
  )
}

function shellStyle(pixelSize: number, variant: TiqFeatureIconVariant): CSSProperties {
  const base = {
    '--tiq-icon-primary': 'var(--foreground-strong, #f8fbff)',
    '--tiq-icon-accent': 'var(--brand-green, #9be11d)',
    position: 'relative',
    display: 'inline-grid',
    placeItems: 'center',
    width: pixelSize,
    height: pixelSize,
    flex: '0 0 auto',
    color: 'var(--tiq-icon-primary)',
    transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
  } as CSSProperties

  if (variant === 'ghost') return base

  return {
    ...base,
    borderRadius: Math.max(11, Math.round(pixelSize * 0.24)),
    border: variant === 'surface'
      ? '1px solid color-mix(in srgb, var(--brand-blue-2, #74beff) 24%, transparent)'
      : '1px solid transparent',
    background: variant === 'surface'
      ? 'color-mix(in srgb, var(--shell-chip-bg, #10213b) 88%, transparent)'
      : 'transparent',
    boxShadow: variant === 'surface'
      ? 'inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 24px rgba(2,10,24,0.16)'
      : 'none',
  }
}
