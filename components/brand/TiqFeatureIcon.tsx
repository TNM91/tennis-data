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
  accentSoft: string
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
  const reactId = useId()
  const cleanId = reactId.replaceAll(':', '')
  const plateId = `tiq-icon-plate-${cleanId}`
  const ballFillId = `tiq-icon-ball-fill-${cleanId}`
  const ballGlowId = `tiq-icon-ball-glow-${cleanId}`

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
        <defs>
          <radialGradient id={plateId} cx="50%" cy="34%" r="64%">
            <stop offset="0%" stopColor="var(--tiq-icon-plate-hot)" />
            <stop offset="58%" stopColor="var(--tiq-icon-plate-mid)" />
            <stop offset="100%" stopColor="var(--tiq-icon-plate-cool)" />
          </radialGradient>
          <radialGradient id={ballFillId} cx="38%" cy="28%" r="78%">
            <stop offset="0%" stopColor="var(--tiq-icon-ball-hot)" />
            <stop offset="100%" stopColor="var(--tiq-icon-ball-fill)" />
          </radialGradient>
          <filter id={ballGlowId} x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="var(--tiq-icon-accent)" floodOpacity="0.18" />
          </filter>
        </defs>
        {variant !== 'ghost' ? (
          <circle cx="48" cy="48" r="43" fill={`url(#${plateId})`} opacity="0.58" />
        ) : null}
        {IconBody({
          accent: 'var(--tiq-icon-accent, var(--brand-green, #9be11d))',
          muted: 'var(--tiq-icon-muted, var(--brand-blue-2, #74beff))',
          accentSoft: 'var(--tiq-icon-accent-soft, rgba(155,225,29,0.18))',
        })}
      </svg>
      <style jsx>{`
        .tiq-feature-icon {
          --tiq-icon-primary: var(--foreground-strong, #f8fbff);
          --tiq-icon-accent: var(--brand-green, #9be11d);
          --tiq-icon-accent-soft: rgba(var(--brand-green-rgb, 155, 225, 29), 0.18);
          --tiq-icon-muted: color-mix(in srgb, var(--brand-blue-2, #74beff) 64%, var(--foreground-strong, #f8fbff) 36%);
          --tiq-icon-ball-fill: color-mix(in srgb, var(--shell-panel-bg-strong, #0f203a) 72%, transparent);
          --tiq-icon-ball-hot: color-mix(in srgb, var(--foreground-strong, #f8fbff) 10%, transparent);
          --tiq-icon-plate-hot: color-mix(in srgb, var(--brand-blue-2, #74beff) 16%, transparent);
          --tiq-icon-plate-mid: color-mix(in srgb, var(--brand-green, #9be11d) 5%, transparent);
          --tiq-icon-plate-cool: transparent;
        }

        :global(:root[data-theme='light']) .tiq-feature-icon {
          --tiq-icon-primary: #0b1b31;
          --tiq-icon-muted: color-mix(in srgb, var(--brand-blue-2, #2f6fcf) 72%, #0b1b31 28%);
          --tiq-icon-ball-fill: rgba(255, 255, 255, 0.86);
          --tiq-icon-ball-hot: #ffffff;
          --tiq-icon-plate-hot: rgba(47, 111, 207, 0.10);
          --tiq-icon-plate-mid: rgba(155, 225, 29, 0.08);
        }

        .tiq-feature-icon:hover {
          --tiq-icon-shadow: rgba(155, 225, 29, 0.22);
          transform: translateY(-2px) scale(1.015);
          border-color: color-mix(in srgb, var(--brand-green, #9be11d) 42%, transparent);
        }

        .tiq-feature-icon:hover :global(.tiq-accent-shift) {
          transform: translateX(1.6px);
        }

        .tiq-feature-icon:hover :global(.tiq-icon-pulse) {
          opacity: 1;
          transform: scale(1.04);
        }
      `}</style>
    </span>
  )
}

