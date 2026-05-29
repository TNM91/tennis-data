'use client'

import { useEffect } from 'react'
import { trackProductUsageEvent } from '@/lib/product-usage-client'
import type { ProductUsageEventInput } from '@/lib/product-usage-events'

export default function ProductEventTracker({ event }: { event: ProductUsageEventInput }) {
  useEffect(() => {
    void trackProductUsageEvent(event)
  }, [event])

  return null
}
