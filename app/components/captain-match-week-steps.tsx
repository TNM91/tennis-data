import Link from 'next/link'
import type {CSSProperties} from 'react'
import {buildCaptainScopedHref} from '@/lib/captain-memory'
import styles from './captain-match-week-rail.module.css'
export type MatchWeekStep = 'availability' | 'lineup' | 'messaging'
export type MatchWeekProgress = Partial<Record<MatchWeekStep,{complete:boolean;label:string}>>
const steps: Array<{ id: MatchWeekStep; label: string; path: string }> = [
  { id: 'lineup', label: 'Build lineup', path: '/captain/lineup-builder' },
  { id: 'availability', label: 'Check replies', path: '/captain/availability' },
  { id: 'messaging', label: 'Send team update', path: '/captain/messaging' },
]

export default function CaptainMatchWeekSteps({current,progress,scope,isMobile=false,native=false,onResumeLineup,onConfirmPlayers,onSendTeamUpdate,confirmPlayersDisabled=false,sendTeamUpdateDisabled=false,messagingComplete=false}:{current:MatchWeekStep;progress?:MatchWeekProgress;scope:Parameters<typeof buildCaptainScopedHref>[1];isMobile?:boolean;native?:boolean;onResumeLineup?:()=>void;onConfirmPlayers?:()=>void;onSendTeamUpdate?:()=>void;confirmPlayersDisabled?:boolean;sendTeamUpdateDisabled?:boolean;messagingComplete?:boolean}){
 return (
      <nav style={isMobile ? mobileStepList : stepList} aria-label="Match week steps">
        {steps.map((step, index) => {
          const isCurrent = step.id === current
          const isComplete = progress?.[step.id]?.complete === true || (step.id === 'messaging' && messagingComplete)
          const href = buildCaptainScopedHref(step.path, scope)
          const onClick = step.id === 'lineup'
            ? onResumeLineup
            : step.id === 'availability'
              ? onConfirmPlayers
              : step.id === 'messaging'
                ? onSendTeamUpdate
                : undefined
          const disabled = step.id === 'availability'
            ? confirmPlayersDisabled
            : step.id === 'messaging'
              ? sendTeamUpdateDisabled
              : false
          const content = (
            <>
              <span className={styles.number} aria-hidden="true" style={stepNumber}>{isComplete ? 'Done' : index + 1}</span>
              <span>{isMobile ? mobileStepLabel(step.id) : step.label}{progress?.[step.id] ? <small style={{ display: 'block', fontSize: 10, marginTop: 3 }}>{progress[step.id]?.label}</small> : null}</span>
            </>
          )

          if (onClick) {
            return (
              <button
                key={step.id}
                data-match-week-step={native ? step.id : undefined}
                type="button"
                className={styles.step}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={native ? step.label : step.id === 'lineup'
                  ? 'Open the current lineup courts'
                  : step.id === 'availability'
                    ? 'Save lineup and check selected player replies'
                    : 'Post the final lineup to Team Chat'}
                disabled={disabled}
                onClick={onClick}
                style={{
                  ...stepLink,
                  ...stepButton,
                  ...(isMobile ? mobileStepLink : {}),
                  ...(isCurrent ? activeStep : {}),
                  ...(isComplete ? completeStep : {}),
                  ...(disabled ? disabledStep : {}),
                }}
              >
                {content}
              </button>
            )
          }

          return (
            <Link
              key={step.id}
              href={href}
              className={styles.step}
              aria-current={isCurrent ? 'step' : undefined}
              style={{
                ...stepLink,
                ...(isMobile ? mobileStepLink : {}),
                ...(isCurrent ? activeStep : {}),
                ...(isComplete ? completeStep : {}),
              }}
            >
              {content}
            </Link>
          )
        })}
      </nav>
 )
}
function mobileStepLabel(step: MatchWeekStep) {
  if (step === 'availability') return 'Confirm'
  if (step === 'lineup') return 'Lineup'
  return 'Send'
}

const stepList: CSSProperties = { display: 'flex', gap: 7, flexWrap: 'wrap' }
const stepLink: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 44, padding: '7px 11px', borderRadius: 12, border: '1px solid var(--shell-panel-border)', color: 'var(--shell-copy-muted)', background: 'var(--shell-chip-bg)', fontSize: 12, fontWeight: 800, textDecoration: 'none' }
const stepButton: CSSProperties = { fontFamily: 'inherit', cursor: 'pointer' }
const mobileStepList: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 7, minWidth: 0 }
const mobileStepLink: CSSProperties = { flexDirection: 'column', justifyContent: 'center', minWidth: 0, minHeight: 56, gap: 5, padding: '8px 5px', borderRadius: 14, fontSize: 10, lineHeight: 1.15, textAlign: 'center' }
const activeStep: CSSProperties = { color: 'var(--foreground-strong)', border: '1px solid color-mix(in srgb, var(--brand-green) 42%, var(--shell-panel-border) 58%)', background: 'color-mix(in srgb, var(--brand-green) 14%, var(--shell-chip-bg) 86%)' }
const completeStep: CSSProperties = { color: 'var(--brand-lime)' }
const disabledStep: CSSProperties = { cursor: 'not-allowed', opacity: 0.48 }
const stepNumber: CSSProperties = { display: 'grid', placeItems: 'center', minWidth: 20, height: 20, padding: '0 4px', borderRadius: 999, border: '1px solid currentColor', fontSize: 10 }
