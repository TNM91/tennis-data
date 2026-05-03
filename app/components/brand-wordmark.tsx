'use client'

import Image from 'next/image'
import { useTheme } from '@/app/components/theme-provider'

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
  const { theme } = useTheme()
  const width = compact ? 176 : top ? 276 : footer ? 288 : 236
  const height = compact ? 30 : top ? 46 : footer ? 48 : 40
  const logoSrc = theme === 'dark' ? '/logo-header-dark.svg' : '/logo-header-light.svg'

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
        priority={top}
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
