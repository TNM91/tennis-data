'use client'

import Link from 'next/link'
import type { CSSProperties, MouseEventHandler, ReactNode } from 'react'
import { trackProductUsageEvent } from '@/lib/product-usage-client'
import type { ProductUsageEventName, ProductUsageEventSurface } from '@/lib/product-usage-events'

export type ProductLinkEvent = {
  eventName: ProductUsageEventName
  surface: ProductUsageEventSurface
  metadata?: Record<string, unknown>
}

export default function TrackedProductLink({
  href,
  children,
  style,
  className,
  ariaLabel,
  event,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: {
  href: string
  children: ReactNode
  style?: CSSProperties
  className?: string
  ariaLabel?: string
  event?: ProductLinkEvent
  onClick?: MouseEventHandler<HTMLAnchorElement>
  onMouseEnter?: MouseEventHandler<HTMLAnchorElement>
  onMouseLeave?: MouseEventHandler<HTMLAnchorElement>
}) {
  const handleClick: MouseEventHandler<HTMLAnchorElement> = (clickEvent) => {
    if (event) void trackProductUsageEvent(event)
    onClick?.(clickEvent)
  }

  return (
    <Link
      href={href}
      style={style}
      className={className}
      aria-label={ariaLabel}
      onClick={handleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </Link>
  )
}
