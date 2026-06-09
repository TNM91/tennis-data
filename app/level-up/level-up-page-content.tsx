import Link from 'next/link'
import { Suspense } from 'react'
import SiteShell from '@/app/components/site-shell'
import TiqFeatureIcon from '@/components/brand/TiqFeatureIcon'
import PlayerLiveWorkbench from '@/app/player-development/_components/player-live-workbench'
import styles from '@/app/player-development/_components/player-development.module.css'
import { LEVEL_UP_CARDS, LEVEL_UP_MODULES, getRecommendedLevelUpCards } from '@/lib/level-up/level-up-cards'
import type { LevelUpCard } from '@/lib/level-up/level-up-types'
import { PLAYER_DEVELOPMENT_IDENTITIES, type PlayerDevelopmentIdentity } from '@/lib/player-development'
import { getPlayerTrainingMenus } from '@/lib/player-training-menus'

export default function LevelUpPageContent({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const trainingMenus = getPlayerTrainingMenus(identity)
  const recommendedCards = getRecommendedLevelUpCards(identity.slug, 6)
  const identityModules = LEVEL_UP_MODULES.filter((module) => module.identitySlugs?.includes(identity.slug))
  const recommendedModules = (identityModules.length ? identityModules : LEVEL_UP_MODULES).slice(0, 3)
  const favoritePreview = recommendedCards.slice(0, 3)
  const libraryPacks = [...new Set(LEVEL_UP_CARDS.map((card) => card.pack))].slice(0, 8)
  const quickStartCards = recommendedCards.slice(0, 5)

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
            <Link className="button-secondary" href="/tactics">Tactics Tools</Link>
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
                href={`/level-up/${item.slug}`}
                data-active={item.slug === identity.slug ? 'true' : 'false'}
              >
                {item.title.replace(/^The /, '')}
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.levelUpPortal} aria-labelledby="level-up-portal-title">
          <div className={styles.levelUpPortalHeader}>
            <div>
              <span>Level Up Portal</span>
              <h2 id="level-up-portal-title">Your tennis training hub.</h2>
              <p>Coach assigned work, identity recommendations, favorites, and Level Up Cards live here. Pick what you need, do it on court, rate it, and keep moving.</p>
            </div>
            <div className={styles.levelUpPortalStats} aria-label="Level Up library stats">
              <strong>{LEVEL_UP_CARDS.length}</strong>
              <span>cards ready</span>
            </div>
          </div>

          <div className={styles.levelUpPortalLanes}>
            <Link href="#coach-assigned-work">
              <span>Coach Assigned</span>
              <strong>Your coach work comes first.</strong>
              <p>Coach-invited players complete assigned cards and send simple proof back to the coach.</p>
              <span className={styles.levelUpLaneAction}>Open assignments</span>
            </Link>
            <Link href="#favorite-cards">
              <span>Favorites</span>
              <strong>Player+ quick starts.</strong>
              <p>Pin the cards you repeat most often so training starts in one tap.</p>
              <div className={styles.levelUpMiniList}>
                {favoritePreview.map((card) => <small key={card.id}>{card.title}</small>)}
              </div>
            </Link>
            <Link href="#recommended-cards">
              <span>Recommended for Your Player Identity</span>
              <strong>{identity.title.replace(/^The /, '')}</strong>
              <p>{identity.mantra}</p>
              <div className={styles.levelUpMiniList}>
                {recommendedCards.slice(0, 4).map((card) => <small key={card.id}>{card.title}</small>)}
              </div>
            </Link>
          </div>

          <div id="recommended-cards" className={styles.levelUpCardRail} aria-label="Recommended quick start cards">
            {quickStartCards.map((card) => (
              <LevelUpTrainingCard key={card.id} card={card} />
            ))}
          </div>

          <div id="coach-assigned-work" className={styles.levelUpModuleRail} aria-label="Recommended Level Up modules">
            {recommendedModules.map((module) => (
              <article key={module.id}>
                <span>{module.durationLabel}</span>
                <strong>{module.title}</strong>
                <p>{module.description}</p>
                <small>Proof: {module.proof}</small>
              </article>
            ))}
          </div>

          <div id="favorite-cards" className={styles.levelUpLibraryGrid} aria-label="Level Up Library packs">
            {libraryPacks.map((pack) => (
              <a key={pack} href="#level-up-flow">
                <strong>{pack}</strong>
                <span>{LEVEL_UP_CARDS.filter((card) => card.pack === pack).length} cards</span>
              </a>
            ))}
          </div>
        </section>

        <Suspense fallback={<div className={styles.liveAccessPanel}>Loading Level Up.</div>}>
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
        </Suspense>
      </main>
    </SiteShell>
  )
}

function LevelUpTrainingCard({ card }: { card: LevelUpCard }) {
  return (
    <article id={`level-up-card-${card.id}`}>
      <div>
        <span>{card.pack}</span>
        <strong>{card.title}</strong>
        <p>{card.useWhen}</p>
      </div>
      <dl>
        <div>
          <dt>Time</dt>
          <dd>{card.durationMinutes} min</dd>
        </div>
        <div>
          <dt>Where</dt>
          <dd>{formatCardList(card.setting)}</dd>
        </div>
        <div>
          <dt>Need</dt>
          <dd>{formatCardList(card.equipment)}</dd>
        </div>
      </dl>
      <small>Proof: {card.proof}</small>
      <a className="button-primary" href="#level-up-flow">Start</a>
    </article>
  )
}

function formatCardList(items: string[]) {
  return items.map((item) => item.replaceAll('-', ' ')).join(', ')
}
