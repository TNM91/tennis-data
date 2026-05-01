'use client'

import { useId, type CSSProperties, type ReactNode } from 'react'

export type TiqFeatureIconName =
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

export type TiqFeatureIconSize = 'sm' | 'md' | 'lg' | 'xl'
export type TiqFeatureIconVariant = 'default' | 'surface' | 'ghost'

type TiqFeatureIconProps = {
  name: TiqFeatureIconName
  size?: TiqFeatureIconSize
  variant?: TiqFeatureIconVariant
  title?: string
  className?: string
  style?: CSSProperties
}

type IconDrawProps = {
  accent: string
  muted: string
}

const iconSizes: Record<TiqFeatureIconSize, number> = {
  sm: 32,
  md: 48,
  lg: 72,
  xl: 96,
}

export const tiqFeatureIconNames: TiqFeatureIconName[] = [
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
]

export const tiqFeatureIconLabels: Record<TiqFeatureIconName, string> = {
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
}

const iconRegistry: Record<TiqFeatureIconName, (props: IconDrawProps) => ReactNode> = {
  captainDashboard: CaptainDashboardIcon,
  matchupAnalysis: MatchupAnalysisIcon,
  lineupBuilder: LineupBuilderIcon,
  scenarioBuilder: ScenarioBuilderIcon,
  messagingCenter: MessagingCenterIcon,
  playerRatings: PlayerRatingsIcon,
  opponentScouting: OpponentScoutingIcon,
  matchPrep: MatchPrepIcon,
  reliabilityIndex: ReliabilityIndexIcon,
  teamRankings: TeamRankingsIcon,
  schedule: ScheduleIcon,
  reports: ReportsIcon,
  alerts: AlertsIcon,
  myLab: MyLabIcon,
  accountSecurity: AccountSecurityIcon,
}

export default function TiqFeatureIcon({
  name,
  size = 'md',
  variant = 'default',
  title,
  className,
  style,
}: TiqFeatureIconProps) {
  const pixelSize = iconSizes[size]
  const IconBody = iconRegistry[name]
  const label = title || tiqFeatureIconLabels[name]

  return (
    <span
      className={['tiq-feature-icon', className].filter(Boolean).join(' ')}
      style={{
        ...shellStyle(pixelSize, variant),
        ...style,
      }}
      aria-label={label}
      role="img"
    >
      <svg
        viewBox="0 0 96 96"
        width={pixelSize}
        height={pixelSize}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={svgStyle}
      >
        {IconBody({
          accent: 'var(--tiq-icon-accent, var(--brand-green, #9be11d))',
          muted: 'var(--tiq-icon-muted, var(--brand-blue-2, #74beff))',
        })}
      </svg>
      <style jsx>{`
        .tiq-feature-icon:hover {
          --tiq-icon-shadow: rgba(155, 225, 29, 0.18);
          transform: translateY(-1px);
          border-color: color-mix(in srgb, var(--brand-green, #9be11d) 34%, transparent);
        }

        .tiq-feature-icon:hover :global(.tiq-accent-shift) {
          transform: translateX(1px);
        }
      `}</style>
    </span>
  )
}

function shellStyle(pixelSize: number, variant: TiqFeatureIconVariant): CSSProperties {
  const base = {
    '--tiq-icon-accent': 'var(--brand-green, #9be11d)',
    '--tiq-icon-muted': 'color-mix(in srgb, var(--brand-blue-2, #74beff) 62%, var(--foreground, #f8fbff) 38%)',
    '--tiq-icon-border': 'color-mix(in srgb, var(--brand-blue-2, #74beff) 18%, transparent)',
    '--tiq-icon-shadow': 'rgba(155,225,29,0)',
    display: 'inline-grid',
    placeItems: 'center',
    width: pixelSize,
    height: pixelSize,
    color: 'var(--foreground-strong, var(--foreground, #f8fbff))',
    transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
  } as CSSProperties

  if (variant === 'ghost') return base

  return {
    ...base,
    borderRadius: Math.max(12, Math.round(pixelSize * 0.2)),
    border: variant === 'surface' ? '1px solid var(--tiq-icon-border)' : '1px solid transparent',
    background: variant === 'surface' ? 'color-mix(in srgb, var(--surface-soft, #0f203a) 72%, transparent)' : 'transparent',
    boxShadow: '0 16px 32px var(--tiq-icon-shadow)',
  }
}

const svgStyle: CSSProperties = {
  display: 'block',
  overflow: 'visible',
}

function iconGroup(children: ReactNode) {
  return (
    <g
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="3.4"
      style={{ vectorEffect: 'non-scaling-stroke' }}
    >
      {children}
    </g>
  )
}

