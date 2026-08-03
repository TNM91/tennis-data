'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'
import type { TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import TiqFeatureIcon from '@/components/brand/TiqFeatureIcon'
import {
  getRoleHomeResumeSnapshot,
  parseRoleHomeResumeSnapshot,
  subscribeToRoleHomeResume,
  writeRoleHomeResume,
} from '@/lib/role-home-resume'
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
  resumeKey,
  preferPrimaryAction = false,
  onAction,
}: {
  roleLabel: string
  contextLabel: string
  contextValue: string
  primaryAction: RoleHomeAction
  quickActions: readonly RoleHomeQuickAction[]
  helpTitle: string
  steps: readonly RoleHomeStep[]
  showSteps?: boolean
  resumeKey?: string
  preferPrimaryAction?: boolean
  onAction?: (action: Pick<RoleHomeAction, 'title' | 'detail' | 'href' | 'icon'>) => void
}) {
  const subscribe = useCallback(
    (onChange: () => void) => subscribeToRoleHomeResume(resumeKey || '', onChange),
    [resumeKey],
  )
  const getSnapshot = useCallback(
    () => getRoleHomeResumeSnapshot(resumeKey || ''),
    [resumeKey],
  )
  const resumeSnapshot = useSyncExternalStore(subscribe, getSnapshot, () => '')
  const resumeAction = useMemo<RoleHomeAction | null>(() => {
    const saved = parseRoleHomeResumeSnapshot(resumeSnapshot)
    if (!saved) return null
    return {
      label: 'Continue',
      title: saved.title,
      detail: saved.contextValue ? `${saved.detail} ${saved.contextValue}.` : saved.detail,
      cta: 'Continue',
      href: saved.href,
      icon: primaryAction.icon,
    }
  }, [primaryAction.icon, resumeSnapshot])

  const displayedPrimaryAction = useMemo(
    () => (preferPrimaryAction ? primaryAction : resumeAction || primaryAction),
    [preferPrimaryAction, primaryAction, resumeAction],
  )

  function rememberAction(action: Pick<RoleHomeAction, 'title' | 'detail' | 'href' | 'icon'>) {
    onAction?.(action)
    if (!resumeKey) return
    writeRoleHomeResume(resumeKey, {
      href: action.href,
      title: action.title,
      detail: action.detail,
      icon: action.icon,
      contextValue,
    })
  }

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
          <TiqFeatureIcon name={displayedPrimaryAction.icon} size="md" variant="surface" />
        </div>
        <div className={styles.primaryCopy}>
          <span className={styles.primaryLabel}>{displayedPrimaryAction.label}</span>
          <strong>{displayedPrimaryAction.title}</strong>
          <span>{displayedPrimaryAction.detail}</span>
        </div>
        <TrackedProductLink
          href={displayedPrimaryAction.href}
          className={styles.primaryAction}
          event={displayedPrimaryAction.event}
          onClick={() => rememberAction(displayedPrimaryAction)}
        >
          {displayedPrimaryAction.cta}
        </TrackedProductLink>
      </div>

      <nav className={styles.quickGrid} aria-label={`${roleLabel} quick actions`}>
        {quickActions.slice(0, 4).map((action) => (
          <TrackedProductLink
            key={action.title}
            href={action.href}
            className={styles.quickAction}
            event={action.event}
            onClick={() => rememberAction({ ...action, detail: action.detail })}
          >
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
