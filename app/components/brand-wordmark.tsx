'use client'

import Image from 'next/image'

type BrandWordmarkProps = {
  compact?: boolean
  footer?: boolean
  legacyNav?: boolean
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
  legacyPrimary: {
    src: '/tenaceiq/logos/tenaceiq-primary-horizontal.svg',
    width: 1600,
    height: 420,
  },
  legacyPrimaryReverse: {
    src: '/tenaceiq/logos/tenaceiq-primary-horizontal-reverse.svg',
    width: 1600,
    height: 420,
  },
  legacySymbol: {
    src: '/tenaceiq/logos/tenaceiq-symbol.svg',
    width: 1045,
    height: 490,
  },
  legacySymbolReverse: {
    src: '/tenaceiq/logos/tenaceiq-symbol-reverse.svg',
    width: 1045,
    height: 490,
  },
  primary: {
    src: '/tiq/logo/tiq-lockup-dark.png',
    width: 2048,
    height: 537,
  },
  primaryReverse: {
    src: '/tiq/logo/tiq-lockup-light.png',
    width: 2048,
    height: 537,
  },
  symbol: {
    src: '/tiq/logo/tiq-q-icon-dark.png',
    width: 1024,
    height: 1024,
  },
  symbolReverse: {
    src: '/tiq/logo/tiq-app-icon.png',
    width: 1024,
    height: 1024,
  },
} satisfies Record<string, BrandAsset>

function getBrandAsset({ compact, footer, legacyNav, onLight }: BrandWordmarkProps) {
  if (legacyNav) {
    if (compact) return onLight ? BRAND_ASSETS.legacySymbol : BRAND_ASSETS.legacySymbolReverse
    return onLight ? BRAND_ASSETS.legacyPrimary : BRAND_ASSETS.legacyPrimaryReverse
  }
  if (compact) return onLight ? BRAND_ASSETS.symbol : BRAND_ASSETS.symbolReverse
  if (footer) return BRAND_ASSETS.primaryReverse
  return onLight ? BRAND_ASSETS.primary : BRAND_ASSETS.primaryReverse
}

export default function BrandWordmark({
  compact = false,
  footer = false,
  legacyNav = false,
  onLight = false,
  siteHeaderCompact = false,
  top = false,
}: BrandWordmarkProps) {
  const asset = getBrandAsset({ compact, footer, legacyNav, onLight, top })
  const height = compact ? (top ? 36 : 34) : footer ? 42 : top ? (siteHeaderCompact ? 42 : 64) : 48
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
