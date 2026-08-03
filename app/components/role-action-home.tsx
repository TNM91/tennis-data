import type { TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import TiqFeatureIcon from '@/components/brand/TiqFeatureIcon'
import TrackedProductLink, { type ProductLinkEvent } from './tracked-product-link'
import styles from './role-action-home.module.css'

export type RoleHomeAction = {
  label: string
  title: string
  detail: string
  cta: string
  href: string
  icon: TiqFeatureIconName
  event?: ProductLinkEvent
}

export type RoleHomeQuickAction = {
  title: string
  detail: string
  href: string
  icon: TiqFeatureIconName
  event?: ProductLinkEvent
}

export type RoleHomeStep = {
  title: string
  detail: string
}

export default function RoleActionHome({
  roleLabel,
  contextLabel,
  contextValue,
  primaryAction,
  quickActions,
  helpTitle,
  steps,
  showSteps = false,
}: {
  roleLabel: string
  contextLabel: string
  contextValue: string
  primaryAction: RoleHomeAction
  quickActions: readonly RoleHomeQuickAction[]
  helpTitle: string
  steps: readonly RoleHomeStep[]
  showSteps?: boolean
}) {
  return (
    <section className={styles.shell} aria-label={`${roleLabel} home`}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.eyebrow}>{roleLabel} home</span>
          <h1 className={styles.title}>What do you need to do?</h1>
        </div>
        <div className={styles.context} aria-label={`${contextLabel}: ${contextValue}`}>
          <span className={styles.contextLabel}>{contextLabel}</span>
          <strong>{contextValue}</strong>
        </div>
      </header>

      <div className={styles.primary}>
        <div className={styles.primaryIcon}>
          <TiqFeatureIcon name={primaryAction.icon} size="md" variant="surface" />
        </div>
        <div className={styles.primaryCopy}>
          <span className={styles.primaryLabel}>{primaryAction.label}</span>
          <strong>{primaryAction.title}</strong>
          <span>{primaryAction.detail}</span>
        </div>
        <TrackedProductLink href={primaryAction.href} className={styles.primaryAction} event={primaryAction.event}>
          {primaryAction.cta}
        </TrackedProductLink>
      </div>

      <nav className={styles.quickGrid} aria-label={`${roleLabel} quick actions`}>
        {quickActions.slice(0, 4).map((action) => (
          <TrackedProductLink key={action.title} href={action.href} className={styles.quickAction} event={action.event}>
            <TiqFeatureIcon name={action.icon} size="sm" variant="ghost" />
            <span className={styles.quickCopy}>
              <strong>{action.title}</strong>
              <span>{action.detail}</span>
            </span>
          </TrackedProductLink>
        ))}
      </nav>

      <details className={styles.help} open={showSteps}>
        <summary className={styles.helpSummary}>
          <span>{helpTitle}</span>
          <span>{steps.length} steps</span>
        </summary>
        <div className={styles.steps}>
          {steps.map((step, index) => (
            <div key={step.title} className={styles.step}>
              <span className={styles.stepNumber}>{index + 1}</span>
              <span className={styles.stepCopy}>
                <strong>{step.title}</strong>
                <span>{step.detail}</span>
              </span>
            </div>
          ))}
        </div>
      </details>
    </section>
  )
}