function BallHead({
  cx = 48,
  cy = 22,
  r = 12,
  accent,
  seam = 'low',
}: {
  cx?: number
  cy?: number
  r?: number
  accent: string
  seam?: 'low' | 'high'
}) {
  const reactId = useId()
  const strokeWidth = Math.max(1.7, r * 0.16)
  const offset = seam === 'high' ? -r * 0.06 : 0
  const clipId = `tiq-ball-${reactId.replaceAll(':', '')}`
  const seamPath = [
    `M${cx - r * 0.818} ${cy - r * 0.091 + offset}`,
    `C${cx - r * 0.5} ${cy - r * 0.727 + offset}`,
    `${cx + r * 0.364} ${cy + r * 0.636 + offset}`,
    `${cx + r * 0.818} ${cy + offset}`,
  ].join(' ')

  return (
    <g className="tiq-ball-head">
      <defs>
        <clipPath id={clipId}>
          <circle cx={cx} cy={cy} r={r - strokeWidth * 0.35} />
        </clipPath>
      </defs>
      <circle cx={cx} cy={cy} r={r} stroke="currentColor" strokeWidth={strokeWidth} />
      <g clipPath={`url(#${clipId})`}>
        <path
          className="tiq-accent-shift"
          d={seamPath}
          stroke={accent}
          strokeWidth={strokeWidth}
          style={{ transition: 'transform 160ms ease' }}
        />
      </g>
    </g>
  )
}

function CaptainDashboardIcon({ accent, muted }: IconDrawProps) {
  return iconGroup(
    <>
      <BallHead cx={48} cy={23} r={10} accent={accent} />
      <path d="M18 42h44a5 5 0 0 1 5 5v24H13V47a5 5 0 0 1 5-5z" stroke="currentColor" />
      <path d="M23 53h14M23 62h10M23 71h22" stroke="currentColor" />
      <path d="M48 66h13M56 59v14" stroke={accent} />
      <path d="M50 66a10 10 0 1 0 10-10v10H50z" stroke={accent} />
      <path d="M48 42V34" stroke={muted} />
    </>,
  )
}

function MatchupAnalysisIcon({ accent, muted }: IconDrawProps) {
  return iconGroup(
    <>
      <BallHead cx={30} cy={26} r={10.5} accent={accent} />
      <BallHead cx={66} cy={26} r={10.5} accent={accent} />
      <path d="M18 70v-8a12 12 0 0 1 24 0v8M54 70v-8a12 12 0 0 1 24 0v8" stroke="currentColor" />
      <path d="M42 38h12" stroke={accent} />
      <path d="M42 50h12" stroke="currentColor" strokeDasharray="3 7" />
      <path d="M42 61h12" stroke={accent} strokeDasharray="8 7" />
    </>,
  )
}

function LineupBuilderIcon({ accent, muted }: IconDrawProps) {
  return iconGroup(
    <>
      <BallHead cx={48} cy={21} r={10} accent={accent} />
      <path d="M48 31v8M18 39h60M18 39v15M38 39v15M58 39v15M78 39v15" stroke="currentColor" />
      <circle cx="18" cy="64" r="7" stroke="currentColor" />
      <circle cx="38" cy="64" r="7" stroke={accent} />
      <circle cx="58" cy="64" r="7" stroke="currentColor" />
      <circle cx="78" cy="64" r="7" stroke={accent} />
      <path d="M15.5 64h5M35.5 64h5M55.5 64h5M75.5 64h5" stroke={muted} />
    </>,
  )
}

function ScenarioBuilderIcon({ accent, muted }: IconDrawProps) {
  return iconGroup(
    <>
      <BallHead cx={34} cy={26} r={10.5} accent={accent} />
      <path d="M22 70v-8a12 12 0 0 1 24 0v8" stroke="currentColor" />
      <path d="M50 62c7-1 8-7 4-10s-1-10 10-10" stroke="currentColor" strokeDasharray="5 8" />
      <circle cx="50" cy="62" r="4" stroke="currentColor" />
      <circle cx="66" cy="42" r="4" stroke="currentColor" />
      <path d="M68 20v24M68 20l17 7-17 7" stroke={accent} />
    </>,
  )
}

function MessagingCenterIcon({ accent }: IconDrawProps) {
  return iconGroup(
    <>
      <BallHead cx={34} cy={26} r={10.5} accent={accent} />
      <path d="M22 70v-8a12 12 0 0 1 24 0v8" stroke="currentColor" />
      <path d="M54 34h27a5 5 0 0 1 5 5v20a5 5 0 0 1-5 5H68L55 75V64h-1a5 5 0 0 1-5-5V39a5 5 0 0 1 5-5z" stroke="currentColor" />
      <path d="M61 49h.1M70 49h.1M79 49h.1" stroke={accent} />
    </>,
  )
}

function PlayerRatingsIcon({ accent }: IconDrawProps) {
  return iconGroup(
    <>
      <BallHead cx={28} cy={30} r={11} accent={accent} />
      <path d="M15 78v-8a13 13 0 0 1 26 0v8" stroke="currentColor" />
      <path d="M50 75V58M64 75V49M78 75V38" stroke="currentColor" />
      <path d="M47 49l13-13 10 7 12-17" stroke={accent} />
      <circle cx="47" cy="49" r="3" stroke={accent} />
      <circle cx="60" cy="36" r="3" stroke={accent} />
      <circle cx="70" cy="43" r="3" stroke={accent} />
      <circle cx="82" cy="26" r="3" stroke={accent} />
    </>,
  )
}

