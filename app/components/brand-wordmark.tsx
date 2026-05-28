'use client'

import Image from 'next/image'

type BrandWordmarkProps = {
  compact?: boolean
  footer?: boolean
  onLight?: boolean
  top?: boolean
}

export default function BrandWordmark({
  compact = false,
  footer = false,
  onLight = false,
  top = false,
}: BrandWordmarkProps) {
  const width = compact ? 140 : top ? 174 : footer ? 174 : 156
  const height = compact ? 45 : top ? 56 : footer ? 56 : 50
  const logoSrc = onLight ? '/logo-header-light.svg' : '/logo-header-dark.svg'
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-flex',
        width: `${width}px`,
        height: `${height}px`,
        flexShrink: 0,
        minWidth: 0,
      }}
    >
      <Image
        src={logoSrc}
        alt="TenAceIQ"
        fill
        loading="eager"
        fetchPriority={footer ? undefined : 'high'}
        sizes={`${width}px`}
        style={{
          objectFit: 'contain',
          objectPosition: 'left center',
          filter: onLight
            ? 'drop-shadow(0 6px 12px rgba(7, 18, 38, 0.08))'
            : footer
            ? 'drop-shadow(0 8px 16px rgba(5, 14, 30, 0.10))'
            : 'drop-shadow(0 8px 18px rgba(155, 225, 29, 0.10))',
        }}
      />
    </span>
  )
}
