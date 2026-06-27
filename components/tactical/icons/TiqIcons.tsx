type IconProps = {
  className?: string
}

type PlayerIconProps = IconProps & {
  handedness?: 'righty' | 'lefty'
}

type MarkerIconProps = IconProps & {
  type: 'ball' | 'cone' | 'x' | 'o'
}

export function PlayerIcon({ className, handedness = 'righty' }: PlayerIconProps) {
  return (
    <svg aria-hidden="true" className={className} viewBox="-16 -18 32 40">
      <defs>
        <filter id={`tiq-player-glow-${handedness}`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="0" stdDeviation="1.4" floodColor="#9BE11D" floodOpacity=".55" />
        </filter>
      </defs>
      <g
        fill="none"
        filter={`url(#tiq-player-glow-${handedness})`}
        stroke="#9BE11D"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={handedness === 'lefty' ? 'scale(-1 1)' : undefined}
      >
        <ellipse cx="0" cy="12" fill="#9BE11D" opacity=".22" rx="8.5" ry="2" stroke="none" />
        <circle cx="0" cy="-9" fill="#07101E" r="5.7" strokeWidth="1.55" />
        <path d="M-5.1-8.8C-2.6-12.8.1-12.2 2.5-8.7 3.9-6.7 5-6.9 5.8-8.4" strokeWidth="1.35" />
        <path d="M0-3.1V7.5M0-.9l-6.3 4.1M0-.9l6.3 4.1M0 7.5l-5.5 7.4M0 7.5l5.5 7.4" strokeWidth="1.8" />
      </g>
    </svg>
  )
}

export function MarkerIcon({ className, type }: MarkerIconProps) {
  if (type === 'x' || type === 'o') {
    return (
      <svg aria-hidden="true" className={className} viewBox="-10 -10 20 20">
        {type === 'x' ? (
          <g fill="none" stroke="#9BE11D" strokeLinecap="round" strokeWidth="3">
            <path d="M-5.8-5.8 5.8 5.8" />
            <path d="M5.8-5.8-5.8 5.8" />
          </g>
        ) : (
          <circle cx="0" cy="0" fill="none" r="6.2" stroke="#9BE11D" strokeWidth="2.8" />
        )}
      </svg>
    )
  }

  if (type === 'cone') {
    return (
      <svg aria-hidden="true" className={className} viewBox="-8 -8 16 16">
        <path d="M0-6.2 5.5 5.2h-11z" fill="#FFC257" stroke="#07101E" strokeLinejoin="round" strokeWidth="1.1" />
        <path d="M-6.5 5.2h13" fill="none" stroke="#9BE11D" strokeLinecap="round" strokeWidth="1.2" />
        <path d="M-2.2.8h4.4" stroke="#07101E" strokeLinecap="round" strokeWidth=".9" />
      </svg>
    )
  }

  return (
    <svg aria-hidden="true" className={className} viewBox="-10 -10 20 20">
      <g className="tiq-tennis-ball-marker">
        <circle cx="0" cy="0" fill="#07101E" opacity="0.82" r="8.85" />
        <circle cx="0" cy="0" fill="#A8F000" r="8" stroke="#07101E" strokeWidth="1.35" />
        <path d="M-6.75 3.45C-3.95 8.28 3.74 8.46 6.9 3.8A8.02 8.02 0 0 1-6.75 3.45Z" fill="#5F9808" opacity="0.38" />
        <ellipse cx="-2.45" cy="-3.85" fill="#ECFF69" opacity="0.46" rx="2.85" ry="1.55" transform="rotate(-24 -2.45 -3.85)" />
        <path
          className="classic-tennis-ball-seam"
          d="M-7.35-3.55C-4.4-6.75 1.9-6.38 4.48-2.28C6.46 0.88 0.72 2.45 1.58 7.35"
          fill="none"
          stroke="#07101E"
          strokeLinecap="round"
          strokeOpacity="0.28"
          strokeWidth="3.7"
        />
        <path
          className="classic-tennis-ball-seam"
          d="M-7.08-3.42C-4.24-6.34 1.62-5.98 4.02-2.12C5.72.64 0.28 2.22 1.08 7.1"
          fill="none"
          stroke="#F8FFE2"
          strokeLinecap="round"
          strokeWidth="2.55"
        />
      </g>
    </svg>
  )
}
