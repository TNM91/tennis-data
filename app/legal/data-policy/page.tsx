import type { Metadata } from 'next'
import Link from 'next/link'
import JsonLd from '@/app/components/json-ld'
import SiteShell from '@/app/components/site-shell'
import LegalPage from '@/app/components/legal-page'
import { buildSupportMessageHref } from '@/lib/message-links'
import { buildRouteMetadata } from '@/lib/route-metadata'
import { buildPublicSectionBreadcrumbJsonLd } from '@/lib/structured-data'

export const metadata: Metadata = buildRouteMetadata({
  title: 'Data Policy',
  description: 'TenAceIQ data source and fair use policy.',
  path: '/legal/data-policy',
})

const dataSupportHref = buildSupportMessageHref({
  category: 'data',
  subject: 'Data correction or takedown request',
  body: [
    'I want TenAceIQ to review a data correction, removal, or source question.',
    'Page URL:',
    'Player/team/league:',
    'Requested change:',
  ].join('\n'),
  entityType: 'data-policy',
})

export default function DataPolicyPage() {
  return (
    <SiteShell active="/legal/data-policy">
      <JsonLd id="data-policy-breadcrumb-jsonld" data={buildPublicSectionBreadcrumbJsonLd('Data Policy', '/legal/data-policy')} />
      <LegalPage title="Data Source & Fair Use Policy" effectiveDate="April 10, 2026">
        <p>
          TenAceIQ uses, organizes, and analyzes tennis-related information in order to deliver
          tennis tools, analytics, and decision-support features.
        </p>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>1. Data sources</h2>
          <p>
            Data displayed or processed on TenAceIQ may come from user-submitted information,
            reviewed Data Assist uploads, administrator-reviewed corrections, publicly available
            information, and third-party sources where permitted. TenAceIQ does not promise direct
            access to any third-party API.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>2. Transformative use</h2>
          <p>
            TenAceIQ is designed to add value through aggregation, organization, analytics,
            interpretation, and better tennis decision support. The goal is not to replicate another
            platform, but to create new utility and insight.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>3. No affiliation</h2>
          <p>
            Unless explicitly stated otherwise, TenAceIQ is not affiliated with, endorsed by,
            or sponsored by USTA, TennisLink, UTR, or any governing body, league, or third-party platform.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>4. Accuracy and availability</h2>
          <p>
            Data may be incomplete, delayed, reformatted, or unavailable at any given time.
            We do not guarantee that underlying source data is accurate or current.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>5. No gambling use</h2>
          <p>
            TenAceIQ data, ratings, projections, matchup reads, and recommendations are not
            intended for wagering, gambling, odds-making, or betting-related decisions.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>6. Takedown or correction requests</h2>
          <p>
            If you believe content or data on TenAceIQ should be corrected, reviewed, or removed,
            open a <Link href={dataSupportHref}>TenAceIQ support thread</Link>{' '}
            with enough detail for us to evaluate the request.
          </p>
        </div>
      </LegalPage>
    </SiteShell>
  )
}
