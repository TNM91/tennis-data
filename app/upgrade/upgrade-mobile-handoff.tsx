'use client'

import Link from 'next/link'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/csr/ArrowRight'
import { CheckCircleIcon } from '@phosphor-icons/react/dist/csr/CheckCircle'
import { LockKeyIcon } from '@phosphor-icons/react/dist/csr/LockKey'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import styles from './upgrade-mobile-handoff.module.css'

type MobileUpgradeAction =
  | { kind: 'link'; href: string; label: string }
  | { kind: 'button'; label: string; disabled: boolean; onClick: () => void }

export default function UpgradeMobileHandoff({
  icon,
  planName,
  priceLabel,
  alternatePriceNote,
  title,
  body,
  benefits,
  outcome,
  destinationLabel,
  active,
  checkoutEnabled,
  checkoutSubmitting,
  checkoutError,
  checkoutSuccessMessage,
  successSteps,
  primaryAction,
  accountHref,
  accountLabel,
}: {
  icon: TiqFeatureIconName
  planName: string
  priceLabel: string
  alternatePriceNote?: string
  title: string
  body: string
  benefits: string[]
  outcome: string
  destinationLabel: string
  active: boolean
  checkoutEnabled: boolean
  checkoutSubmitting: boolean
  checkoutError: string
  checkoutSuccessMessage: string
  successSteps: string[]
  primaryAction: MobileUpgradeAction
  accountHref?: string
  accountLabel?: string
}) {
  const statusCopy = checkoutSuccessMessage || checkoutError

  if (checkoutSuccessMessage) {
    return (
      <section className={`${styles.shell} ${styles.receipt}`} data-upgrade-mobile-receipt="true" aria-labelledby="mobile-upgrade-title">
        <div className={styles.planHeader}>
          <TiqFeatureIcon name={icon} size="md" variant="surface" />
          <div className={styles.planIdentity}>
            <span>Plan active</span>
            <strong>{planName}</strong>
          </div>
          <span className={styles.activeBadge}>Active</span>
        </div>

        <div className={styles.receiptHero}>
          <span className={styles.receiptMark} aria-hidden="true">
            <CheckCircleIcon size={30} weight="fill" />
          </span>
          <div className={styles.receiptCopy}>
            <span>Payment confirmed</span>
            <h1 id="mobile-upgrade-title">{title}</h1>
            <p>{body}</p>
          </div>
        </div>

        <div className={styles.readyNow}>
          <strong>Ready now</strong>
          <ol>
            {successSteps.map((step, index) => (
              <li key={step}>
                <span>{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        {primaryAction.kind === 'link' ? (
          <Link href={primaryAction.href} className={styles.primaryAction}>
            {primaryAction.label}
            <ArrowRightIcon aria-hidden="true" size={20} weight="bold" />
          </Link>
        ) : null}

        <p className={styles.receiptMeta}>{priceLabel} plan confirmed. Your workspace will be here when you are ready.</p>
      </section>
    )
  }

  return (
    <section className={styles.shell} data-upgrade-mobile-handoff="true" aria-labelledby="mobile-upgrade-title">
      <div className={styles.planHeader}>
        <TiqFeatureIcon name={icon} size="md" variant="surface" />
        <div className={styles.planIdentity}>
          <span>Selected plan</span>
          <strong>{planName}</strong>
        </div>
        <div className={styles.price}>
          <strong>{active ? 'Active' : priceLabel}</strong>
          {alternatePriceNote ? <small>{alternatePriceNote}</small> : null}
        </div>
      </div>

      <div className={styles.copy}>
        <h1 id="mobile-upgrade-title">{title}</h1>
        <p>{body}</p>
      </div>

      <ul className={styles.benefits} aria-label={`${planName} highlights`}>
        {benefits.slice(0, 2).map((benefit) => (
          <li key={benefit}>
            <CheckCircleIcon aria-hidden="true" size={18} weight="fill" />
            <span>{benefit}</span>
          </li>
        ))}
      </ul>

      <details className={styles.details}>
        <summary>Everything included</summary>
        <div className={styles.detailsBody}>
          <p>{outcome}</p>
          {benefits.length > 2 ? (
            <ul>
              {benefits.slice(2).map((benefit) => <li key={benefit}>{benefit}</li>)}
            </ul>
          ) : null}
        </div>
      </details>

      <div className={styles.checkoutSummary}>
        {active
          ? <CheckCircleIcon aria-hidden="true" size={20} weight="fill" />
          : <LockKeyIcon aria-hidden="true" size={20} weight="fill" />}
        <div>
          <strong>{active ? `${destinationLabel} is ready` : checkoutEnabled ? 'Secure checkout' : 'Early access'}</strong>
          <span>
            {active
              ? `Open ${destinationLabel} with this plan.`
              : checkoutEnabled
                ? `Your ${planName} choice stays selected through Stripe.`
                : 'Save this plan now. No payment information is collected.'}
          </span>
        </div>
      </div>

      {primaryAction.kind === 'link' ? (
        <Link href={primaryAction.href} className={styles.primaryAction}>
          {primaryAction.label}
          <ArrowRightIcon aria-hidden="true" size={20} weight="bold" />
        </Link>
      ) : (
        <button
          type="button"
          className={styles.primaryAction}
          onClick={primaryAction.onClick}
          disabled={primaryAction.disabled}
        >
          {primaryAction.label}
          <ArrowRightIcon aria-hidden="true" size={20} weight="bold" />
        </button>
      )}

      {statusCopy ? (
        <p className={checkoutError ? styles.error : styles.status} role={checkoutError ? 'alert' : 'status'}>
          {statusCopy}
        </p>
      ) : checkoutSubmitting ? (
        <p className={styles.status} role="status">Keeping {planName} selected while checkout opens…</p>
      ) : null}

      <div className={styles.secondaryActions}>
        {accountHref && accountLabel ? <Link href={accountHref}>{accountLabel}</Link> : null}
        <Link href="/pricing">Change plan</Link>
      </div>
    </section>
  )
}
