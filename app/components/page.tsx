'use client'

import SiteShell from '@/app/components/site-shell'
import HomePageHeroResponsive from '@/app/components/homepage-hero-responsive'

export default function HomePage() {
  return (
    <SiteShell active="/">
      <HomePageHeroResponsive />

      <section
        style={{
          width: '100%',
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '8px 24px 32px',
        }}
      >
        {/* Keep your existing homepage sections here if you want more content below the rebuilt hero */}
      </section>
    </SiteShell>
  )
}
