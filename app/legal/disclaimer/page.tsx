import type { Metadata } from 'next'
import JsonLd from '@/app/components/json-ld'
import SiteShell from '@/app/components/site-shell'
import LegalPage from '@/app/components/legal-page'
import { buildRouteMetadata } from '@/lib/route-metadata'
import { buildPublicSectionBreadcrumbJsonLd } from '@/lib/structured-data'

export const metadata: Metadata = buildRouteMetadata({
  title: 'Disclaimer',
  description: 'TenAceIQ platform disclaimer.',
  path: '/legal/disclaimer',
})

export default function DisclaimerPage() {
  return (
    <SiteShell active="/legal/disclaimer">
      <JsonLd id="disclaimer-breadcrumb-jsonld" data={buildPublicSectionBreadcrumbJsonLd('Disclaimer', '/legal/disclaimer')} />
      <LegalPage title="Platform Disclaimer" effectiveDate="April 10, 2026">
        <p>
          TenAceIQ provides analytical, informational, and tennis tools designed to help
          users interpret tennis data and prepare for matches. The platform does not provide
          guaranteed outcomes or professional sports advice.
        </p>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>1. Informational use only</h2>
          <p>
            Ratings, matchup outputs, lineup recommendations, projections, scenario analysis,
            and messaging suggestions are provided for informational and decision-support purposes only.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>2. No guarantee</h2>
          <p>
            We do not guarantee the accuracy, completeness, reliability, or usefulness of any
            output, recommendation, ranking, projection, or result shown by the platform.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>3. No coaching or professional advice</h2>
          <p>
            TenAceIQ is not a substitute for professional coaching, medical guidance,
            officiating decisions, governing-body rules interpretation, or other expert advice.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>4. Captain and user responsibility</h2>
          <p>
            Captains, players, and users are fully responsible for lineups, pairings,
            communications, substitutions, participation decisions, and all match-day actions.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>5. Not for gambling</h2>
          <p>
            TenAceIQ is not designed for wagering, gambling, odds-making, or betting-related
            decisions. Do not use platform outputs for those purposes.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>6. Inherent uncertainty</h2>
          <p>
            Sports outcomes are inherently uncertain. Real-world conditions, injuries,
            availability changes, incomplete information, and countless other factors may
            affect results in ways the platform cannot predict.
          </p>
        </div>
      </LegalPage>
    </SiteShell>
  )
}
