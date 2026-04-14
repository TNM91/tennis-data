import type { Metadata } from 'next'
import SiteShell from '@/app/components/site-shell'
import InfoPage from '@/app/components/info-page'

export const metadata: Metadata = {
  title: 'Advertising Disclosure',
  description:
    'Learn how TenAceIQ approaches advertising placement, sponsored inventory, and user trust on public pages.',
}

export default function AdvertisingDisclosurePage() {
  return (
    <SiteShell active="/advertising-disclosure">
      <InfoPage
        kicker="Advertising"
        title="How advertising is handled on TenAceIQ."
        intro="TenAceIQ is built to keep product usefulness ahead of monetization. Advertising, where enabled, is limited to public content-rich pages and is intended to stay separate from navigation, operational tools, and private user workflows."
      >
        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>Where ads may appear</h2>
          <p>
            Ads may appear on public discovery-oriented pages such as the homepage, explore,
            rankings, players, teams, leagues, and matchup views when those pages contain enough
            standalone publisher content to support responsible monetization.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>Where ads do not belong</h2>
          <p>
            Ads are not intended for admin tools, captain workflow screens, account/auth pages,
            personalized private areas, API routes, or thin utility surfaces where ads could confuse
            the user or interfere with the purpose of the screen.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>How placements are treated</h2>
          <p>
            Sponsored inventory should be clearly labeled, visually separate from navigation and
            action controls, and subordinate to the actual page content. The site is not designed to
            use ads as deceptive buttons, fake prompts, or replacements for content.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>Questions about ads</h2>
          <p>
            For questions about advertising on the site, contact <a href="mailto:hello@tenaceiq.com">hello@tenaceiq.com</a>.
          </p>
        </div>
      </InfoPage>
    </SiteShell>
  )
}
