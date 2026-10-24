'use client'

import Image from 'next/image'

type BrandWordmarkProps = {
  compact?: boolean
  footer?: boolean
  onLight?: boolean
  responsiveHeader?: boolean
  siteHeaderCompact?: boolean
  top?: boolean
}

type BrandAsset = {
  src: string
  width: number
  height: number
}

const BRAND_ASSETS = {
  header: {
    src: '/brand/web/header-logo-transparent.png?v=20261024-approved-v1',
    width: 2109,
    height: 461,
  },
  headerOnLight: {
    src: '/brand/web/header-logo-light-bg.png?v=20261024-approved-v1',
    width: 2158,
    height: 483,
  },
  compact: {
    src: '/brand/approved/TiQ_White_Transparent_Refined.png?v=20261024-approved-v1',
    width: 1774,
    height: 887,
  },
  compactOnLight: {
    src: '/brand/approved/TiQ_Navy_Transparent_Corrected.png?v=20261024-approved-v1',
    width: 1774,
    height: 887,
  },
  footer: {
    src: '/brand/web/footer-logo-dark-bg.png?v=20261024-approved-v1',
    width: 2109,
    height: 461,
  },
  footerOnLight: {
    src: '/brand/web/footer-logo-light-bg.png?v=20261024-approved-v1',
    width: 2158,
    height: 483,
  },
} satisfies Record<string, BrandAsset>

function getBrandAsset({ compact, footer, onLight }: BrandWordmarkProps) {
  if (compact) return onLight ? BRAND_ASSETS.compactOnLight : BRAND_ASSETS.compact
  if (footer) return onLight ? BRAND_ASSETS.footerOnLight : BRAND_ASSETS.footer
  return onLight ? BRAND_ASSETS.headerOnLight : BRAND_ASSETS.header
}

export default function BrandWordmark({
  compact = false,
  footer = false,
  onLight = false,
  responsiveHeader = false,
  siteHeaderCompact = false,
  top = false,
}: BrandWordmarkProps) {
  if (responsiveHeader) return <ResponsiveHeaderBrand />

  const asset = getBrandAsset({ compact, footer, onLight, top })
  const height = compact ? (top ? 36 : 34) : footer ? 32 : top ? (siteHeaderCompact ? 32 : 44) : 36
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

function ResponsiveHeaderBrand() {
  return (
    <span className="site-header-brand-picture">
      <Image
        src={BRAND_ASSETS.header.src}
        alt="TenAceIQ"
        width={BRAND_ASSETS.header.width}
        height={BRAND_ASSETS.header.height}
        loading="eager"
        fetchPriority="high"
        sizes="(max-width: 819px) 178px, 200px"
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          objectPosition: 'left center',
        }}
      />
    </span>
  )
}
