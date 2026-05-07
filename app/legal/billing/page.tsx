import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import SiteShell from '@/app/components/site-shell'
import LegalPage from '@/app/components/legal-page'
import {
  BILLING_POLICY_NOTES,
  BILLING_SUPPORT_PATH,
  LEAGUE_SEASON_POLICY,
  MONTHLY_SUBSCRIPTION_POLICY,
} from '@/lib/billing-policy'

export const metadata: Metadata = {
  title: 'Billing and Refund Policy',
  description: 'TenAceIQ billing, cancellation, refund, and league season policy.',
}

export default function BillingPolicyPage() {
  return (
    <SiteShell active="/legal/billing">
      <LegalPage title="Billing and Refund Policy" effectiveDate="May 6, 2026">
        <p>
          This policy explains how paid TenAceIQ plans, cancellations, refunds, and league
          season fees work. It is part of the TenAceIQ Terms of Service.
        </p>

        <PolicySection title={MONTHLY_SUBSCRIPTION_POLICY.title}>
          <p>{MONTHLY_SUBSCRIPTION_POLICY.summary}</p>
          <PolicyList items={MONTHLY_SUBSCRIPTION_POLICY.bullets} />
        </PolicySection>

        <PolicySection title={LEAGUE_SEASON_POLICY.title}>
          <p>{LEAGUE_SEASON_POLICY.summary}</p>
          <PolicyList items={LEAGUE_SEASON_POLICY.bullets} />
        </PolicySection>

        <PolicySection title="How to request billing support">
          <p>
            Open a <Link href={BILLING_SUPPORT_PATH}>TenAceIQ support thread</Link> with the
            account email, plan, charge date, and a short description of the issue. We review refund
            and credit requests case by case.
          </p>
        </PolicySection>

        <PolicySection title="Additional notes">
          <PolicyList items={BILLING_POLICY_NOTES} />
          <p>
            For broader platform rules, review the <Link href="/legal/terms">Terms of Service</Link>.
          </p>
        </PolicySection>
      </LegalPage>
    </SiteShell>
  )
}

function PolicySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="section-title" style={{ fontSize: '1.2rem' }}>{title}</h2>
      {children}
    </div>
  )
}

function PolicyList({ items }: { items: readonly string[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 22 }}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}
