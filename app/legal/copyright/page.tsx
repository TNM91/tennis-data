import type { Metadata } from 'next'
import JsonLd from '@/app/components/json-ld'
import SiteShell from '@/app/components/site-shell'
import LegalPage from '@/app/components/legal-page'
import { buildRouteMetadata } from '@/lib/route-metadata'
import { buildPublicSectionBreadcrumbJsonLd } from '@/lib/structured-data'

export const metadata: Metadata = buildRouteMetadata({
  title: 'Copyright Policy',
  description: 'TenAceIQ copyright and takedown policy.',
  path: '/legal/copyright',
})

export default function CopyrightPage() {
  return (
    <SiteShell active="/legal/copyright">
      <JsonLd id="copyright-breadcrumb-jsonld" data={buildPublicSectionBreadcrumbJsonLd('Copyright Policy', '/legal/copyright')} />
      <LegalPage title="Copyright Policy" effectiveDate="April 10, 2026">
        <p>
          TenAceIQ respects intellectual property rights and expects users of the platform
          to do the same.
        </p>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>1. Respect for rights</h2>
          <p>
            If you believe material appearing on TenAceIQ infringes your copyright or other
            intellectual property rights, you may send us a notice requesting review.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>2. What to include in a notice</h2>
          <p>Please include enough detail for us to evaluate the request, such as:</p>
          <p>A description of the work claimed to be infringed.</p>
          <p>The specific content or location on TenAceIQ at issue.</p>
          <p>Your contact information.</p>
          <p>A statement that you have a good-faith belief the use is unauthorized.</p>
          <p>A statement that the information in your notice is accurate.</p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>3. Response</h2>
          <p>
            We may investigate, remove, limit access to, or request more information regarding
            challenged content as appropriate.
          </p>
        </div>
      </LegalPage>
    </SiteShell>
  )
}
