'use client'

import { supabase } from '@/lib/supabase'
import type { ProductUsageEventInput } from './product-usage-events'

export async function trackProductUsageEvent(input: ProductUsageEventInput, accessToken?: string) {
  try {
    const token = accessToken || (await supabase.auth.getSession()).data.session?.access_token
    if (!token) return

    await fetch('/api/product-events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
      keepalive: true,
    })
  } catch {
    // Product usage tracking must never interrupt the user's tennis workflow.
  }
}
