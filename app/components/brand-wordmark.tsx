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
  const width = compact ? 208 : top ? 288 : footer ? 288 : 244
  const height = compact ? 35 : top ? 48 : footer ? 48 : 41
  const logoSrc = '/logo-header-dark.svg'
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
          filter: footer
            ? 'drop-shadow(0 6px 14px rgba(5, 14, 30, 0.08))'
            : 'drop-shadow(0 6px 16px rgba(5, 14, 30, 0.10))',
        }}
      />
    </span>
  )
}
