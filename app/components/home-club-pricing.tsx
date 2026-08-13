import Link from 'next/link'
import TiqFeatureIcon from '@/components/brand/TiqFeatureIcon'
import { CLUB_PLAN_STORY } from '@/lib/product-story'
import styles from './home-club-pricing.module.css'

const plans = [CLUB_PLAN_STORY.starter, CLUB_PLAN_STORY.unlimited]

const clubExperience = [
  'Branded club home and member portal',
  'Connected players, coaches, teams, and programs',
  'Club leagues, tournaments, messages, and results',
] as const

export default function HomeClubPricing() {
  return (
    <section className={styles.section} aria-labelledby="home-club-pricing-title">
      <div aria-hidden="true" className={styles.courtLines} />
      <div className={styles.story}>
        <div className={styles.kickerRow}>
          <span className={styles.icon}>
            <TiqFeatureIcon name="clubTennis" size="md" variant="surface" />
          </span>
          <span className={styles.eyebrow}>TenAceIQ Club</span>
        </div>
        <h2 className={styles.title} id="home-club-pricing-title">
          Run the whole club from one connected tennis experience.
        </h2>
        <p className={styles.body}>
          Give your club a premium, branded home that connects the tools players, coaches, teams,
          leagues, and tournaments already use across TenAceIQ.
        </p>
        <ul className={styles.experienceList}>
          {clubExperience.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className={styles.storyActions}>
          <Link className={styles.primaryAction} href="/pricing#club">Compare Club plans</Link>
          <Link className={styles.textAction} href="/clubs/northstar-tennis-club-demo">See a live Club home <span aria-hidden="true">→</span></Link>
        </div>
      </div>

      <div className={styles.pricing}>
        <div className={styles.pricingIntro}>
          <span>Same complete Club experience</span>
          <strong>Choose by club size.</strong>
          <p>No features are held back on Starter. Capacity is the difference.</p>
        </div>
        <div className={styles.planGrid}>
          {plans.map((plan) => {
            const unlimited = plan.id === CLUB_PLAN_STORY.unlimited.id
            const href = `/upgrade?plan=${plan.id}&next=%2Fclubs&utm_source=homepage&utm_medium=product&utm_campaign=club`

            return (
              <article className={`${styles.planCard} ${unlimited ? styles.featuredPlan : ''}`} key={plan.id}>
                <div className={styles.planTopline}>
                  <span className={styles.planName}>{plan.name}</span>
                  {unlimited ? <span className={styles.badge}>Full-club rollout</span> : null}
                </div>
                <div className={styles.price}>{plan.priceLabel}</div>
                <p className={styles.capacity}>{plan.capacityLabel}</p>
                <p className={styles.planPromise}>
                  {unlimited
                    ? 'Connect every coach, staff member, and player without a people cap.'
                    : 'Launch the full Club experience with a focused group and room to grow.'}
                </p>
                <Link className={unlimited ? styles.primaryAction : styles.secondaryAction} href={href}>
                  Choose {unlimited ? 'Unlimited' : 'Starter'}
                </Link>
              </article>
            )
          })}
        </div>
        <p className={styles.boundary}>{CLUB_PLAN_STORY.workspaceBoundary}</p>
      </div>
    </section>
  )
}
