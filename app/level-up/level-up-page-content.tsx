import Link from 'next/link'
import { Suspense } from 'react'
import SiteShell from '@/app/components/site-shell'
import TiqFeatureIcon from '@/components/brand/TiqFeatureIcon'
import PlayerLiveWorkbench from '@/app/player-development/_components/player-live-workbench'
import styles from '@/app/player-development/_components/player-development.module.css'
import { LEVEL_UP_CARDS, LEVEL_UP_MODULES, getRecommendedLevelUpCards } from '@/lib/level-up/level-up-cards'
import type { LevelUpCard } from '@/lib/level-up/level-up-types'
import { buildLevelUpHabitPaths, buildLevelUpQuestBuilderPlan, formatHabitCategory } from '@/lib/level-up/quest-builder'
import {
  PLAYER_DEVELOPMENT_IDENTITIES,
  getPlayerDevelopmentIdentityActionRead,
  getPlayerDevelopmentIdentityCourtsideRead,
  type PlayerDevelopmentIdentity,
} from '@/lib/player-development'
import { getPlayerTrainingMenus } from '@/lib/player-training-menus'
import { MEMBERSHIP_TIERS } from '@/lib/product-story'
import HabitPathWizardClient from './habit-path-wizard-client'
import QuestBuilderClient from './quest-builder-client'

