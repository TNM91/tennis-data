'use client'

import Image from 'next/image'

type BrandWordmarkProps = {
  compact?: boolean
  footer?: boolean
  top?: boolean
}

export function BrandWordmark({
  compact = false,
  footer = false,
  top = false,
}: BrandWordmarkProps) {
  const iconSize = compact ? 30 : top ? 38 : footer ? 36 : 34
  const fontSize = compact ? 24 : top ? 30 : footer ? 27 : 27

  return (
    <div className="brand-wordmark">
      <Image
        src="/logo-icon.png"
        alt="TenAceIQ"
        width={iconSize}
        height={iconSize}
        priority={top}
        style={{ width: iconSize, height: iconSize }}
      />
      <div
        className="brand-wordmark-text"
        style={{ fontSize }}
      >
        <span className={footer ? 'brand-wordmark-tenace brand-wordmark-tenace-footer' : 'brand-wordmark-tenace'}>
          TenAce
        </span>
        <span className="brand-wordmark-iq">IQ</span>
      </div>
    </div>
  )
}
