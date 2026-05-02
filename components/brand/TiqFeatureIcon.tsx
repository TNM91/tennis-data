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
      strokeWidth="4"
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

function PlayerBust({
  cx = 48,
  headCy = 28,
  r = 11,
  accent,
}: {
  cx?: number
  headCy?: number
  r?: number
  accent: string
}) {
  return (
    <>
      <BallHead cx={cx} cy={headCy} r={r} accent={accent} />
      <path
        d={`M${cx - 17} ${headCy + 34}v-8a17 17 0 0 1 ${34} 0v8`}
        stroke="currentColor"
      />
    </>
  )
}

function CaptainDashboardIcon({ accent, muted }: IconDrawProps) {
  return iconGroup(
    <>
      <path d="M17 34h52a6 6 0 0 1 6 6v38H17z" stroke="currentColor" />
      <BallHead cx={48} cy={23} r={11} accent={accent} />
      <path d="M27 48h18M27 60h14M27 72h24" stroke={muted} />
      <path d="M57 61h13M64 54v14" stroke={accent} />
      <path d="M56 61a11 11 0 1 0 11-11v11H56z" stroke={accent} />
      <path d="M48 34v8" stroke="currentColor" />
    </>,
  )
}

function MatchupAnalysisIcon({ accent, muted }: IconDrawProps) {
  return iconGroup(
    <>
      <PlayerBust cx={29} headCy={26} r={11} accent={accent} />
      <PlayerBust cx={67} headCy={26} r={11} accent={accent} />
      <path d="M43 40h10" stroke={accent} />
      <path d="M43 52h10" stroke={muted} strokeDasharray="3 7" />
      <path d="M43 64h10" stroke={accent} />
    </>,
  )
}

function LineupBuilderIcon({ accent, muted }: IconDrawProps) {
  return iconGroup(
    <>
      <BallHead cx={48} cy={20} r={11} accent={accent} />
      <path d="M48 31v9M19 40h58M19 40v17M38 40v17M58 40v17M77 40v17" stroke="currentColor" />
      <circle cx="19" cy="68" r="8" stroke="currentColor" />
      <circle cx="38" cy="68" r="8" stroke={accent} />
      <circle cx="58" cy="68" r="8" stroke="currentColor" />
      <circle cx="77" cy="68" r="8" stroke={accent} />
      <path d="M16 68h6M35 68h6M55 68h6M74 68h6" stroke={muted} />
    </>,
  )
}

function ScenarioBuilderIcon({ accent, muted }: IconDrawProps) {
  return iconGroup(
    <>
      <PlayerBust cx={31} headCy={27} r={11} accent={accent} />
      <path d="M52 70c17-2 16-16 5-18s-7-17 13-17" stroke="currentColor" strokeDasharray="5 8" />
      <circle cx="52" cy="70" r="4.5" stroke="currentColor" />
      <circle cx="70" cy="35" r="4.5" stroke="currentColor" />
      <path d="M72 18v26M72 18l17 7-17 7" stroke={accent} />
    </>,
  )
}

function MessagingCenterIcon({ accent }: IconDrawProps) {
  return iconGroup(
    <>
      <PlayerBust cx={31} headCy={27} r={11} accent={accent} />
      <path d="M52 34h29a6 6 0 0 1 6 6v22a6 6 0 0 1-6 6H69L55 79V68h-3a6 6 0 0 1-6-6V40a6 6 0 0 1 6-6z" stroke="currentColor" />
      <path d="M59 51h.1M70 51h.1M81 51h.1" stroke={accent} strokeWidth="5" />
    </>,
  )
}

function PlayerRatingsIcon({ accent }: IconDrawProps) {
  return iconGroup(
    <>
      <PlayerBust cx={25} headCy={30} r={11} accent={accent} />
      <path d="M52 76V62M66 76V52M80 76V40" stroke="currentColor" />
      <path d="M50 56l12-11 10 7 12-18" stroke={accent} />
      <circle cx="50" cy="56" r="3.5" stroke={accent} />
      <circle cx="62" cy="45" r="3.5" stroke={accent} />
      <circle cx="72" cy="52" r="3.5" stroke={accent} />
      <circle cx="84" cy="34" r="3.5" stroke={accent} />
    </>,
  )
}

function OpponentScoutingIcon({ accent, muted }: IconDrawProps) {
  return iconGroup(
    <>
      <PlayerBust cx={28} headCy={29} r={11} accent={accent} />
      <circle cx="64" cy="49" r="19" stroke="currentColor" />
      <path d="M64 37v24M52 49h24" stroke={muted} />
      <path d="M78 63l12 12" stroke="currentColor" />
      <path d="M58 58V46M65 58V38M72 58V50" stroke={accent} />
    </>,
  )
}

function MatchPrepIcon({ accent, muted }: IconDrawProps) {
  return iconGroup(
    <>
      <path d="M27 21h42v58H27z" stroke="currentColor" />
      <path d="M39 21v-7h18v7" stroke="currentColor" />
      <path d="M38 39l6 6 10-11M38 55l6 6 10-11M38 71l6 6 10-11" stroke={accent} />
      <path d="M60 41h16M60 57h16M60 73h16" stroke={muted} />
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
      <BallHead cx={48} cy={24} r={11} accent={accent} />
      <path d="M22 77V62h52v15M34 62V50h28v12M43 50V38h10v12" stroke="currentColor" />
      <path d="M48 61v16" stroke="currentColor" />
      <path d="M48 42v14" stroke={accent} />
      <path d="M45 45l3-3 3 3" stroke={accent} />
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
      <BallHead cx={48} cy={22} r={10.5} accent={accent} />
      <path d="M28 72c0-13 5-21 5-32a15 15 0 0 1 30 0c0 11 5 19 5 32H28z" stroke="currentColor" />
      <path d="M40 79c2 5 14 5 16 0" stroke="currentColor" />
      <path d="M22 49c-5 8-5 15 0 22M74 49c5 8 5 15 0 22" stroke={accent} />
      <path d="M36 72h24" stroke={muted} />
    </>,
  )
}

function MyLabIcon({ accent, muted }: IconDrawProps) {
  return iconGroup(
    <>
      <path d="M18 73h60v8H18z" stroke="currentColor" />
      <path d="M24 36h48v37H24z" stroke="currentColor" />
      <BallHead cx={48} cy={29} r={11} accent={accent} />
      <path d="M34 60l10-10 9 7 13-17" stroke={accent} />
      <path d="M34 66h31M59 61v-9M67 61V44" stroke={muted} />
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
