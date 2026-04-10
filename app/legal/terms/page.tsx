import type { Metadata } from 'next'
import SiteShell from '@/app/components/site-shell'
import LegalPage from '@/app/components/legal-page'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'TenAceIQ terms of service.',
}

export default function TermsPage() {
  return (
    <SiteShell active="/legal/terms">
      <LegalPage title="Terms of Service" effectiveDate="April 10, 2026">
        <p>
          These Terms of Service govern your access to and use of TenAceIQ. By using the
          platform, you agree to these Terms.
        </p>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>1. Platform overview</h2>
          <p>
            TenAceIQ provides tennis-related analytics, ratings, matchup insight, lineup
            planning, captain tools, communication workflows, and related platform features.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>2. Eligibility and accounts</h2>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials
            and for activity that occurs under your account.
          </p>
          <p>
            You agree to provide accurate information and to keep your account information current.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>3. Acceptable use</h2>
          <p>You agree not to misuse the platform. This includes, without limitation:</p>
          <p>Using TenAceIQ for unlawful, harmful, abusive, or deceptive purposes.</p>
          <p>Interfering with the operation, security, or integrity of the platform.</p>
          <p>Copying, reselling, reverse engineering, or exploiting the service beyond permitted use.</p>
          <p>Using messaging or collaboration features in ways that violate law or others&apos; rights.</p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>4. Data and accuracy</h2>
          <p>
            TenAceIQ may rely on user input, public information, and third-party data sources.
            Data may be incomplete, delayed, unavailable, or inaccurate.
          </p>
          <p>
            You understand that the platform is informational and analytical in nature and that
            outputs may change as data changes.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>5. No guarantee of outcomes</h2>
          <p>
            TenAceIQ does not guarantee match outcomes, player performance, team results,
            lineup success, rating accuracy, or predictive accuracy.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>6. User responsibility</h2>
          <p>
            You remain solely responsible for your decisions, communications, lineups,
            player selection choices, scheduling choices, and any reliance on platform outputs.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>7. Intellectual property</h2>
          <p>
            TenAceIQ, including its branding, software, design, text, visual elements,
            workflows, and proprietary analytics, is owned by TenAceIQ or its licensors
            and is protected by applicable law.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>8. Suspension and termination</h2>
          <p>
            We may suspend or terminate access to the platform at any time if we believe
            these Terms have been violated, if misuse is detected, or if continued access
            could expose TenAceIQ or others to harm or risk.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>9. Disclaimers</h2>
          <p>
            The platform is provided on an &quot;as is&quot; and &quot;as available&quot; basis without warranties
            of any kind, to the fullest extent permitted by law.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>10. Limitation of liability</h2>
          <p>
            To the fullest extent permitted by law, TenAceIQ will not be liable for indirect,
            incidental, consequential, special, exemplary, or punitive damages, or for lost
            profits, lost data, or losses arising from reliance on platform outputs.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>11. Changes</h2>
          <p>
            We may update these Terms from time to time. Continued use of TenAceIQ after
            updated Terms are posted constitutes acceptance of the revised Terms.
          </p>
        </div>
      </LegalPage>
    </SiteShell>
  )
}