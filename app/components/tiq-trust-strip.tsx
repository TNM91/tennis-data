import type { CSSProperties } from 'react'
import TrackedProductLink, { type ProductLinkEvent } from '@/app/components/tracked-product-link'
import type { ProductUsageEventSurface } from '@/lib/product-usage-events'

type TrustTone = 'info' | 'good' | 'warn' | 'danger'

export type TiqTrustSignal = {
  label: 'Source' | 'Freshness' | 'Confidence' | 'Status'
  value: string
  tone?: TrustTone
}

export default function TiqTrustStrip({
  label = 'Data trust signals',
  signals,
  actionHref,
  actionLabel = 'Report issue',
  actionEvent,
  actionSurface = 'data_assist',
  reviewContext,
}: {
  label?: string
  signals: TiqTrustSignal[]
  actionHref?: string
  actionLabel?: string
  actionEvent?: ProductLinkEvent
  actionSurface?: ProductUsageEventSurface
  reviewContext?: string
}) {
  const event = actionEvent ?? (actionHref
    ? {
        eventName: 'data_issue_reported' as const,
        surface: actionSurface,
        metadata: {
          action: 'report_issue',
          trustLabel: label,
          href: actionHref,
        },
      }
    : undefined)
  const encodedReviewContext = reviewContext ? encodeURIComponent(reviewContext) : ''
  const reviewActions = reviewContext
    ? [
        {
          label: 'Upload source',
          href: `/data-assist?intent=upload-source&context=${encodedReviewContext}`,
          event: {
            eventName: 'data_assist_opened' as const,
            surface: actionSurface,
            metadata: { action: 'upload_source', trustLabel: label, context: reviewContext },
          },
        },
        {
          label: 'Report issue',
          href: `/data-assist?intent=report-issue&context=${encodedReviewContext}`,
          event: {
            eventName: 'data_issue_reported' as const,
            surface: actionSurface,
            metadata: { action: 'report_issue', trustLabel: label, context: reviewContext },
          },
        },
        {
          label: 'Request review',
          href: `/data-assist?intent=request-review&context=${encodedReviewContext}`,
          event: {
            eventName: 'data_assist_opened' as const,
            surface: actionSurface,
            metadata: { action: 'request_review', trustLabel: label, context: reviewContext },
          },
        },
      ]
    : []

  return (
    <div style={trustRowStyle} aria-label={label}>
      {signals.map((signal) => (
        <span key={`${signal.label}-${signal.value}`} style={trustChipStyle(signal.tone)}>
          <strong>{signal.label}</strong>
          {signal.value}
        </span>
      ))}
      {reviewActions.map((action) => (
        <TrackedProductLink
          key={action.label}
          href={action.href}
          style={actionChipStyle}
          ariaLabel={`${action.label}: ${label}`}
          event={action.event}
        >
          {action.label}
        </TrackedProductLink>
      ))}
      {actionHref && !reviewContext ? (
        <TrackedProductLink
          href={actionHref}
          style={actionChipStyle}
          ariaLabel={`${actionLabel}: ${label}`}
          event={event}
        >
          {actionLabel}
        </TrackedProductLink>
      ) : null}
    </div>
  )
}

const trustRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 7,
  minWidth: 0,
  maxWidth: '100%',
}

const trustChipStyle = (tone: TrustTone = 'info'): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  minHeight: 28,
  maxWidth: '100%',
  padding: '0 9px',
  borderRadius: 999,
  border:
    tone === 'good'
      ? '1px solid color-mix(in srgb, var(--brand-green) 28%, var(--shell-panel-border) 72%)'
      : tone === 'danger'
        ? '1px solid rgba(248,113,113,0.34)'
        : tone === 'warn'
          ? '1px solid rgba(251,191,36,0.34)'
          : '1px solid rgba(116,190,255,0.16)',
  background: tone === 'good'
    ? 'color-mix(in srgb, var(--brand-green) 9%, var(--shell-chip-bg) 91%)'
    : 'rgba(7,17,33,0.72)',
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  lineHeight: 1.2,
  fontWeight: 820,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
})

const actionChipStyle: CSSProperties = {
  ...trustChipStyle('info'),
  color: 'var(--brand-blue-2)',
  textDecoration: 'none',
  fontWeight: 950,
}
