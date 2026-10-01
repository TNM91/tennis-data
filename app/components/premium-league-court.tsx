import Image from 'next/image'
import styles from './premium-league-court.module.css'

export default function PremiumLeagueCourt({ className = '' }: { className?: string }) {
  return (
    <div className={`${styles.scene} ${className}`} aria-hidden="true">
      <div className={styles.artworkPlane}>
        <Image
          src="/brand/marketing/premium-league-night-court.png"
          alt=""
          fill
          loading="eager"
          sizes="(max-width: 760px) 100vw, 760px"
          className={styles.courtArtwork}
        />
        <div className={styles.netWatermark}>
          <Image
            src="/brand/masters/tenaceiq-full-dark-ui.svg"
            alt=""
            width={240}
            height={68}
          />
        </div>
      </div>
    </div>
  )
}
