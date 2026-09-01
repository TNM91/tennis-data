import type { Metadata } from 'next'
import Link from 'next/link'
import JsonLd from '@/app/components/json-ld'
import SiteShell from '@/app/components/site-shell'
import InfoPage from '@/app/components/info-page'
import ProductTourVideoButton from '@/app/components/product-tour-video'
import ProductTourPlanFinder from '@/app/components/product-tour-plan-finder'
import {
  PRODUCT_TOUR_PLAN_FINDER_OPTIONS,
  getProductTourPlanFinderOption,
} from '@/lib/product-tour-plan-finder'
import { VERIFIED_PRODUCT_TOUR_PROOF } from '@/lib/product-tour-proof'
import { buildRouteMetadata } from '@/lib/route-metadata'
import {
  PRODUCT_TOUR_VIDEOS,
  TIER_TOUR_VIDEO_IDS,
} from '@/lib/product-tour-videos'
import { buildPublicSectionBreadcrumbJsonLd } from '@/lib/structured-data'
import styles from './platform-tour.module.css'

export const metadata: Metadata = buildRouteMetadata({
  title: 'See TenAceIQ in Action',
  description: 'Watch the complete TenAceIQ platform tour or choose a quick video for Free, Player, Coach, Captain, League, Full-Court, or Club.',
  path: '/resources/platform-tour',
})

const fullTour = PRODUCT_TOUR_VIDEOS['platform-tour']

export default function PlatformTourPage() {
  return (
    <SiteShell active="/resources">
      <JsonLd
        id="platform-tour-breadcrumb-jsonld"
        data={buildPublicSectionBreadcrumbJsonLd('Platform Tour', '/resources/platform-tour')}
      />
      <InfoPage
        kicker="Platform tour"
        title="See where TenAceIQ fits your tennis life."
        intro="Start with the complete tour, or jump straight to the role you care about. Every video is short, captioned, and built around what you can do next."
      >
        <section className={styles.featuredTour} aria-labelledby="complete-tour-title">
          <div className={styles.featuredCopy}>
            <span>{fullTour.eyebrow}</span>
            <h2 id="complete-tour-title">{fullTour.title}</h2>
            <p>{fullTour.description}</p>
            <div className={styles.actionRow}>
              <Link className={styles.primaryAction} href="/explore">Start exploring</Link>
              <Link className={styles.secondaryAction} href="/pricing">Compare plans</Link>
            </div>
          </div>
          <ProductTourVideoButton
            videoId="platform-tour"
            variant="poster"
            label="Watch the complete TenAceIQ platform tour"
            source="platform-tour-featured"
          />
        </section>

        <section className={styles.pricingStrip} aria-labelledby="tour-pricing-title">
          <div className={styles.pricingStripHeading}>
            <span>Current plans</span>
            <h2 id="tour-pricing-title">Start free. Add only the tennis tools you need.</h2>
            <p>See today’s plan prices here, then use each quick video to understand what that role helps you do next.</p>
          </div>
          <div className={styles.pricingRail}>
            {PRODUCT_TOUR_PLAN_FINDER_OPTIONS.map((option) => (
              <Link key={option.id} className={styles.priceCard} href={option.comparisonHref}>
                <span>{option.label}</span>
                <strong>{option.priceLabel}</strong>
                <small>{option.priceNote}</small>
              </Link>
            ))}
          </div>
        </section>

        <ProductTourPlanFinder options={PRODUCT_TOUR_PLAN_FINDER_OPTIONS} />

        <section className={styles.tierSection} aria-labelledby="tier-tours-title">
          <div className={styles.sectionHeading}>
            <span>Choose your role</span>
            <h2 id="tier-tours-title">Get the useful part in about 20 seconds.</h2>
            <p>Each quick view shows the role, the tools, and the tennis decision it helps make easier.</p>
          </div>
          <div className={styles.tierGrid}>
            {TIER_TOUR_VIDEO_IDS.map((videoId) => {
              const video = PRODUCT_TOUR_VIDEOS[videoId]
              const planOption = getProductTourPlanFinderOption(videoId)
              return (
                <article key={videoId} className={styles.tierCard}>
                  <ProductTourVideoButton
                    videoId={videoId}
                    variant="poster"
                    label={`Watch ${video.title}`}
                    source="platform-tour-tier-grid"
                  />
                  <div className={styles.tierCopy}>
                    <span>{video.eyebrow}</span>
                    <h3>{video.title}</h3>
                    <p>{video.description}</p>
                  </div>
                  {planOption ? (
                    <div className={styles.tierPrice}>
                      <strong>{planOption.priceLabel}</strong>
                      <span>{planOption.priceNote}</span>
                    </div>
                  ) : null}
                  <Link className={styles.tierAction} href={planOption?.ctaHref ?? video.cta.href}>
                    {planOption?.ctaLabel ?? video.cta.label}
                  </Link>
                </article>
              )
            })}
          </div>
        </section>

        {VERIFIED_PRODUCT_TOUR_PROOF.length ? (
          <section className={styles.proofSection} aria-labelledby="tour-proof-title">
            <div className={styles.sectionHeading}>
              <span>Member stories</span>
              <h2 id="tour-proof-title">How TenAceIQ helps in real tennis life.</h2>
            </div>
            <div className={styles.proofGrid}>
              {VERIFIED_PRODUCT_TOUR_PROOF.map((proof) => (
                <figure key={proof.id} className={styles.proofCard}>
                  <blockquote>“{proof.quote}”</blockquote>
                  <figcaption>
                    <strong>{proof.memberName}</strong>
                    <span>{[proof.memberRole, proof.organization].filter(Boolean).join(' · ')}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        ) : null}

        <section className={styles.closeout} aria-labelledby="tour-closeout-title">
          <div>
            <span>Start simple</span>
            <h2 id="tour-closeout-title">Explore for free. Add only what helps.</h2>
            <p>Find tennis context now, then unlock the right tools when your game, team, players, competition, or club needs more support.</p>
          </div>
          <div className={styles.actionRow}>
            <Link className={styles.primaryAction} href="/join">Start free</Link>
            <Link className={styles.secondaryAction} href="/resources">More help</Link>
          </div>
        </section>
      </InfoPage>
    </SiteShell>
  )
}
