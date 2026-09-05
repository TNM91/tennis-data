import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { CAPTAIN_PILOT_FLYER } from '@/lib/captain-pilot-flyer'
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
      <nav className={styles.actions} aria-label="Flyer actions">
        <Link href="/captain-pilot" className={styles.applyLink}>Start 3 months free</Link>
        <a href={CAPTAIN_PILOT_FLYER.pdfPath} target="_blank" rel="noopener noreferrer" className={styles.pdfLink}>Print / save PDF <span>(1 page)</span></a>
      </nav>
      <article className={styles.flyer}>
        <header className={styles.header}>
          <Image src="/brand/logos/tenaceiq-full-white.png" alt="TenAceIQ" width={544} height={144} priority className={styles.logo} />
          <h1>Local Tennis<br />Captains</h1>
          <div className={styles.pilotLabel}><i /> <span>Fall Captain Pilot</span> <i /></div>
          <p>Start your fall season on us.</p>
        </header>

        <section className={styles.offer}>
          <strong>{CAPTAIN_PILOT_FLYER.offer}</strong>
          <span>{CAPTAIN_PILOT_FLYER.duration}</span>
          <span>{CAPTAIN_PILOT_FLYER.renewal}</span>
        </section>

        <section className={styles.body}>
          <div className={styles.value}>
            <p className={styles.toolsLabel}>Captain tools</p>
            <ul>
              {(['access', 'availability', 'lineups', 'scouting', 'teamPlan'] as const).map((icon, index) => (
                <li key={icon}><FlyerBenefitIcon name={icon} className={styles.benefitIcon} /><span>{CAPTAIN_PILOT_FLYER.benefits[index]}</span></li>
              ))}
            </ul>
            <div className={styles.feedbackBlock}>
              <FlyerFeedbackIcon className={styles.feedbackIcon} />
              <span><strong>Bring us the real captain experience.</strong> Your feedback will shape what we build next for local teams.</span>
            </div>
          </div>
          <div className={styles.qrPanel}>
            <div className={styles.workflowRail} aria-hidden="true"><i /><i /><i /></div>
            <Image src="/brand/flyers/fall-2026-captain-pilot-qr.svg" alt="QR code to claim the Fall Captain Pilot" width={360} height={360} loading="eager" />
            <strong>Scan to start</strong>
            <Link href="/captain-pilot">tenaceiq.com/captain-pilot</Link>
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
            <span>{CAPTAIN_PILOT_FLYER.terms}</span>
          </div>
        </footer>
      </article>
      <Link href="/captain-pilot" className={styles.backLink}>Back to the Captain Pilot</Link>
    </main>
  )
}
