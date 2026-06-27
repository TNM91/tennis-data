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
        <circle cx="0" cy="0" fill="#07101E" opacity="0.72" r="7.3" />
        <circle cx="0" cy="0" fill="#DFFF5D" r="6.6" stroke="#07101E" strokeWidth="1.05" />
        <path d="M-5.8 2.4C-3.5 6.1 1.2 6.8 4.6 4.15 5.55 3.4 6.2 2.55 6.55 1.7A6.7 6.7 0 0 1-5.8 2.4Z" fill="#8FC50F" opacity="0.54" />
        <ellipse cx="-2.1" cy="-3.15" fill="#F5FF9B" opacity="0.76" rx="2.45" ry="1.55" transform="rotate(-26 -2.1 -3.15)" />
        <path d="M-6.52.25C-3.85-3.98.7-3.55 3.18-.35 4.42 1.25 5.4 1.08 6.12.12" fill="none" stroke="#07101E" strokeLinecap="round" strokeOpacity="0.18" strokeWidth="2.35" />
        <path d="M-6.15-.9C-3.65-4.95.95-4.42 3.45-1.15 4.75.55 5.72.38 6.42-.58" fill="none" stroke="#F8FFE2" strokeLinecap="round" strokeWidth="1.45" />
        <path d="M-6.18 1.05C-3.25-1.92.65-1.6 3.08.98 4.32 2.28 5.23 2.2 5.98 1.35" fill="none" stroke="#5F9308" strokeLinecap="round" strokeWidth="1.18" />
      </g>
    </svg>
  )
}
