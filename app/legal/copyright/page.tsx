import type { Metadata } from 'next'
import Link from 'next/link'
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
          to do the same. This policy explains how we handle ownership, user-submitted
          materials, copyright complaints, counter-notices, and repeat infringement.
        </p>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>1. TenAceIQ materials</h2>
          <p>
            TenAceIQ owns or licenses the platform software, branding, designs, page copy,
            workflows, proprietary analytics, visual presentation, and other original materials
            made available through the service. Except where the platform expressly allows a
            limited personal or team use, you may not copy, scrape, reproduce, modify, publish,
            sell, sublicense, reverse engineer, or exploit TenAceIQ materials without permission.
          </p>
          <p>
            Tennis records, public facts, third-party marks, league names, team names, player
            names, and source materials remain subject to the rights and rules of their respective
            owners, leagues, providers, and governing bodies.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>2. User and league content</h2>
          <p>
            If you upload, submit, import, message, or otherwise provide content to TenAceIQ,
            you represent that you have the rights and permissions needed to do so. You keep
            ownership of your content, but you grant TenAceIQ a limited license to host, store,
            process, display, format, analyze, transmit, and use that content as needed to operate,
            secure, improve, and support the platform and the features you choose to use.
          </p>
          <p>
            You may not upload or import material that infringes another party&apos;s rights, violates
            league rules or data-source terms, exposes private information without authorization,
            or misrepresents match, roster, result, or player information.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>3. Copyright notices</h2>
          <p>
            If you believe material on TenAceIQ infringes your copyright, send a review request
            with enough detail for us to find and evaluate the material. Your notice should include:
          </p>
          <p>The copyrighted work you claim has been infringed, or a representative list of works.</p>
          <p>The exact TenAceIQ URL, page, record, message, upload, or location where the material appears.</p>
          <p>Your name, organization if applicable, mailing address, phone number, and email address.</p>
          <p>A statement that you have a good-faith belief the disputed use is not authorized by the copyright owner, its agent, or the law.</p>
          <p>A statement that the information in your notice is accurate and, under penalty of perjury, that you are the copyright owner or authorized to act for the owner.</p>
          <p>Your physical or electronic signature.</p>
          <p>
            You can start a request through the <Link href="/contact">TenAceIQ contact page</Link>. If
            TenAceIQ designates a DMCA agent, we will post the agent&apos;s contact information in a
            public location and keep the Copyright Office directory current as required.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>4. Review and response</h2>
          <p>
            We may investigate, remove, limit access to, or request more information regarding
            challenged content as appropriate. We may also notify the user or account associated
            with the material and preserve records needed to evaluate the request, protect users,
            enforce our terms, or comply with law.
          </p>
          <p>
            Notices that are incomplete, unclear, abusive, automated at unreasonable scale, or not
            tied to identifiable TenAceIQ material may be delayed or rejected until enough
            information is provided.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>5. Counter-notices</h2>
          <p>
            If your content was removed or restricted after a copyright notice and you believe the
            action was a mistake or misidentification, you may send a counter-notice. Include the
            material that was removed, where it appeared, your contact information, a statement
            under penalty of perjury that you have a good-faith belief the material was removed by
            mistake or misidentification, your consent to the jurisdiction required by applicable
            copyright law, and your physical or electronic signature.
          </p>
          <p>
            We may restore content when permitted by law and platform policy unless the original
            claimant tells us that they have filed an action seeking a court order.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>6. Repeat infringement and misuse</h2>
          <p>
            TenAceIQ may suspend or terminate accounts, imports, uploads, league workspaces, or
            other access for repeat infringement, abusive notices, fraudulent claims, attempts to
            evade removals, or other intellectual-property misuse.
          </p>
          <p>
            A false notice or counter-notice can create legal liability. Do not submit a copyright
            request unless you have a good-faith basis for the claim.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>7. Reservation of rights</h2>
          <p>
            Nothing in this policy waives TenAceIQ&apos;s rights, remedies, defenses, licenses,
            permissions, or legal positions. We may update this policy as the platform, legal
            requirements, data partnerships, or support workflows change.
          </p>
        </div>
      </LegalPage>
    </SiteShell>
  )
}
