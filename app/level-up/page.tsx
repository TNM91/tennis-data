import Link from 'next/link'
import SiteShell from '@/app/components/site-shell'
import TiqFeatureIcon from '@/components/brand/TiqFeatureIcon'
import PlayerLiveWorkbench from '@/app/player-development/_components/player-live-workbench'
import styles from '@/app/player-development/_components/player-development.module.css'
import { PLAYER_DEVELOPMENT_IDENTITIES, getPlayerDevelopmentIdentity } from '@/lib/player-development'
import { getPlayerTrainingMenus } from '@/lib/player-training-menus'

export const metadata = {
  title: 'Level Up | TenAceIQ',
  description: 'Choose what to improve today, start a tennis drill, use the timer, and save a quick Level Up check-in.',
}

export default function LevelUpPage() {
  const identity = getPlayerDevelopmentIdentity('relentless-competitor-4-0')
  const trainingMenus = getPlayerTrainingMenus(identity)

  return (
    <SiteShell active="/mylab">
      <main className={`${styles.shell} ${styles.levelUpShell}`}>
        <section className={styles.levelUpRouteHeader} aria-labelledby="level-up-page-title">
          <div className={styles.levelUpRouteCopy}>
            <span>On-court player tool</span>
            <h1 id="level-up-page-title">Level Up</h1>
            <p>Pick the thing you want to improve right now, choose how you are training, run the drill, rate it, and save the signal.</p>
          </div>
          <div className={styles.levelUpRouteActions} aria-label="Level Up shortcuts">
            <Link className="button-primary" href="#level-up-flow">Start now</Link>
            <Link className="button-secondary" href="/mylab#coach-assignments">Coach work</Link>
            <Link className="button-secondary" href={`/player-development/${identity.slug}/workbook`}>Workbook</Link>
          </div>
        </section>

        <section className={styles.levelUpIdentityStrip} aria-label="Choose development identity">
          <div>
            <TiqFeatureIcon name="matchPrep" size="sm" variant="ghost" />
            <strong>Today&apos;s identity</strong>
            <span>{identity.title.replace(/^The /, '')}: {identity.mantra}</span>
          </div>
          <div className={styles.levelUpIdentityButtons}>
            {PLAYER_DEVELOPMENT_IDENTITIES.map((item) => (
              <Link
                key={item.slug}
                href={`/player-development/${item.slug}/workbook#level-up-flow`}
                data-active={item.slug === identity.slug ? 'true' : 'false'}
              >
                {item.title.replace(/^The /, '')}
              </Link>
            ))}
          </div>
        </section>

        <PlayerLiveWorkbench
          identitySlug={identity.slug}
          identityTitle={identity.title}
          mantra={identity.mantra}
          focuses={identity.sections}
          solo={trainingMenus.solo}
          partner={trainingMenus.partner}
          offCourt={trainingMenus.offCourt}
          performance={trainingMenus.performance}
        />
      </main>
    </SiteShell>
  )
}