function shellStyle(pixelSize: number, variant: TiqFeatureIconVariant): CSSProperties {
  const base = {
    '--tiq-icon-border': 'color-mix(in srgb, var(--brand-blue-2, #74beff) 22%, transparent)',
    '--tiq-icon-shadow': 'rgba(155,225,29,0)',
    display: 'inline-grid',
    placeItems: 'center',
    width: pixelSize,
    height: pixelSize,
    color: 'var(--tiq-icon-primary, var(--foreground-strong, var(--foreground, #f8fbff)))',
    transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
  } as CSSProperties

  if (variant === 'ghost') return base

  return {
    ...base,
    borderRadius: Math.max(12, Math.round(pixelSize * 0.22)),
    border: variant === 'surface' ? '1px solid var(--tiq-icon-border)' : '1px solid transparent',
    background:
      variant === 'surface'
        ? 'linear-gradient(145deg, color-mix(in srgb, var(--shell-chip-bg, #10213b) 86%, transparent), color-mix(in srgb, var(--shell-panel-bg, #071326) 78%, transparent))'
        : 'transparent',
    boxShadow: '0 18px 38px var(--tiq-icon-shadow), inset 0 1px 0 rgba(255,255,255,0.08)',
  }
}

const svgStyle: CSSProperties = {
  display: 'block',
  overflow: 'visible',
  shapeRendering: 'geometricPrecision',
}