function OpponentScoutingIcon({ accent, muted }: IconDrawProps) {
  return iconGroup(
    <>
      <BallHead cx={28} cy={30} r={11} accent={accent} />
      <path d="M15 78v-8a13 13 0 0 1 26 0v8" stroke="currentColor" />
      <circle cx="62" cy="49" r="18" stroke="currentColor" />
      <path d="M62 37v24M50 49h24" stroke={muted} />
      <path d="M75 62l13 13" stroke="currentColor" />
      <path d="M56 57V45M63 57V37M70 57V49" stroke={accent} />
    </>,
  )
}

function MatchPrepIcon({ accent, muted }: IconDrawProps) {
  return iconGroup(
    <>
      <path d="M29 22h38v55H29z" stroke="currentColor" />
      <path d="M40 22v-6h16v6" stroke="currentColor" />
      <path d="M39 40l5 5 9-10M39 54l5 5 9-10M39 68l5 5 9-10" stroke={accent} />
      <path d="M59 42h15M59 56h15M59 70h15" stroke={muted} />
    </>,
  )
}

function ReliabilityIndexIcon({ accent, muted }: IconDrawProps) {
  return iconGroup(
    <>
      <path d="M48 16c12 8 22 9 32 10v19c0 18-12 29-32 37-20-8-32-19-32-37V26c10-1 20-2 32-10z" stroke="currentColor" />
      <BallHead cx={48} cy={48} r={12} accent={accent} />
      <circle cx="70" cy="66" r="11" stroke={accent} />
      <path d="M65 66l4 4 7-9" stroke={accent} />
      <path d="M28 30c7 2 14 1 20-3" stroke={muted} />
    </>,
  )
}

function TeamRankingsIcon({ accent }: IconDrawProps) {
  return iconGroup(
    <>
      <BallHead cx={48} cy={24} r={10} accent={accent} />
      <path d="M24 75V61h48v14M34 61V50h28v11M43 50V39h10v11" stroke="currentColor" />
      <path d="M48 61v14" stroke="currentColor" />
      <path d="M45 45h6M48 45v12" stroke={accent} />
    </>,
  )
}

function ScheduleIcon({ accent, muted }: IconDrawProps) {
  return iconGroup(
    <>
      <path d="M18 24h50v55H18z" stroke="currentColor" />
      <path d="M18 38h50M29 16v14M57 16v14" stroke="currentColor" />
      <path d="M29 50h8M48 50h8M29 62h8M48 62h8" stroke={muted} />
      <circle cx="69" cy="70" r="11" stroke={accent} />
      <path d="M69 64v6l5 3" stroke={accent} />
    </>,
  )
}

function ReportsIcon({ accent, muted }: IconDrawProps) {
  return iconGroup(
    <>
      <path d="M25 18h37l12 12v48H25z" stroke="currentColor" />
      <path d="M62 18v13h12" stroke="currentColor" />
      <path d="M36 36h18M36 49h22M36 62h14" stroke={muted} />
      <circle cx="68" cy="65" r="12" stroke={accent} />
      <path d="M68 53v12h12" stroke={accent} />
    </>,
  )
}

function AlertsIcon({ accent, muted }: IconDrawProps) {
  return iconGroup(
    <>
      <BallHead cx={48} cy={23} r={9.5} accent={accent} />
      <path d="M29 72c0-13 4-20 4-31a15 15 0 0 1 30 0c0 11 4 18 4 31H29z" stroke="currentColor" />
      <path d="M40 79c2 5 14 5 16 0" stroke="currentColor" />
      <path d="M22 49c-5 8-5 15 0 22M74 49c5 8 5 15 0 22" stroke={accent} />
      <path d="M36 72h24" stroke={muted} />
    </>,
  )
}

function MyLabIcon({ accent, muted }: IconDrawProps) {
  return iconGroup(
    <>
      <path d="M18 72h60v8H18z" stroke="currentColor" />
      <path d="M25 35h46v37H25z" stroke="currentColor" />
      <BallHead cx={48} cy={28} r={10} accent={accent} />
      <path d="M34 59l10-10 9 7 12-16" stroke={accent} />
      <path d="M34 65h30M59 60v-9M66 60V44" stroke={muted} />
    </>,
  )
}

function AccountSecurityIcon({ accent }: IconDrawProps) {
  return iconGroup(
    <>
      <path d="M30 42V31a18 18 0 0 1 36 0v11" stroke="currentColor" />
      <path d="M24 42h48v39H24z" stroke="currentColor" />
      <BallHead cx={48} cy={61} r={12} accent={accent} />
    </>,
  )
}
