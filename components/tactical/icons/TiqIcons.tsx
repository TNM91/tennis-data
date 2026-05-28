type IconProps = {
  className?: string
}

type PlayerIconProps = IconProps & {
  handedness?: 'righty' | 'lefty'
}

type MarkerIconProps = IconProps & {
  type: 'ball' | 'cone'
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
        <circle cx="0" cy="-9" fill="#07101E" r="5.2" strokeWidth="1.6" />
        <path d="M-4.7-8.9C-2.5-12.2.1-11.5 2.1-8.8 3.3-7.2 4.6-7.2 5.2-8.5" strokeWidth="1.35" />
        <path d="M0-3.3V7.2M0-1.2l-6 4.3M0-1.2l6.8-.7M0 7.2l-5.2 7.2M0 7.2l5.8 6.5" strokeWidth="1.7" />
        <path d="M5.9-1.8c2.4-1.4 3.9-3.2 4.6-5.5" strokeWidth="1.15" />
        <ellipse cx="11.1" cy="-8.7" rx="2.4" ry="3.1" strokeWidth="1.1" transform="rotate(24 11.1 -8.7)" />
      </g>
    </svg>
  )
}

export function MarkerIcon({ className, type }: MarkerIconProps) {
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
