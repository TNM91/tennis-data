'use client'

import Image from 'next/image'

type BrandWordmarkProps = {
  compact?: boolean
  footer?: boolean
  top?: boolean
}

export default function BrandWordmark({
  compact = false,
  footer = false,
  top = false,
}: BrandWordmarkProps) {
  const iconSize = top ? (compact ? 52 : 64) : footer ? 38 : compact ? 44 : 46
  const fontSize = top ? (compact ? 29 : 36) : footer ? 26 : compact ? 24 : 25
  const gap = top ? (compact ? '11px' : '13px') : compact ? '9px' : '10px'

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap,
        lineHeight: 1,
        minWidth: 0,
      }}
    >
      <Image
        src="/logo-icon.png"
        alt="TenAceIQ"
        width={iconSize}
        height={iconSize}
        priority={top}
        sizes={
          top
            ? '(max-width: 820px) 52px, 64px'
            : footer
              ? '38px'
              : compact
                ? '44px'
                : '46px'
        }
        style={{
          width: `${iconSize}px`,
          height: `${iconSize}px`,
          display: 'block',
          objectFit: 'contain',
          objectPosition: 'center',
          flexShrink: 0,
          transform: top ? 'translateY(1px)' : 'translateY(0.5px)',
          filter: top
            ? 'drop-shadow(0 8px 18px rgba(37,91,227,0.18))'
            : footer
              ? 'drop-shadow(0 4px 10px rgba(8,17,29,0.18))'
              : 'drop-shadow(0 5px 12px rgba(37,91,227,0.12))',
        }}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          minWidth: 0,
          fontWeight: 900,
          letterSpacing: top ? '-0.048em' : '-0.042em',
          fontSize: `${fontSize}px`,
          lineHeight: 0.96,
          textRendering: 'geometricPrecision',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ color: footer ? '#FFFFFF' : '#F8FBFF' }}>TenAce</span>
        <span
          style={{
            marginLeft: '2px',
            background: 'linear-gradient(135deg, #9BE11D 0%, #7ED321 45%, #C7F36B 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: footer ? 'brightness(1.03)' : 'none',
          }}
        >
          IQ
        </span>
      </div>
    </div>
  )
}