function iconGroup(children: ReactNode) {
  return (
    <g
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="3.45"
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
  const strokeWidth = Math.max(1.65, r * 0.15)
  const offset = seam === 'high' ? -r * 0.08 : 0
  const clipId = `tiq-ball-${reactId.replaceAll(':', '')}`
  const seamPath = [
    `M${cx - r * 0.86} ${cy - r * 0.02 + offset}`,
    `C${cx - r * 0.58} ${cy - r * 0.54 + offset}`,
    `${cx - r * 0.08} ${cy - r * 0.20 + offset}`,
    `${cx + r * 0.12} ${cy + r * 0.06 + offset}`,
    `C${cx + r * 0.38} ${cy + r * 0.40 + offset}`,
    `${cx + r * 0.70} ${cy + r * 0.34 + offset}`,
    `${cx + r * 0.90} ${cy + r * 0.05 + offset}`,
  ].join(' ')

  return (
    <g className="tiq-ball-head">
      <defs>
        <clipPath id={clipId}>
          <circle cx={cx} cy={cy} r={r - strokeWidth * 0.35} />
        </clipPath>
      </defs>
      <circle className="tiq-icon-pulse" cx={cx} cy={cy} r={r + 4} fill={accent} opacity="0.08" style={{ transformOrigin: `${cx}px ${cy}px`, transition: 'opacity 160ms ease, transform 160ms ease' }} />
      <circle cx={cx} cy={cy} r={r} fill="var(--tiq-icon-ball-fill, transparent)" stroke="currentColor" strokeWidth={strokeWidth} />
      <g clipPath={`url(#${clipId})`}>
        <path
          d={seamPath}
          stroke="color-mix(in srgb, var(--tiq-icon-primary, currentColor) 22%, transparent)"
          strokeWidth={strokeWidth + 1.35}
          opacity="0.36"
        />
        <path
          className="tiq-accent-shift"
          d={seamPath}
          stroke={accent}
          strokeWidth={strokeWidth + 0.2}
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

function CaptainDashboardIcon({ accent, muted, accentSoft }: IconDrawProps) {
  return iconGroup(
    <>
      <path d="M16 36h52a7 7 0 0 1 7 7v35H16z" fill={accentSoft} opacity="0.2" stroke="currentColor" />
      <BallHead cx={47} cy={25} r={10.5} accent={accent} />
      <path d="M47 35v8" stroke="currentColor" />
      <path d="M27 50h18M27 61h14M27 72h22" stroke={muted} />
      <path d="M57 54h9a9 9 0 0 1 0 18h-9z" stroke="currentColor" />
      <path d="M63 48v30" stroke={accent} />
      <path d="M58 66h12M64 59v14" stroke={accent} />
    </>,
  )
}

function MatchupAnalysisIcon({ accent, muted, accentSoft }: IconDrawProps) {
  return iconGroup(
    <>
      <PlayerBust cx={27} headCy={27} r={10.5} accent={accent} />
      <PlayerBust cx={69} headCy={27} r={10.5} accent={accent} />
      <path d="M42 38h12M42 52h12M42 66h12" stroke={muted} />
      <circle cx="48" cy="38" r="4.5" fill={accentSoft} stroke={accent} />
      <circle cx="48" cy="66" r="4.5" fill={accentSoft} stroke={accent} />
      <path d="M35 52h26" stroke={accent} strokeDasharray="2 7" />
      <path d="M40 76h16" stroke="currentColor" />
    </>,
  )
}

function LineupBuilderIcon({ accent, muted, accentSoft }: IconDrawProps) {
  return iconGroup(
    <>
      <BallHead cx={48} cy={21} r={10.5} accent={accent} />
      <path d="M48 32v9M20 41h56M20 41v14M39 41v14M57 41v14M76 41v14" stroke="currentColor" />
      <circle cx="20" cy="66" r="8.5" fill="transparent" stroke="currentColor" />
      <circle cx="39" cy="66" r="8.5" fill={accentSoft} stroke={accent} />
      <circle cx="57" cy="66" r="8.5" fill="transparent" stroke="currentColor" />
      <circle cx="76" cy="66" r="8.5" fill={accentSoft} stroke={accent} />
      <path d="M17 66h6M36 66h6M54 66h6M73 66h6" stroke={muted} />
      <path d="M32 79h32" stroke={accent} />
    </>,
  )
}

function ScenarioBuilderIcon({ accent, muted, accentSoft }: IconDrawProps) {
  return iconGroup(
    <>
      <PlayerBust cx={29} headCy={28} r={10.5} accent={accent} />
      <path d="M48 72c18-2 19-16 8-19s-7-17 14-18" stroke="currentColor" strokeDasharray="4 7" />
      <circle cx="48" cy="72" r="4.5" fill={accentSoft} stroke="currentColor" />
      <circle cx="70" cy="35" r="4.5" fill={accentSoft} stroke="currentColor" />
      <path d="M72 18v27M72 18l17 7-17 7" stroke={accent} />
      <path d="M52 52l10-8" stroke={muted} />
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

function PlayerRatingsIcon({ accent, muted, accentSoft }: IconDrawProps) {
  return iconGroup(
    <>
      <PlayerBust cx={24} headCy={31} r={10.5} accent={accent} />
      <path d="M48 78h39" stroke={muted} />
      <path d="M53 78V64M66 78V54M79 78V42" stroke="currentColor" />
      <path d="M50 58l12-12 10 7 13-19" stroke={accent} />
      <circle cx="50" cy="58" r="3.5" fill={accentSoft} stroke={accent} />
      <circle cx="62" cy="46" r="3.5" fill={accentSoft} stroke={accent} />
      <circle cx="72" cy="53" r="3.5" fill={accentSoft} stroke={accent} />
      <circle cx="85" cy="34" r="3.5" fill={accentSoft} stroke={accent} />
    </>,
  )
}

function OpponentScoutingIcon({ accent, muted, accentSoft }: IconDrawProps) {
  return iconGroup(
    <>
      <PlayerBust cx={27} headCy={30} r={10.5} accent={accent} />
      <circle cx="65" cy="49" r="19" fill={accentSoft} opacity="0.2" stroke="currentColor" />
      <circle cx="65" cy="49" r="8" stroke={muted} />
      <path d="M65 35v28M51 49h28" stroke={muted} />
      <path d="M79 63l11 11" stroke="currentColor" />
      <path d="M58 58V49M65 58V41M72 58V52" stroke={accent} />
    </>,
  )
}

function MatchPrepIcon({ accent, muted, accentSoft }: IconDrawProps) {
  return iconGroup(
    <>
      <path d="M26 23h44v56H26z" fill={accentSoft} opacity="0.16" stroke="currentColor" />
      <path d="M39 23v-7h18v7" stroke="currentColor" />
      <path d="M38 40l6 6 10-11M38 56l6 6 10-11M38 72l6 6 10-11" stroke={accent} />
      <path d="M60 41h16M60 57h16M60 73h16" stroke={muted} />
      <path d="M33 29h30" stroke="currentColor" />
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

function MyLabIcon({ accent, muted, accentSoft }: IconDrawProps) {
  return iconGroup(
    <>
      <path d="M17 74h62v7H17z" stroke="currentColor" />
      <path d="M24 36h48v38H24z" fill={accentSoft} opacity="0.16" stroke="currentColor" />
      <BallHead cx={48} cy={29} r={10.5} accent={accent} />
      <path d="M34 62l10-10 9 7 13-18" stroke={accent} />
      <circle cx="44" cy="52" r="3" fill={accentSoft} stroke={accent} />
      <circle cx="53" cy="59" r="3" fill={accentSoft} stroke={accent} />
      <path d="M34 67h31M59 63v-9M67 63V44" stroke={muted} />
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
