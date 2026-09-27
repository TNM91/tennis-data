'use client'

import Link from 'next/link'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/csr/ArrowRight'
import { CheckCircleIcon } from '@phosphor-icons/react/dist/csr/CheckCircle'
import { CreditCardIcon } from '@phosphor-icons/react/dist/csr/CreditCard'
import { LockKeyIcon } from '@phosphor-icons/react/dist/csr/LockKey'
import { WarningCircleIcon } from '@phosphor-icons/react/dist/csr/WarningCircle'
import TiqFeatureIcon from '@/components/brand/TiqFeatureIcon'
import styles from './profile-plan-card.module.css'

type PlanTone = 'active' | 'attention' | 'neutral'

export default function ProfilePlanCard({
  planName,
  priceLabel,
  billingLabel,
  statusLabel,
  summary,
  tone,
  destinationHref,
  destinationLabel,
  canManageBilling,
  billingPortalOpening,
  billingMessage,
  billingMessageIsError,
  onManageBilling,
}: {
  planName: string
  priceLabel: string
  billingLabel: string
  statusLabel: string
  summary: string
  tone: PlanTone
  destinationHref: string
  destinationLabel: string
  canManageBilling: boolean
  billingPortalOpening: boolean
  billingMessage: string
  billingMessageIsError: boolean
  onManageBilling: () => void
}) {
  const StatusIcon = tone === 'attention' ? WarningCircleIcon : CheckCircleIcon

  return (
    <section className={styles.card} data-profile-plan-card="true" aria-labelledby="profile-plan-title">
      <div className={styles.header}>
        <TiqFeatureIcon name="accountSecurity" size="md" variant="surface" />
        <div className={styles.identity}>
          <span>Your plan</span>
          <h2 id="profile-plan-title">{planName}</h2>
        </div>
        <span className={`${styles.status} ${styles[tone]}`}>
          <StatusIcon aria-hidden="true" size={14} weight="fill" />
          {statusLabel}
        </span>
      </div>

      <div className={styles.facts} aria-label={`${planName} billing summary`}>
        <div>
          <span>Price</span>
          <strong>{priceLabel}</strong>
        </div>
        <div>
          <span>Billing</span>
          <strong>{billingLabel}</strong>
        </div>
      </div>

      <p className={styles.summary}>{summary}</p>

      <div className={styles.actions}>
        {canManageBilling ? (
          <button type="button" onClick={onManageBilling} disabled={billingPortalOpening}>
            <CreditCardIcon aria-hidden="true" size={19} weight="bold" />
            {billingPortalOpening ? 'Opening Stripe…' : 'Manage billing'}
            <ArrowRightIcon aria-hidden="true" size={18} weight="bold" />
          </button>
        ) : (
          <Link href="/pricing" className={styles.primaryLink}>
            Compare plans
            <ArrowRightIcon aria-hidden="true" size={18} weight="bold" />
          </Link>
        )}
        <Link href={destinationHref} className={styles.destinationLink}>Open {destinationLabel}</Link>
      </div>

      {billingMessage ? (
        <p className={billingMessageIsError ? styles.error : styles.message} role={billingMessageIsError ? 'alert' : 'status'}>
          {billingMessage}
        </p>
      ) : null}

      {canManageBilling ? (
        <p className={styles.secureNote}>
          <LockKeyIcon aria-hidden="true" size={14} weight="fill" />
          Payment methods, invoices, and cancellation open securely in Stripe.
        </p>
      ) : null}
    </section>
  )
}
