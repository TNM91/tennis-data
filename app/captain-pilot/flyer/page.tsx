import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { CAPTAIN_PILOT_PRICE_LABEL } from '@/lib/captain-pilot'
import { FlyerBenefitIcon, FlyerFeedbackIcon } from './flyer-icons'
import styles from './flyer.module.css'

export const metadata: Metadata = {
  title: 'Fall Captain Pilot | TenAceIQ',
  description: 'Three months of TenAceIQ Captain free for eligible local tennis captains.',
  openGraph: {
    title: 'Fall Captain Pilot | TenAceIQ',
    description: 'Three months of Captain free for eligible local tennis captains.',
    images: ['/brand/social/og-image-1200x630.png?v=20260831-final-svg-v1'],
  },
  twitter: {
    title: 'Fall Captain Pilot | TenAceIQ',
    description: 'Three months of Captain free for eligible local tennis captains.',
    images: ['/brand/social/og-image-1200x630.png?v=20260831-final-svg-v1'],
  },
}

export default function CaptainPilotFlyerPage() {
  return (
    <main className={styles.canvas}>
      <article className={styles.flyer}>
        <header className={styles.header}>
          <Image src="/brand/logos/tenaceiq-full-for-light-bg.png" alt="TenAceIQ" width={544} height={144} priority className={styles.logo} />
          <h1>Local Tennis<br />Captains</h1>
          <div className={styles.pilotLabel}><i /> <span>Fall Captain Pilot</span> <i /></div>
          <p>Start your fall season on us.</p>
        </header>

        <section className={styles.offer}>
          <strong>3 months of Captain free</strong>
          <span>3 consecutive months of Captain access from activation.</span>
        </section>

        <section className={styles.body}>
          <div className={styles.value}>
            <p className={styles.toolsLabel}>Captain tools</p>
            <ul>
              <li><FlyerBenefitIcon name="access" className={styles.benefitIcon} /><span><strong>Everything in Player +</strong> Team Hub + Captain Tools.</span></li>
              <li><FlyerBenefitIcon name="availability" className={styles.benefitIcon} /><span><strong>Know availability</strong> before lineup pressure.</span></li>
              <li><FlyerBenefitIcon name="lineups" className={styles.benefitIcon} /><span><strong>Build and compare lineups.</strong></span></li>
              <li><FlyerBenefitIcon name="scouting" className={styles.benefitIcon} /><span><strong>Scout teams and pairings.</strong></span></li>
              <li><FlyerBenefitIcon name="teamPlan" className={styles.benefitIcon} /><span><strong>Send a clear team plan.</strong></span></li>
            </ul>
            <div className={styles.feedbackBlock}>
              <FlyerFeedbackIcon className={styles.feedbackIcon} />
              <span><strong>Bring us the real captain experience.</strong> Your feedback will shape what we build next for local teams.</span>
            </div>
          </div>
          <div className={styles.qrPanel}>
            <div className={styles.workflowRail} aria-hidden="true"><i /><i /><i /></div>
            <Image src="/brand/flyers/fall-2026-captain-pilot-qr.svg" alt="QR code to claim the Fall Captain Pilot" width={360} height={360} loading="eager" />
            <strong>Scan to apply</strong>
            <span>tenaceiq.com/captain-pilot</span>
          </div>
        </section>

        <footer className={styles.footer}>
          <div className={styles.contact}>
            <div>
              <strong>Your feedback builds what’s next</strong>
              <span>Questions or feedback? <a href="mailto:nathan@tenaceiq.com">Nathan@TenAceiQ.com</a></span>
            </div>
            <Image src="/brand/logos/tenaceiq-iq-for-light-bg.png" alt="TenAceIQ iQ" width={142} height={142} loading="eager" />
          </div>
          <div className={styles.terms}>
            <strong>Pilot terms</strong>
            <span>Offer available through December 31, 2026, for eligible local tennis captains. Captain tier only. One claim per captain or team. New Captain pilot participants only; not transferable, resalable, or combinable with other offers. Trial begins when checkout is completed. Captain access renews at {CAPTAIN_PILOT_PRICE_LABEL} until canceled. TenAceIQ may revoke access for misuse or modify the offer where permitted.</span>
          </div>
        </footer>
      </article>
      <Link href="/captain-pilot" className={styles.backLink}>Back to the Captain Pilot</Link>
    </main>
  )
}
