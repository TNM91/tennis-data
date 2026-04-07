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
  const isHeader = top
  const isFooter = footer

  const iconSize = isHeader ? (compact ? 52 : 58) : isFooter ? 48 : compact ? 42 : 46
  const fontSize = isHeader ? (compact ? 28 : 32) : isFooter ? 27 : compact ? 22 : 24
  const gap = isHeader ? (compact ? 6 : 7) : isFooter ? 6 : 5

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${gap}px`,
        lineHeight: 1,
        minWidth: 0,
        overflow: 'visible',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: `${iconSize}px`,
          height: `${iconSize}px`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transform: isHeader ? 'translateY(0.5px)' : 'translateY(0.25px)',
          overflow: 'visible',
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
            objectFit: 'contain',
            objectPosition: 'center',
            display: 'block',
            flexShrink: 0,
            filter: isHeader
              ? 'drop-shadow(0 10px 22px rgba(37,91,227,0.16))'
              : isFooter
                ? 'drop-shadow(0 8px 16px rgba(8,17,29,0.14))'
                : 'drop-shadow(0 8px 16px rgba(37,91,227,0.10))',
          }}
        />
      </span>

      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          minWidth: 0,
          fontWeight: 900,
          fontSize: `${fontSize}px`,
          letterSpacing: isHeader ? '-0.055em' : '-0.05em',
          lineHeight: 0.92,
          whiteSpace: 'nowrap',
          paddingRight: '2px',
          textRendering: 'geometricPrecision',
        }}
      >
        <span style={{ color: isFooter ? '#FFFFFF' : '#F8FBFF' }}>TenAce</span>
        <span
          style={{
            marginLeft: isHeader ? '1.5px' : '1px',
            background: 'linear-gradient(135deg, #9BE11D 0%, #7ED321 45%, #C7F36B 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: isFooter ? 'brightness(1.03)' : 'none',
          }}
        >
          IQ
        </span>
      </div>
    </div>
  )
}
