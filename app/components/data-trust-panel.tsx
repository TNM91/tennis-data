'use client'

import Link from 'next/link'
import type { CSSProperties } from 'react'
import TrackedProductLink from '@/app/components/tracked-product-link'

type TrustSignal = {
  label: 'Source' | 'Freshness' | 'Confidence' | 'Status'
  value: string
}

const defaultSignals: TrustSignal[] = [
  { label: 'Source', value: 'Reviewed uploads and public tennis data' },
  { label: 'Freshness', value: 'Shown when available' },
  { label: 'Confidence', value: 'Improves with verified match context' },
  { label: 'Status', value: 'Report issues through Data Assist' },
]

export default function DataTrustPanel({
  title = 'Data trust',
  body = 'TenAceIQ reads can include public data, TIQ league context, reviewed Data Assist uploads, and admin-reviewed corrections. Some records may still be incomplete or pending review.',
  signals = defaultSignals,
}: {
  title?: string
  body?: string
  signals?: TrustSignal[]
}) {
  const contextQuery = encodeURIComponent(title)
  const uploadHref = `/data-assist?intent=upload-source&context=${contextQuery}`
  const reportHref = `/data-assist?intent=report-issue&context=${contextQuery}`
  const reviewHref = `/data-assist?intent=request-review&context=${contextQuery}`

  return (
    <aside style={panelStyle} aria-label="Data trust and review actions">
      <div style={copyStyle}>
        <strong style={titleStyle}>{title}</strong>
        <p style={bodyStyle}>{body}</p>
      </div>
      <div style={chipRowStyle}>
        {signals.map((signal) => (
          <span key={`${signal.label}-${signal.value}`} style={chipStyle}>
            <span style={chipLabelStyle}>{signal.label}</span>
            {signal.value}
          </span>
        ))}
      </div>
      <div style={actionRowStyle}>
        <TrackedProductLink
          href={uploadHref}
          style={actionStyle}
          ariaLabel={`Upload source for ${title}`}
          event={{ eventName: 'data_assist_opened', surface: 'data_assist', metadata: { action: 'upload_source', surface: title } }}
        >
          Upload source
        </TrackedProductLink>
        <TrackedProductLink
          href={reportHref}
          style={actionStyle}
          ariaLabel={`Report issue for ${title}`}
          event={{ eventName: 'data_issue_reported', surface: 'data_assist', metadata: { action: 'report_issue', surface: title } }}
        >
          Report issue
        </TrackedProductLink>
        <TrackedProductLink
          href={reviewHref}
          style={actionStyle}
          ariaLabel={`Request review for ${title}`}
          event={{ eventName: 'data_assist_opened', surface: 'data_assist', metadata: { action: 'request_review', surface: title } }}
        >
          Request review
        </TrackedProductLink>
        <Link href="/legal/data-policy" aria-label={`Read data policy for ${title}`} style={mutedActionStyle}>Data policy</Link>
      </div>
    </aside>
  )
}

const panelStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  marginTop: 14,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(7,17,33,0.64)',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const copyStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
}

const titleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 13,
  fontWeight: 950,
}

const bodyStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.6,
  fontWeight: 700,
}

const chipRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  minWidth: 0,
}

const chipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  minHeight: 30,
  padding: '0 9px',
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.16)',
  background: 'rgba(155,225,29,0.07)',
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 850,
}

const chipLabelStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 950,
}

const actionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const actionStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 12,
  fontWeight: 950,
  textDecoration: 'none',
}

const mutedActionStyle: CSSProperties = {
  ...actionStyle,
  color: 'var(--brand-blue-2)',
}
