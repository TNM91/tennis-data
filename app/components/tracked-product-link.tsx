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
}: {
  href: string
  children: ReactNode
  style?: CSSProperties
  className?: string
  ariaLabel?: string
  event?: ProductLinkEvent
}) {
  const handleClick: MouseEventHandler<HTMLAnchorElement> = () => {
    if (!event) return
    void trackProductUsageEvent(event)
  }

  return (
    <Link href={href} style={style} className={className} aria-label={ariaLabel} onClick={handleClick}>
      {children}
    </Link>
  )
}
