'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/app/components/auth-provider'
import { CAPTAIN_PILOT_PRICE_LABEL } from '@/lib/captain-pilot'
import { trackProductUsageEvent } from '@/lib/product-usage-client'
import styles from './captain-pilot-billing-notice.module.css'

type PilotStatus = {
  active: boolean
  requestId: string | null
  trialEndsAt: string | null
  billingRequired: boolean
}

export default function CaptainPilotBillingNotice({ returnTo }: { returnTo: string }) {
  const { session, authResolved } = useAuth()
  const [pilot, setPilot] = useState<PilotStatus | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authResolved || !session?.access_token) return
    const controller = new AbortController()
    void fetch('/api/captain-pilot/status', {
      signal: controller.signal,
      cache: 'no-store',
      headers: { Authorization: `Bearer ${session.access_token}` },
    }).then(async (response) => {
      const body = await response.json().catch(() => null) as { ok?: boolean; pilot?: PilotStatus | null } | null
      if (response.ok && body?.ok) setPilot(body.pilot ?? null)
    }).catch((loadError: unknown) => {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return
    })
    return () => controller.abort()
  }, [authResolved, session?.access_token])

  const trialEndsAtMs = pilot?.trialEndsAt ? Date.parse(pilot.trialEndsAt) : Number.NaN
  const daysRemaining = Number.isFinite(trialEndsAtMs)
    ? Math.ceil((trialEndsAtMs - Date.now()) / (24 * 60 * 60 * 1000))
    : null
  const showNotice = pilot?.active && pilot.billingRequired && pilot.requestId && daysRemaining !== null && daysRemaining <= 30
  if (!showNotice || dismissed) return null

  const trialDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(trialEndsAtMs))
  const expired = daysRemaining <= 0

  async function addBilling() {
    if (!session?.access_token || !pilot?.requestId || submitting) return
    setSubmitting(true)
    setError('')
    void trackProductUsageEvent({
      eventName: 'captain_pilot_billing_clicked',
      surface: 'captain',
      planId: 'captain',
      metadata: { daysRemaining, source: 'captain_pilot_renewal' },
    })
    try {
      const response = await fetch('/api/checkout/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ requestId: pilot.requestId, nextHref: returnTo }),
      })
      const body = await response.json().catch(() => null) as { ok?: boolean; message?: string; url?: string } | null
      if (!response.ok || !body?.ok || !body.url) throw new Error(body?.message || 'Billing could not be opened.')
      window.location.assign(body.url)
    } catch (billingError) {
      setError(billingError instanceof Error ? billingError.message : 'Billing could not be opened.')
      setSubmitting(false)
    }
  }

  return (
    <aside className={styles.notice} data-urgent={daysRemaining <= 7 ? 'true' : 'false'} aria-label="Captain Pilot billing reminder">
      <div>
        <strong>{expired ? 'Keep your Captain tools active.' : `Your free Captain Pilot ends ${trialDate}.`}</strong>
        <span>{expired
          ? `Add billing to continue at ${CAPTAIN_PILOT_PRICE_LABEL}.`
          : daysRemaining <= 2
            ? `Your pilot is almost over. Add billing to continue for ${CAPTAIN_PILOT_PRICE_LABEL}.`
            : `Add billing now and pay nothing before ${trialDate}. Then continue for ${CAPTAIN_PILOT_PRICE_LABEL}.`}</span>
        {error ? <em role="status">{error}</em> : null}
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={() => void addBilling()} disabled={submitting}>
          {submitting ? 'Opening Stripe…' : 'Add billing'}
        </button>
        <button type="button" className={styles.secondary} onClick={() => setDismissed(true)}>Not now</button>
      </div>
    </aside>
  )
}
