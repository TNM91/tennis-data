'use client'

import { supabase } from '@/lib/supabase'
import type { ProductUsageEventInput } from './product-usage-events'

export async function trackProductUsageEvent(input: ProductUsageEventInput) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) return

    await fetch('/api/product-events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(input),
      keepalive: true,
    })
  } catch {
    // Product usage tracking must never interrupt the user's tennis workflow.
  }
}
