import type { Metadata } from 'next'
import Link from 'next/link'
import JsonLd from '@/app/components/json-ld'
import SiteShell from '@/app/components/site-shell'
import InfoPage from '@/app/components/info-page'
import { buildRouteMetadata } from '@/lib/route-metadata'
import { buildPublicSectionBreadcrumbJsonLd } from '@/lib/structured-data'
import styles from './walkthrough.module.css'

export const metadata: Metadata = buildRouteMetadata({
  title: 'Upload USTA Data from Your Phone',
  description: 'Watch a step-by-step phone guide for downloading USTA TennisLink exports and uploading them to TenAceIQ.',
  path: '/resources/usta-upload',
})

const guideSteps = [
  ['1', 'Open your team', 'Sign in to TennisLink, open Stats & Standings, then tap your blue team link.'],
  ['2', 'Download the exports', 'Save Team Summary, Player Roster, Match Schedule, or scorecard Excel files to Downloads.'],
  ['3', 'Choose the matching upload', 'In TenAceIQ, use Scorecard, Player Roster, or Schedule for the file you downloaded.'],
  ['4', 'Review and import', 'Check the players, winners, scores, and match details before you confirm the import.'],
] as const

export default function UstaUploadWalkthroughPage() {
  return (
    <SiteShell active="/resources">
      <JsonLd
        id="usta-upload-guide-breadcrumb-jsonld"
        data={buildPublicSectionBreadcrumbJsonLd('USTA Upload Guide', '/resources/usta-upload')}
      />
      <InfoPage
        kicker="Phone walkthrough"
        title="Upload USTA data without the guesswork."
        intro="Follow the complete click path from TennisLink to TenAceIQ. Your uploads help keep match results, player links, schedules, and team insights accurate and connected."
      >
        <div className={styles.actionRow}>
          <Link className={styles.primaryAction} href="/data-assist?intent=upload-source&context=USTA%20phone%20walkthrough">
            Start an upload
          </Link>
          <Link className={styles.secondaryAction} href="#quick-guide">
            Watch the 1-minute guide
          </Link>
        </div>

        <div className={styles.guideLayout}>
          <section className={styles.videoCard} aria-labelledby="full-guide-title">
            <div className={styles.cardHeading}>
              <span>Complete walkthrough</span>
              <strong id="full-guide-title">USTA TennisLink to TenAceIQ</strong>
              <small>2 minutes, 41 seconds</small>
            </div>
            <video
              className={styles.video}
              controls
              playsInline
              preload="metadata"
              poster="/help/usta-data-upload/thumbnail.jpg"
              aria-label="Complete USTA TennisLink to TenAceIQ phone walkthrough"
            >
              <source src="/help/usta-data-upload/full-walkthrough.mp4" type="video/mp4" />
              <track default src="/help/usta-data-upload/full-walkthrough.vtt" kind="captions" srcLang="en" label="English" />
              Your browser does not support video playback.{' '}
              <a href="/help/usta-data-upload/full-walkthrough.mp4">Download the walkthrough</a>.
            </video>
          </section>

          <aside className={styles.stepPanel} aria-labelledby="guide-steps-title">
            <div className={styles.cardHeading}>
              <span>What you will do</span>
              <strong id="guide-steps-title">Four simple moves</strong>
            </div>
            <ol className={styles.stepList}>
              {guideSteps.map(([step, title, body]) => (
                <li key={step} className={styles.stepItem}>
                  <span className={styles.stepNumber}>{step}</span>
                  <span className={styles.stepCopy}>
                    <strong>{title}</strong>
                    <small>{body}</small>
                  </span>
                </li>
              ))}
            </ol>
            <p className={styles.privacyNote}>
              Keep sign-in details private. The walkthrough masks names, team identifiers, and personal information.
            </p>
          </aside>
        </div>

        <section id="quick-guide" className={styles.quickCard} aria-labelledby="quick-guide-title">
          <div className={styles.quickCopy}>
            <span>Quick refresher</span>
            <h2 id="quick-guide-title">Already know TennisLink?</h2>
            <p>Use this 58-second version when you only need the essential download, choose, review, and import path.</p>
          </div>
          <video
            className={styles.quickVideo}
            controls
            playsInline
            preload="none"
            poster="/help/usta-data-upload/thumbnail.jpg"
            aria-label="One-minute USTA TennisLink to TenAceIQ quick guide"
          >
            <source src="/help/usta-data-upload/quick-guide.mp4" type="video/mp4" />
            <track default src="/help/usta-data-upload/quick-guide.vtt" kind="captions" srcLang="en" label="English" />
            Your browser does not support video playback.{' '}
            <a href="/help/usta-data-upload/quick-guide.mp4">Download the quick guide</a>.
          </video>
        </section>

        <footer className={styles.disclaimer}>
          TenAceIQ is an independent tool and is not affiliated with or endorsed by USTA.
        </footer>
      </InfoPage>
    </SiteShell>
  )
}
