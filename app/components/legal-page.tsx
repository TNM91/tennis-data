import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'

const LEGAL_NAV: Array<{
  label: string
  href: string
  text: string
  icon: TiqFeatureIconName
}> = [
  {
    label: 'Terms',
    href: '/legal/terms',
    text: 'Platform rules and user responsibilities.',
    icon: 'accountSecurity',
  },
  {
    label: 'Privacy',
    href: '/legal/privacy',
    text: 'How account and tennis data is handled.',
    icon: 'playerRatings',
  },
  {
    label: 'Billing',
    href: '/legal/billing',
    text: 'Plans, cancellations, refunds, and seasons.',
    icon: 'reports',
  },
  {
    label: 'Support',
    href: '/messages?compose=support&category=account',
    text: 'Ask a question inside TenAceIQ.',
    icon: 'messagingCenter',
  },
]

export default function LegalPage({
  title,
  effectiveDate,
  children,
}: {
  title: string
  effectiveDate?: string
  children: ReactNode
}) {
  return (
    <div className="page-shell-tight">
      <section className="surface-card-strong panel-pad">
        <div className="section-kicker">Legal</div>
        <h1 className="page-title">{title}</h1>
        {effectiveDate ? (
          <p
            style={{
              marginTop: 12,
              marginBottom: 0,
              color: 'rgba(197,213,234,0.78)',
              fontSize: '0.95rem',
              fontWeight: 700,
            }}
          >
            Effective date: {effectiveDate}
          </p>
        ) : null}

        <div style={legalNavStyle} aria-label="Legal quick links">
          {LEGAL_NAV.map((item) => (
            <Link key={item.href} href={item.href} style={legalNavCardStyle}>
              <TiqFeatureIcon name={item.icon} size="sm" variant="ghost" />
              <span style={legalNavCopyStyle}>
                <strong>{item.label}</strong>
                <small>{item.text}</small>
              </span>
            </Link>
          ))}
        </div>

        <div
          style={{
            marginTop: 22,
            display: 'grid',
            gap: 18,
            color: 'rgba(229,238,251,0.86)',
            fontSize: '15px',
            lineHeight: 1.75,
          }}
        >
          {children}
        </div>
      </section>
    </div>
  )
}

const legalNavStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
  gap: 10,
  marginTop: 22,
}

const legalNavCardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '34px minmax(0, 1fr)',
  gap: 10,
  alignItems: 'center',
  minHeight: 72,
  padding: 11,
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--foreground)',
  textDecoration: 'none',
}

const legalNavCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  minWidth: 0,
  color: 'var(--foreground-strong)',
  fontSize: 13,
  lineHeight: 1.2,
  overflowWrap: 'anywhere',
}
