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
    src: '/brand/web/header-logo-transparent.png',
    width: 6118,
    height: 1947,
  },
  legacyPrimaryReverse: {
    src: '/brand/web/header-logo-transparent.png',
    width: 6118,
    height: 1947,
  },
  legacySymbol: {
    src: '/tenaceiq-icon-512.png',
    width: 512,
    height: 512,
  },
  legacySymbolReverse: {
    src: '/tenaceiq-icon-512.png',
    width: 512,
    height: 512,
  },
  primary: {
    src: '/brand/web/header-logo-transparent.png',
    width: 6118,
    height: 1947,
  },
  primaryReverse: {
    src: '/brand/web/header-logo-transparent.png',
    width: 6118,
    height: 1947,
  },
  symbol: {
    src: '/tenaceiq-icon-512.png',
    width: 512,
    height: 512,
  },
  symbolReverse: {
    src: '/tenaceiq-icon-512.png',
    width: 512,
    height: 512,
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