export default function LevelUpPageContent({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const trainingMenus = getPlayerTrainingMenus(identity)
  const recommendedCards = getRecommendedLevelUpCards(identity.slug, 6)
  const identityModules = LEVEL_UP_MODULES.filter((module) => module.identitySlugs?.includes(identity.slug))
  const recommendedModules = (identityModules.length ? identityModules : LEVEL_UP_MODULES).slice(0, 3)
  const favoritePreview = recommendedCards.slice(0, 3)
  const libraryPacks = [...new Set(LEVEL_UP_CARDS.map((card) => card.pack))].slice(0, 8)
  const quickStartCards = recommendedCards.slice(0, 5)
  const actionRead = getPlayerDevelopmentIdentityActionRead(identity)
  const courtsideRead = getPlayerDevelopmentIdentityCourtsideRead(identity)
  const playerIdRows = [
    ['Profile ID', identity.title.replace(/^The /, '')],
    ['Weapon', actionRead.title],
    ['Train first', actionRead.trainingPriority],
    ['Proof target', actionRead.proofTarget],
    ['Leak to watch', actionRead.leakWatch],
    ['Match trigger', actionRead.matchTrigger],
  ] as const
  const firstRecommendedCard = recommendedCards[0]
  const playerIdProofTrail = [
    {
      label: 'Profile signal',
      title: identity.title.replace(/^The /, ''),
      body: actionRead.levelUpNudge,
    },
    {
      label: 'Drill proof',
      title: firstRecommendedCard?.title ?? 'Recommended Level Up card',
      body: firstRecommendedCard?.proof ?? 'Run the rep, rate the proof, and keep the next tennis cue visible.',
    },
    {
      label: 'Coach read',
      title: actionRead.coachPrompt,
      body: 'Save the session so the Player ID can carry proof into My Lab, coach assignments, and the next matchup.',
    },
    {
      label: 'Match test',
      title: actionRead.matchTrigger,
      body: 'The identity is not complete until it shows up in the score moment where the player usually leaks.',
    },
  ] as const
  const nextBestRepSignals = [
    ['Rep', firstRecommendedCard?.title ?? actionRead.trainingPriority],
    ['Proof', firstRecommendedCard?.proof ?? actionRead.proofTarget],
    ['Save to', 'My Lab proof trail'],
  ] as const
  const primaryWeapon = identity.identityProfile.primaryWeapons[0] ?? actionRead.title
  const primaryLeak = identity.identityProfile.styleLeaks[0] ?? actionRead.leakWatch
  const playerIdOnCourtBrief = [
    {
      label: 'Before practice',
      title: actionRead.trainingPriority,
      body: `Use ${primaryWeapon} as the intention, then name the leak before the rep starts: ${primaryLeak}`,
    },
    {
      label: 'During the rep',
      title: firstRecommendedCard?.title ?? actionRead.title,
      body: `Score the proof target in plain tennis language: ${firstRecommendedCard?.proof ?? actionRead.proofTarget}`,
    },
    {
      label: 'After the score',
      title: actionRead.nextCue,
      body: `Carry the cue into My Lab, matchup prep, or the next practice note so the Player ID stays useful.`,
    },
    {
      label: 'Coach handoff',
      title: actionRead.coachPrompt,
      body: 'Give the coach one saved proof point instead of a generic lesson recap.',
    },
  ] as const
  const questBuilder = buildLevelUpQuestBuilderPlan(identity.slug)
  const habitPaths = buildLevelUpHabitPaths(identity.slug)
  const playerTier = MEMBERSHIP_TIERS.player_plus
  const coachTier = MEMBERSHIP_TIERS.coach
  const captainTier = MEMBERSHIP_TIERS.captain
  const questBuilderCardOptions = LEVEL_UP_CARDS.map((card) => ({
    id: card.id,
    title: card.title,
    pack: card.pack,
    proof: card.proof,
  }))
  const questBuilderTemplateOptions = questBuilder.templates.map((template) => ({
    id: template.id,
    title: template.title,
    category: template.category,
    cadence: template.cadence,
    xp: template.xp,
    description: template.description,
    proof: template.proof,
    starterHabit: template.starterHabit,
    primaryCardId: template.primaryCard.id,
    primaryCardTitle: template.primaryCard.title,
  }))
  const questBuilderPathOptions = habitPaths
    .filter((path) => path.primaryCard)
    .map((path) => ({
      id: path.id,
      title: path.title,
      category: path.category,
      cadence: path.cadence,
      xp: path.xp,
      primaryCardId: path.primaryCard?.id ?? '',
      proof: path.proof,
      starterHabit: path.habits[0] ?? path.bestFor,
    }))
  const habitPathWizardOptions = habitPaths.map((path) => ({
    id: path.id,
    label: path.label,
    title: path.title,
    bestFor: path.bestFor,
    weeklyTarget: path.weeklyTarget,
    proof: path.proof,
    primaryCardTitle: path.primaryCard?.title ?? 'Level Up card',
    drillHref: path.drillHref,
    questHref: path.questHref,
    coachHref: path.coachHref,
    captainHref: path.captainHref,
  }))
  const primaryHabitPath = habitPaths[0]
  const iphoneQuickActions = [
    {
      label: 'Drill',
      title: 'Start the next rep',
      href: primaryHabitPath?.drillHref ?? '#level-up-flow',
    },
    {
      label: 'Quest',
      title: 'Build a habit',
      href: primaryHabitPath?.questHref ?? '#quest-builder',
    },
    {
      label: 'Path',
      title: 'Find your track',
      href: '#habit-path-wizard-title',
    },
    {
      label: 'Proof',
      title: 'Score the work',
      href: '#level-up-flow',
    },
  ]
  const questPackPreviews = [
    {
      label: 'Player habit packs',
      title: 'Build a repeatable tennis week',
      detail: 'Save drill-backed habits for skill, movement, match prep, recovery, mindset, and hydration.',
      href: `/level-up/${identity.slug}#quest-builder`,
      action: 'Open builder',
    },
    {
      label: 'Coach assignable packs',
      title: 'Send one focused assignment',
      detail: 'Use a pack to point players toward the same card, proof target, and cadence.',
      href: '/coach?levelUpPack=doubles-readiness',
      action: 'Preview Coach bridge',
    },
    {
      label: 'Team challenge packs',
      title: 'Run a lineup-ready habit',
      detail: 'Track aggregate completion for team routines without exposing private player notes.',
      href: '/captain?levelUpChallenge=match-day-routine',
      action: 'Preview team mode',
    },
  ]
  const habitBuilderLanes = [
    {
      label: 'Skill',
      title: 'Attach the habit to a drill card',
      detail: 'Serve routine, crosscourt patience, return intent, volley decisions, and doubles communication all start with proof-backed cards.',
    },
    {
      label: 'Fitness',
      title: 'Make body work tennis-specific',
      detail: 'Movement, first step, posture, leg durability, and mobility habits connect to how points actually break down.',
    },
    {
      label: 'Nutrition & hydration',
      title: 'Use simple readiness checks',
      detail: 'Hydration, pre-match timing, and practice-day fuel can live as lightweight habits without calorie tracking.',
    },
    {
      label: 'Recovery',
      title: 'Protect the next session',
      detail: 'Post-play mobility, sleep-support routines, and soreness notes help players arrive cleaner for the next tennis block.',
    },
    {
      label: 'Mindset',
      title: 'Train the between-point reset',
      detail: 'Confidence, breathing, target clarity, and post-error routines become repeatable quests with a clear 0-5 proof score.',
    },
    {
      label: 'Match prep',
      title: 'Turn match day into a checklist',
      detail: 'Warm-up, first target, doubles jobs, return plans, and post-match learning can be repeated across the season.',
    },
  ]

  return (
    <SiteShell active="/mylab" showPortalToolBar={false}>
      <main className={`${styles.shell} ${styles.levelUpShell}`}>
        <section className={styles.levelUpRouteHeader} aria-labelledby="level-up-page-title">
          <div className={styles.levelUpRouteCopy}>
            <span>On-court player tool</span>
            <h1 id="level-up-page-title">Level Up</h1>
            <p>Pick the thing you want to improve right now, choose how you are training, run the drill, rate it, and save the signal.</p>
          </div>
          <div className={styles.levelUpRouteActions} aria-label="Level Up shortcuts">
            <Link className="button-primary" href="#level-up-flow">Start now</Link>
            <Link className="button-secondary" href="#today-quest-stack-title">Today</Link>
            <Link className="button-secondary" href="#quest-builder">Quest Builder</Link>
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

        <section className={styles.levelUpNextRepCommand} aria-label="Level Up next best rep command">
          <div className={styles.levelUpNextRepCommandCopy}>
            <span>Next best rep</span>
            <h2>Start with one card, one proof score, one next cue.</h2>
            <p>{actionRead.levelUpNudge}</p>
          </div>
          <div className={styles.levelUpNextRepCommandCard}>
            <span>{firstRecommendedCard?.pack ?? 'Player ID card'}</span>
            <strong>{firstRecommendedCard?.title ?? actionRead.trainingPriority}</strong>
            <small>{firstRecommendedCard?.useWhen ?? actionRead.matchTrigger}</small>
          </div>
          <div className={styles.levelUpNextRepCommandSignals} aria-label="Level Up next best rep proof signals">
            {nextBestRepSignals.map(([label, value]) => (
              <article key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
          <div className={styles.levelUpNextRepCommandActions}>
            <Link className="button-primary" href="#level-up-flow">Start rep</Link>
            <Link className="button-secondary" href="/mylab#level-up-proof">View proof</Link>
          </div>
        </section>

        <section className={styles.playerIdSnapshot} aria-labelledby="level-up-player-id-title">
          <div className={styles.playerIdSnapshotHeader}>
            <span className={styles.kicker}>Level Up player ID</span>
            <h2 id="level-up-player-id-title">Pick the drill that matches the player profile.</h2>
            <p>
              Start from the identity read, then choose the card that trains the highest-value tennis behavior for the next match.
            </p>
          </div>
          <div className={styles.playerIdSnapshotGrid}>
            {playerIdRows.map(([label, value]) => (
              <article key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
          <div className={styles.playerIdOnCourtBrief} aria-label="Level Up Player ID on-court brief">
            {playerIdOnCourtBrief.map((item) => (
              <article key={item.label}>
                <span>{item.label}</span>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
          <div className={styles.playerIdLevelUpBridge}>
            <div>
              <span>Recommended first</span>
              <strong>{recommendedCards[0]?.tennisGoal ?? identity.promise}</strong>
            </div>
            <div>
              {recommendedCards.slice(0, 2).map((card) => (
                <a href="#level-up-flow" key={card.id}>
                  <span>{card.pack}</span>
                  <strong>{card.title}</strong>
                  <small>{card.proof}</small>
                </a>
              ))}
            </div>
          </div>
          <div className={styles.playerIdProofTrail} aria-label="Level Up Player ID proof trail">
            {playerIdProofTrail.map((item) => (
              <article key={item.label}>
                <span>{item.label}</span>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.levelUpIphoneCommandCenter} aria-label="Level Up iPhone command center">
          <div>
            <span>iPhone quick start</span>
            <strong>Today&apos;s court commands</strong>
          </div>
          <div>
            {iphoneQuickActions.map((action) => (
              <Link key={action.label} href={action.href}>
                <span>{action.label}</span>
                <strong>{action.title}</strong>
              </Link>
            ))}
          </div>
        </section>

        <nav className={styles.levelUpIphoneDock} aria-label="Level Up mobile dock">
          {iphoneQuickActions.map((action) => (
            <Link key={action.label} href={action.href}>
              <span>{action.label}</span>
            </Link>
          ))}
        </nav>

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
              <strong>{playerTier.name} quick starts.</strong>
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

        <section className={styles.levelUpQuestPackPreview} aria-labelledby="quest-pack-preview-title">
          <div className={styles.levelUpQuestPackPreviewHeader}>
            <span>Quest pack preview</span>
            <h2 id="quest-pack-preview-title">One habit system for players, coaches, and teams.</h2>
            <p>Quest packs turn TIQ drill cards into practical weekly habits. Players keep private proof, coaches can assign focused work, and captains can run team challenges from aggregate completion.</p>
          </div>
          <div className={styles.levelUpQuestPackPreviewGrid}>
            {questPackPreviews.map((preview) => (
              <Link key={preview.label} href={preview.href}>
                <span>{preview.label}</span>
                <strong>{preview.title}</strong>
                <p>{preview.detail}</p>
                <small>{preview.action}</small>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.levelUpQuestPackPreview} aria-labelledby="habit-builder-foundation-title">
          <div className={styles.levelUpQuestPackPreviewHeader}>
            <span>Habit Builder foundation</span>
            <h2 id="habit-builder-foundation-title">A public habit system for every level of tennis player.</h2>
            <p>TenAceIQ habits stay tennis-first: practical actions, linked drills, proof scores, XP, streaks, and coach/team handoffs when the player chooses to share.</p>
          </div>
          <div className={styles.levelUpQuestPackPreviewGrid}>
            {habitBuilderLanes.map((lane) => (
              <article key={lane.label}>
                <span>{lane.label}</span>
                <strong>{lane.title}</strong>
                <p>{lane.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.levelUpHabitPaths} aria-labelledby="habit-paths-title">
          <div className={styles.levelUpQuestPackPreviewHeader}>
            <span>Habit paths</span>
            <h2 id="habit-paths-title">Start from your tennis level, then attach the drill.</h2>
            <p>These starter tracks keep Level Up useful for newer players, recreational players, competitive players, and doubles teams without changing the core habit loop.</p>
          </div>
          <div className={styles.levelUpHabitPathGrid}>
            {habitPaths.map((path) => (
              <article key={path.id}>
                <div className={styles.levelUpHabitPathHeader}>
                  <span>{path.label}</span>
                  <strong>{path.title}</strong>
                  <p>{path.playerLevel}</p>
                </div>
                <dl>
                  <div>
                    <dt>Weekly target</dt>
                    <dd>{path.weeklyTarget}</dd>
                  </div>
                  <div>
                    <dt>Best for</dt>
                    <dd>{path.bestFor}</dd>
                  </div>
                </dl>
                <ul>
                  {path.habits.map((habit) => (
                    <li key={habit}>{habit}</li>
                  ))}
                </ul>
                <div className={styles.levelUpHabitPathCards}>
                  {path.linkedCards.slice(0, 3).map((card) => (
                    <small key={card.id}>{card.title}</small>
                  ))}
                </div>
                <small>Proof: {path.proof}</small>
                <div className={styles.levelUpHabitPathActions}>
                  <Link className="button-primary" href={path.drillHref}>
                    Start drill
                  </Link>
                  <Link className="button-secondary" href={path.questHref}>
                    Build quest
                  </Link>
                  <Link className="button-secondary" href={path.coachHref}>
                    Coach pack
                  </Link>
                  <Link className="button-secondary" href={path.captainHref}>
                    Team challenge
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <HabitPathWizardClient paths={habitPathWizardOptions} />

        <section className={styles.levelUpFeatureFrame} aria-labelledby="level-up-feature-frame-title">
          <div className={styles.levelUpQuestPackPreviewHeader}>
            <span>Level Up product loop</span>
            <h2 id="level-up-feature-frame-title">Personal habits, coach assignments, and team challenges use the same tennis proof.</h2>
            <p>{playerTier.description}</p>
          </div>
          <div className={styles.levelUpFeatureFrameGrid}>
            <article>
              <span>{playerTier.name}</span>
              <strong>Custom habit builder</strong>
              <p>Save drill-backed quests, XP, streaks, and proof history inside My Lab and Level Up.</p>
            </article>
            <article>
              <span>{coachTier.name}</span>
              <strong>Assignment-ready packs</strong>
              <p>Turn the same path into focused student work with proof a coach can review after the player shares it.</p>
            </article>
            <article>
              <span>{captainTier.name}</span>
              <strong>Aggregate team challenges</strong>
              <p>Run lineup-ready habits while keeping private player notes and proof details with each player.</p>
            </article>
          </div>
        </section>

        <section id="quest-builder" className={styles.levelUpQuestBuilder} aria-labelledby="quest-builder-title">
          <div className={styles.levelUpQuestBuilderHeader}>
            <div>
              <span>Quest Builder</span>
              <h2 id="quest-builder-title">Turn tennis habits into drill-backed quests.</h2>
              <p>Create a repeatable habit, attach the right Level Up Card, and use drill proof to score the quest. This keeps skill work, fitness, hydration, recovery, and mindset tied to better tennis.</p>
            </div>
            <div className={styles.levelUpQuestBuilderStats}>
              <strong>{questBuilder.categories.length}</strong>
              <span>quest lanes</span>
            </div>
          </div>

          <div className={styles.levelUpQuestBuilderFlow} aria-label="Quest Builder flow">
            <article>
              <span>1</span>
              <strong>Pick the habit</strong>
              <small>Choose tennis skill, fitness, nutrition, mindset, recovery, or match prep.</small>
            </article>
            <article>
              <span>2</span>
              <strong>Attach a drill</strong>
              <small>Link the habit to a Level Up Card with proof, timing, setting, and equipment.</small>
            </article>
            <article>
              <span>3</span>
              <strong>Score the proof</strong>
              <small>Complete the drill, rate the proof, earn XP, and keep the streak alive.</small>
            </article>
          </div>

          <div className={styles.levelUpQuestTemplateGrid}>
            {questBuilder.templates.map((template) => (
              <article key={template.id}>
                <div>
                  <span>{formatHabitCategory(template.category)}</span>
                  <strong>{template.title}</strong>
                  <p>{template.description}</p>
                </div>
                <dl>
                  <div>
                    <dt>Cadence</dt>
                    <dd>{template.cadence.replaceAll('-', ' ')}</dd>
                  </div>
                  <div>
                    <dt>XP</dt>
                    <dd>{template.xp}</dd>
                  </div>
                  <div>
                    <dt>Drill</dt>
                    <dd>{template.primaryCard.title}</dd>
                  </div>
                </dl>
                <small>Starter habit: {template.starterHabit}</small>
                <small>Proof: {template.proof}</small>
                <Link className="button-primary" href={template.drillHref}>
                  Start linked drill
                </Link>
              </article>
            ))}
          </div>

          <QuestBuilderClient
            identitySlug={identity.slug}
            cardOptions={questBuilderCardOptions}
            templates={questBuilderTemplateOptions}
            paths={questBuilderPathOptions}
          />
        </section>

        <Suspense fallback={<div className={styles.liveAccessPanel}>Loading Level Up.</div>}>
          <PlayerLiveWorkbench
            identitySlug={identity.slug}
            identityTitle={identity.title}
            mantra={identity.mantra}
            identityCourtsideRead={courtsideRead}
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
