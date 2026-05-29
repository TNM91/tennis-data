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
    <svg aria-hidden="true" className={className} viewBox="-8 -8 16 16">
      <circle cx="0" cy="0" fill="#DFFF73" r="6" stroke="#07101E" strokeWidth="1.4" />
      <path d="M-5.2.1C-2.7-4.1 1.1-3.1 3.4.1 4.6 1.8 5.5 1.6 6.2.4" fill="none" stroke="#6EA600" strokeLinecap="round" strokeWidth="1.4" />
    </svg>
  )
}
