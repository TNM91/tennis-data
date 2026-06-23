'use client'

import Image from 'next/image'

type BrandWordmarkProps = {
  compact?: boolean
  footer?: boolean
  onLight?: boolean
  siteHeaderCompact?: boolean
  top?: boolean
}

type BrandAsset = {
  src: string
  width: number
  height: number
}

const BRAND_ASSETS = {
  primary: {
    src: '/tenaceiq/logos/tenaceiq-primary-horizontal.svg',
    width: 1600,
    height: 420,
  },
  primaryReverse: {
    src: '/tenaceiq/logos/tenaceiq-primary-horizontal-reverse.svg',
    width: 1600,
    height: 420,
  },
  symbol: {
    src: '/tenaceiq/logos/tenaceiq-symbol.svg',
    width: 1045,
    height: 490,
  },
  symbolReverse: {
    src: '/tenaceiq/logos/tenaceiq-symbol-reverse.svg',
    width: 1045,
    height: 490,
  },
} satisfies Record<string, BrandAsset>

function getBrandAsset({ compact, footer, onLight }: BrandWordmarkProps) {
  if (compact) return onLight ? BRAND_ASSETS.symbol : BRAND_ASSETS.symbolReverse
  if (footer) return BRAND_ASSETS.primaryReverse
  return onLight ? BRAND_ASSETS.primary : BRAND_ASSETS.primaryReverse
}

export default function BrandWordmark({
  compact = false,
  footer = false,
  onLight = false,
  siteHeaderCompact = false,
  top = false,
}: BrandWordmarkProps) {
  const asset = getBrandAsset({ compact, footer, onLight, top })
  const height = compact ? (top ? 40 : 34) : footer ? 42 : top ? (siteHeaderCompact ? 46 : 64) : 48
  const width = Math.round((asset.width / asset.height) * height)

  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        width: `${width}px`,
        height: `${height}px`,
        flexShrink: 0,
        minWidth: 0,
        aspectRatio: `${asset.width} / ${asset.height}`,
      }}
    >
      <Image
        src={asset.src}
        alt="TenAceIQ"
        width={asset.width}
        height={asset.height}
        loading="eager"
        fetchPriority={footer ? undefined : 'high'}
        sizes={`${width}px`}
        style={{
          display: 'block',
          width: 'auto',
          height: '100%',
          objectFit: 'contain',
          objectPosition: 'left center',
        }}
      />
    </span>
  )
}
