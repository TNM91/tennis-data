import type { Metadata } from 'next'
import SiteShell from '@/app/components/site-shell'
import LegalPage from '@/app/components/legal-page'

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description: 'TenAceIQ cookie policy.',
}

export default function CookiesPage() {
  return (
    <SiteShell active="/legal/cookies">
      <LegalPage title="Cookie Policy" effectiveDate="April 10, 2026">
        <p>
          This Cookie Policy explains how TenAceIQ uses cookies and similar technologies
          to support authentication, performance, analytics, and user experience.
        </p>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>1. What cookies are</h2>
          <p>
            Cookies are small text files stored on your device that help websites remember
            session information, preferences, and usage details.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>2. How we use them</h2>
          <p>We may use cookies and similar technologies to:</p>
          <p>Keep you signed in and maintain secure sessions.</p>
          <p>Remember preferences and improve usability.</p>
          <p>Measure traffic, engagement, and performance.</p>
          <p>Support reliability, diagnostics, and abuse prevention.</p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>3. Your choices</h2>
          <p>
            Most browsers allow you to control cookies through browser settings. Disabling
            cookies may affect functionality and may prevent some parts of TenAceIQ from
            working as intended.
          </p>
        </div>
      </LegalPage>
    </SiteShell>
  )
}