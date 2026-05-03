import type { Metadata } from 'next'
import SiteShell from '@/app/components/site-shell'
import LegalPage from '@/app/components/legal-page'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'TenAceIQ privacy policy.',
}

export default function PrivacyPage() {
  return (
    <SiteShell active="/legal/privacy">
      <LegalPage title="Privacy Policy" effectiveDate="April 10, 2026">
        <p>
          TenAceIQ (&quot;TenAceIQ,&quot; &quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) respects your privacy and is
          committed to protecting your information. This Privacy Policy explains what
          information we collect, how we use it, and what choices you have.
        </p>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>1. Information we collect</h2>
          <p>
            We may collect account information such as your name, email address, login
            credentials, and other information you provide when creating an account.
          </p>
          <p>
            We may also collect usage information such as pages visited, features used,
            browser/device information, approximate location derived from IP address,
            and platform interaction data.
          </p>
          <p>
            Tennis-related information may include player names, match records, team
            information, lineup details, availability inputs, messaging workflows, league
            context, and similar platform data.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>2. How we use information</h2>
          <p>We use information to operate, maintain, and improve TenAceIQ, including to:</p>
          <p>Provide ratings, matchup analysis, lineup tools, messaging workflows, and member features.</p>
          <p>Personalize user experience and improve platform performance.</p>
          <p>Maintain platform security, prevent abuse, and investigate suspicious activity.</p>
          <p>Communicate with you about your account, updates, support, and service-related notices.</p>
          <p>
            Support monetization and advertising operations where enabled, including ad delivery,
            frequency management, fraud prevention, performance measurement, and related reporting.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>3. Data sources</h2>
          <p>
            Information on TenAceIQ may come from user-submitted data, publicly available
            data, and third-party data sources where permitted.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>4. Sharing of information</h2>
          <p>We do not sell your personal information.</p>
          <p>
            We may share information with infrastructure and service providers that help us
            operate TenAceIQ, such as hosting, authentication, analytics, database, and
            communications providers.
          </p>
          <p>
            We may also disclose information if required by law, to protect our rights, or to
            respond to valid legal requests.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>5. Cookies and tracking</h2>
          <p>
            We may use cookies and similar technologies to maintain sessions, remember
            preferences, analyze usage, and improve reliability and performance.
          </p>
          <p>
            If advertising is enabled on parts of the site, third-party advertising providers may
            also use cookies, similar technologies, or request metadata to support ad serving and
            measurement.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>6. Data retention</h2>
          <p>
            We retain data for as long as reasonably necessary to provide the service,
            support legitimate business purposes, comply with legal obligations, resolve
            disputes, and enforce agreements.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>7. Your rights</h2>
          <p>
            Depending on where you live, you may have rights to access, correct, delete,
            or restrict certain personal information. To make a request, contact us through
            the contact information provided on the site.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>8. Security</h2>
          <p>
            We use reasonable administrative, technical, and organizational safeguards to
            protect information. No method of transmission or storage is completely secure,
            and we cannot guarantee absolute security.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>9. Children&apos;s privacy</h2>
          <p>
            TenAceIQ is not directed to children under 13, and we do not knowingly collect
            personal information from children under 13 without appropriate authorization.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>10. Changes to this policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Updated versions become
            effective when posted on this page.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>11. Contact</h2>
          <p>
            For privacy or data handling questions, contact <a href="mailto:support@tenaceiq.com">support@tenaceiq.com</a>.
          </p>
        </div>
      </LegalPage>
    </SiteShell>
  )
}
