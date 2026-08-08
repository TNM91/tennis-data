'use client'

import Image, { getImageProps } from 'next/image'

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
    src: '/brand/web/header-logo-transparent.png',
    width: 6118,
    height: 1947,
  },
  headerOnLight: {
    src: '/brand/logos/tenaceiq-full-for-light-bg.png',
    width: 6138,
    height: 1957,
  },
  compact: {
    src: '/brand/web/header-iq-compact.png',
    width: 1552,
    height: 1614,
  },
  compactOnLight: {
    src: '/brand/logos/tenaceiq-iq-for-light-bg.png',
    width: 1552,
    height: 1614,
  },
  footer: {
    src: '/brand/web/footer-logo-dark-bg.png',
    width: 6118,
    height: 1947,
  },
  footerOnLight: {
    src: '/brand/web/footer-logo-light-bg.png',
    width: 6118,
    height: 1947,
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

function ResponsiveHeaderBrand() {
  const common = {
    alt: 'TenAceIQ',
    fetchPriority: 'high' as const,
  }
  const {
    props: { srcSet: desktopSrcSet },
  } = getImageProps({
    ...common,
    src: BRAND_ASSETS.header.src,
    width: BRAND_ASSETS.header.width,
    height: BRAND_ASSETS.header.height,
    sizes: '168px',
  })
  const {
    props: { srcSet: mobileSrcSet, ...mobileImageProps },
  } = getImageProps({
    ...common,
    src: BRAND_ASSETS.compact.src,
    width: BRAND_ASSETS.compact.width,
    height: BRAND_ASSETS.compact.height,
    sizes: '35px',
  })

  return (
    <picture className="site-header-brand-picture">
      <source media="(min-width: 820px)" srcSet={desktopSrcSet} />
      <source media="(max-width: 819px)" srcSet={mobileSrcSet} />
      <img
        {...mobileImageProps}
        alt="TenAceIQ"
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          objectPosition: 'left center',
        }}
      />
    </picture>
  )
}
