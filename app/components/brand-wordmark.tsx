'use client'

import Image from 'next/image'

export default function BrandWordmark({
  compact = false,
  footer = false,
  top = false,
}: {
  compact?: boolean
  footer?: boolean
  top?: boolean
}) {
  const iconSize = compact ? 28 : top ? 36 : footer ? 32 : 30
  const fontSize = compact ? 23 : top ? 29 : footer ? 26 : 25

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? '8px' : '11px',
        lineHeight: 1,
      }}
    >
      <Image
        src="/logo-icon.png"
        alt="TenAceIQ"
        width={iconSize}
        height={iconSize}
        priority={top}
        style={{
          width: `${iconSize}px`,
          height: `${iconSize}px`,
          display: 'block',
          objectFit: 'contain',
          filter: top
            ? 'drop-shadow(0 6px 16px rgba(37,91,227,0.14))'
            : 'none',
        }}
      />

      <div
        style={{
          fontWeight: 900,
          letterSpacing: '-0.042em',
          fontSize: `${fontSize}px`,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'baseline',
          textRendering: 'geometricPrecision',
        }}
      >
        <span style={{ color: footer ? '#FFFFFF' : '#F8FBFF' }}>TenAce</span>
        <span
          style={{
            background: 'linear-gradient(135deg, #9BE11D 0%, #7ED321 45%, #C7F36B 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginLeft: '2px',
            filter: footer ? 'brightness(1.02)' : 'none',
          }}
        >
          IQ
        </span>
      </div>
    </div>
  )
}
