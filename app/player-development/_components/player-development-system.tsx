import Link from 'next/link'
import { create as createQrCode } from 'qrcode'
import BrandWordmark from '@/app/components/brand-wordmark'
import PlayerSuitePanel from '@/app/components/player-suite-panel'
import SiteShell from '@/app/components/site-shell'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import TiqCourt from '@/components/tactical/TiqCourt'
import { courtSpots, courtZones } from '@/components/tactical/coordinates'
import type { DrillOverlay } from '@/components/tactical/types'
import { LEVEL_UP_CARDS } from '@/lib/level-up/level-up-cards'
import { LEVEL_UP_MODULES } from '@/lib/level-up/level-up-modules'
import { getLevelUpProfileForIdentity } from '@/lib/level-up/recommendations'
import {
  PLAYER_DEVELOPMENT_IDENTITIES,
  PLAYER_DEVELOPMENT_DIAGRAMS,
  getPlayerDevelopmentIdentityActionRead,
  getPlayerDevelopmentIdentityCourtsideRead,
  getPlayerDevelopmentIdentity,
  type CoachLessonPlan,
  type PlayerDevelopmentDiagram,
  type PlayerDevelopmentIdentity,
  type PlayerDevelopmentWeek,
} from '@/lib/player-development'
import { getPlayerTrainingMenus } from '@/lib/player-training-menus'
import { DATA_ASSIST_STORY, PRODUCT_MOTTO, getMembershipTier } from '@/lib/product-story'
import PlayerDevelopmentPrintControls from './player-development-print-controls'
import PlayerLiveWorkbench from './player-live-workbench'
import styles from './player-development.module.css'

type PlayerDevelopmentSystemProps = {
  focus?: 'overview' | 'workbook' | 'coach'
  identitySlug?: string
}

const playerTier = getMembershipTier('player_plus')
const TIQ_SITE_URL = 'https://tenaceiq.com'

export default function PlayerDevelopmentSystem({ focus = 'overview', identitySlug }: PlayerDevelopmentSystemProps) {
  const identity = getPlayerDevelopmentIdentity(identitySlug)
  const packetView = focus !== 'overview'
  const improveLanding = focus === 'overview' && !identitySlug
  const workbookPrintActive = focus === 'workbook'
  const coachPrintActive = focus === 'coach'
  const identityHeroDiagram = getIdentityHeroDiagram(identity)
  const identityShortTitle = identity.title.replace(/^The /, '')

  const content = (
    <main className={`${styles.shell} ${packetView ? styles.packetShell : ''} player-development-print-surface`}>
        {!packetView ? (
          <>
            {improveLanding ? <ImproveLandingHub identity={identity} /> : null}

            <section className={styles.hero}>
              <div className={styles.heroCopy}>
                <div className={styles.brandRow}>
                  <BrandWordmark top />
                  <span className={styles.printBadge}>Phone-first Level Up</span>
                </div>
                <p className={styles.kicker}>TenAceIQ Player ID + Level Up</p>
                {improveLanding ? (
                  <h2 className={styles.heroTitle}>{identity.title}</h2>
                ) : (
                  <h1 className={styles.heroTitle}>{identity.title}</h1>
                )}
                <p className={styles.heroText}>
                  {PRODUCT_MOTTO} Choose today&apos;s court habit, run the rep from your phone, score one proof, and keep the next step visible for {identity.ratingBand.toLowerCase()}: {identity.promise}
                </p>
                <div className={styles.actions}>
                  <Link className="button-primary" href={`/player-development/${identity.slug}/level-up`}>
                    Start Level Up
                  </Link>
                  <Link className="button-secondary" href={`/level-up/${identity.slug}#level-up-flow`}>
                    Open phone drill mode
                  </Link>
                  <Link className="button-secondary" href={`/player-development/${identity.slug}/coach-planner`}>
                    Coach handoff
                  </Link>
                </div>
              </div>
              <div className={styles.heroPanel}>
                <CourtDiagram diagram={identityHeroDiagram} title={`${identityShortTitle} court map`} />
                <div className={styles.identityCard}>
                  <TiqFeatureIcon name="myLab" size="md" variant="surface" />
                  <div>
                    <span>Player identity</span>
                    <strong>{identityShortTitle}</strong>
                    <p>{identity.mantra}</p>
                  </div>
                </div>
              </div>
            </section>

            <PlayerIdActionPlan identity={identity} />

            <PlayerSuitePanel
              active="development"
              playerLabel={`${playerTier.name} development path`}
              flow={['lab', 'development', 'matchup', 'refresh']}
            />

            <PlayerQuestionStrip identity={identity} />

            <PlayerIdentitySnapshot identity={identity} />

            <IdentitySelector activeSlug={identity.slug} />

            <section className={styles.structurePanel} aria-labelledby="structure-title">
              <div className={styles.sectionHead}>
                <p className={styles.kicker}>Player Development</p>
                <h2 id="structure-title">Turn match goals into phone-ready court work.</h2>
                <p>
                  Use Level Up, phone court mode, weekly proof scores, match evidence, and My Lab check-ins to keep improvement moving between matches and lessons. Print backups stay available when a coach or player wants paper.
                </p>
              </div>
              <div className={styles.planGrid}>
                <PlanCard icon="myLab" title="My Lab connection" items={['Choose a goal', 'Save match evidence', 'Track the next read']} />
                <PlanCard icon="reports" title="Phone Level Up" items={['On-court reps', 'Timer', '0-5 proof', 'Next action']} />
                <PlanCard icon="schedule" title="Coach handoff" items={['Assignment cue', 'Proof standard', 'Review prompt', 'Print backup']} />
              </div>
            </section>
          </>
        ) : (
          <section className={styles.packetHeader} aria-label="Paper backup">
            <BrandWordmark top />
            <div>
              <p className={styles.kicker}>{focus === 'coach' ? 'Coach planner' : 'Print backup'}</p>
              <h1>{identity.title}</h1>
            </div>
          </section>
        )}

        {packetView ? (
          <PlayerDevelopmentPrintControls
            activePacket={focus === 'coach' ? 'coach' : 'workbook'}
            identitySlug={identity.slug}
          />
        ) : null}

        {focus === 'overview' ? <LevelUpOverviewPanel identity={identity} /> : null}
        {focus === 'overview' || focus === 'workbook' ? <PlayerMissionDashboard identity={identity} /> : null}
        {focus === 'workbook' ? <WorkbookPreview identity={identity} active printActive={workbookPrintActive} /> : null}
        {focus === 'coach' ? <CoachPlannerPreview identity={identity} active printActive={coachPrintActive} /> : null}

        {!packetView ? (
          <>
            <ConnectedCompanion identity={identity} />
          </>
        ) : null}
    </main>
  )

  if (packetView) return content

  return (
    <SiteShell active="you">
      {content}
    </SiteShell>
  )
}

function getIdentityHeroDiagram(identity: PlayerDevelopmentIdentity): PlayerDevelopmentDiagram {
  return identity.weeks.find((week) => week.diagram !== 'player-led-review')?.diagram ?? 'movement-screen'
}

function ImproveLandingHub({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const actions = [
    {
      body: 'Run the next court rep, score one proof, and decide whether to repeat, progress, or test it in a match.',
      cta: 'Start Level Up',
      href: `/level-up/${identity.slug}#level-up-flow`,
      icon: 'reports' as const,
      title: 'Start Level Up',
    },
    {
      body: 'Keep goals, match notes, proof history, follows, and coach assignments close to your player profile.',
      cta: 'Open My Lab',
      href: '/mylab#player-workshop',
      icon: 'myLab' as const,
      title: 'Open My Lab',
    },
    {
      body: 'Turn the next Player ID cue into a serve pattern, return plan, or point map before you compete.',
      cta: 'Build a tactic board',
      href: '/tactics?source=improve&template=crosscourt&role=player',
      icon: 'scenarioBuilder' as const,
      title: 'Build a tactic board',
    },
  ]

  return (
    <section className={styles.improveHub} aria-labelledby="improve-hub-title">
      <div className={styles.improveHubCopy}>
        <h1 id="improve-hub-title">Improve</h1>
        <p>
          Start with the work you can do today: train one rep, save one player signal,
          or map the tactic you want to use in the next match.
        </p>
      </div>
      <div className={styles.improveHubActions} aria-label="Improve actions">
        {actions.map((action) => (
          <Link className={styles.improveHubAction} href={action.href} key={action.title}>
            <TiqFeatureIcon name={action.icon} size="md" variant="surface" />
            <span>{action.title}</span>
            <strong>{action.body}</strong>
            <em>{action.cta}</em>
          </Link>
        ))}
      </div>
    </section>
  )
}

function PlayerIdActionPlan({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const actionRead = getPlayerDevelopmentIdentityActionRead(identity)
  const profile = getLevelUpProfileForIdentity(identity.slug)
  const firstCard = LEVEL_UP_CARDS.find((card) => profile.starterCardIds.includes(card.id))
  const playerDevelopmentLevelUpHref = `/player-development/${identity.slug}/level-up${firstCard ? `?card=${firstCard.id}` : ''}`
  const drillModeHref = `/level-up/${identity.slug}${firstCard ? `?card=${firstCard.id}#level-up-flow` : '#level-up-flow'}`
  const actionRows = [
    ['Train', actionRead.trainingPriority],
    ['Prove', firstCard?.proof ?? actionRead.proofTarget],
    ['Use it', actionRead.nextCue],
  ] as const

  return (
    <section className={styles.playerIdActionPlan} aria-label="Player ID action plan">
      <div className={styles.playerIdActionPlanCopy}>
        <TiqFeatureIcon name="matchPrep" size="sm" variant="ghost" />
        <div>
          <span>Player ID action plan</span>
          <strong>Train the identity before the next score moment.</strong>
          <p>{actionRead.levelUpNudge}</p>
        </div>
      </div>
      <div className={styles.playerIdActionPlanGrid} aria-label="Player ID train prove use loop">
        {actionRows.map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <div className={styles.playerIdActionPlanCard}>
        <span>{firstCard?.pack ?? 'Level Up starter'}</span>
        <strong>{firstCard?.title ?? actionRead.title}</strong>
        <small>{firstCard?.useWhen ?? actionRead.matchTrigger}</small>
      </div>
      <div className={styles.playerIdActionPlanActions}>
        <Link className="button-primary" href={playerDevelopmentLevelUpHref}>
          Start Level Up
        </Link>
        <Link className="button-secondary" href={drillModeHref}>
          Open drill mode
        </Link>
      </div>
    </section>
  )
}

function IdentitySelector({ activeSlug }: { activeSlug: string }) {
  return (
    <section className={styles.identitySelector} aria-labelledby="identity-selector-title">
      <div className={styles.sectionHead}>
        <p className={styles.kicker}>Development identities</p>
        <h2 id="identity-selector-title">Choose the player path</h2>
        <p>
          Each identity opens a Level Up path, phone court flow, coach handoff, and My Lab companion for the same development loop.
        </p>
      </div>
      <div className={styles.identitySelectorGrid}>
        {PLAYER_DEVELOPMENT_IDENTITIES.map((identity) => {
          const active = identity.slug === activeSlug
          return (
            <Link
              href={`/player-development/${identity.slug}`}
              className={styles.identitySelectorCard}
              data-active={active ? 'true' : 'false'}
              key={identity.slug}
            >
              <TiqFeatureIcon name={active ? 'myLab' : 'playerRatings'} size="sm" variant={active ? 'surface' : 'ghost'} />
              <div>
                <span>{identity.ratingBand}</span>
                <strong>{identity.title}</strong>
                <p>{identity.mantra}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

function PlayerQuestionStrip({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const cards = getPlayerQuestionCards(identity)

  return (
    <section className={styles.playerQuestionStrip} aria-labelledby="player-question-strip-title">
      <div className={styles.playerQuestionStripHeader}>
        <p className={styles.kicker}>Player quick starts</p>
        <h2 id="player-question-strip-title">Find the next useful tennis move.</h2>
        <p>Start with the tennis need you have today, then open the path that gets you back to court work fastest.</p>
      </div>
      <div className={styles.playerQuestionGrid}>
        {cards.map((card) => (
          <Link className={styles.playerQuestionCard} href={card.href} key={card.question}>
            <TiqFeatureIcon name={card.icon} size="sm" variant="ghost" />
            <span>{card.label}</span>
            <strong>{card.question}</strong>
            <p>{card.answer}</p>
            <small>{card.cta}</small>
          </Link>
        ))}
      </div>
    </section>
  )
}

function getPlayerQuestionCards(identity: PlayerDevelopmentIdentity) {
  return [
    {
      icon: 'myLab',
      label: 'Focus',
      question: 'What should I work on?',
      answer: `Start with ${identity.title.replace(/^The /, '')} and choose the habit that can change your next match fastest.`,
      href: `/player-development/${identity.slug}#weekly-action-plan`,
      cta: 'Choose a focus',
    },
    {
      icon: 'reports',
      label: 'Progress',
      question: 'How am I improving?',
      answer: 'Use quick ratings, proof notes, and Level Up history to see whether to repeat, progress, or test in a match.',
      href: `/player-development/${identity.slug}#toolbelt`,
      cta: 'Check progress',
    },
    {
      icon: 'matchPrep',
      label: 'Match prep',
      question: 'What matchups matter?',
      answer: 'Use the match card before, during, and after play so the lesson turns into a practical match plan.',
      href: `/player-development/${identity.slug}#match-card`,
      cta: 'Prep the match',
    },
    {
      icon: 'schedule',
      label: 'Drills',
      question: 'What drills or resources can help me level up faster?',
      answer: 'Open Level Up for the recommended cards, coach assignments, favorites, and proof history tied to this player path.',
      href: `/player-development/${identity.slug}/level-up`,
      cta: 'Start Level Up',
    },
  ] satisfies Array<{
    icon: TiqFeatureIconName
    label: string
    question: string
    answer: string
    href: string
    cta: string
  }>
}

function PlayerIdentitySnapshot({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const actionRead = getPlayerDevelopmentIdentityActionRead(identity)
  const profile = getLevelUpProfileForIdentity(identity.slug)
  const starterCards = LEVEL_UP_CARDS.filter((card) => profile.starterCardIds.includes(card.id)).slice(0, 2)
  const rows = [
    ['Profile ID', identity.title.replace(/^The /, '')],
    ['Primary weapon', actionRead.title],
    ['Training priority', actionRead.trainingPriority],
    ['Proof target', actionRead.proofTarget],
    ['Style leak', actionRead.leakWatch],
    ['Match trigger', actionRead.matchTrigger],
  ] as const
  const firstStarterCard = starterCards[0]
  const handoffRows = [
    ['Log', firstStarterCard?.proof ?? actionRead.proofTarget],
    ['Ask', actionRead.coachPrompt],
    ['Try next', actionRead.nextCue],
  ] as const

  return (
    <section className={styles.playerIdSnapshot} aria-labelledby="player-id-snapshot-title">
      <div className={styles.playerIdSnapshotHeader}>
        <p className={styles.kicker}>Player ID snapshot</p>
        <h2 id="player-id-snapshot-title">Know the player profile before choosing the work.</h2>
        <p>
          Use this quick read before Level Up, lessons, or match prep so the identity becomes a practical tennis decision instead of a label.
        </p>
      </div>
      <div className={styles.playerIdSnapshotGrid}>
        {rows.map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <div className={styles.playerIdLevelUpBridge}>
        <div>
          <span>First Level Up move</span>
          <strong>{actionRead.levelUpNudge}</strong>
          <small>{profile.recommendationCopy}</small>
        </div>
        <div>
          {starterCards.map((card) => (
            <Link href={`/player-development/${identity.slug}/level-up?card=${card.id}`} key={card.id}>
              <span>{card.pack}</span>
              <strong>{card.title}</strong>
              <small>{card.proof}</small>
            </Link>
          ))}
        </div>
      </div>
      <div className={styles.playerIdProofTrail} aria-label="Player ID action read">
        <article>
          <span>Coach read</span>
          <strong>{actionRead.coachPrompt}</strong>
          <p>Use this question before assigning more work so the next lesson starts from evidence.</p>
        </article>
        <article>
          <span>Next cue</span>
          <strong>{actionRead.nextCue}</strong>
          <p>Make the cue visible before practice, then score whether it stayed alive under pressure.</p>
        </article>
        <article>
          <span>Match test</span>
          <strong>{actionRead.matchTrigger}</strong>
          <p>Do not wait for a perfect drill block. Test the identity when the match asks for it.</p>
        </article>
      </div>
      <div className={styles.playerIdHandoffBoard} aria-label="Player ID handoff board">
        <div>
          <span>Profile ID handoff</span>
          <strong>Make the next touchpoint easier.</strong>
          <p>Use the same three signals when you log Level Up work, message a coach, or prep the next match.</p>
        </div>
        <div className={styles.playerIdHandoffGrid}>
          {handoffRows.map(([label, value]) => (
            <article key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </div>
        <div className={styles.playerIdHandoffActions}>
          <Link className="button-primary" href={`/player-development/${identity.slug}/level-up${firstStarterCard ? `?card=${firstStarterCard.id}` : ''}`}>
            Log this proof
          </Link>
          <Link className="button-secondary" href="/mylab#coach-assignments">
            Open coach work
          </Link>
        </div>
      </div>
    </section>
  )
}

function PlanCard({ icon, title, items }: { icon: TiqFeatureIconName; title: string; items: string[] }) {
  return (
    <article className={styles.planCard}>
      <TiqFeatureIcon name={icon} size="sm" variant="ghost" />
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  )
}

function LevelUpOverviewPanel({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const profile = getLevelUpProfileForIdentity(identity.slug)
  const modules = LEVEL_UP_MODULES.filter((module) => profile.featuredModuleIds.includes(module.id)).slice(0, 3)
  const cards = LEVEL_UP_CARDS.filter((card) => profile.starterCardIds.includes(card.id)).slice(0, 3)

  return (
    <section className={styles.levelUpOverviewPanel} aria-labelledby="level-up-overview-title">
      <div className={styles.sectionHead}>
        <p className={styles.kicker}>Level Up Portal</p>
        <h2 id="level-up-overview-title">Recommended for this identity.</h2>
        <p>{profile.recommendationCopy}</p>
      </div>
      <div className={styles.levelUpOverviewGrid}>
        <article>
          <span>Top modules</span>
          {modules.map((module) => <strong key={module.id}>{module.title}</strong>)}
        </article>
        <article>
          <span>Starter cards</span>
          {cards.map((card) => <strong key={card.id}>{card.title}</strong>)}
        </article>
        <article>
          <span>Daily use</span>
          <p>Coach-assigned tools, identity recommendations, favorites, and proof history live in the portal.</p>
          <Link className="button-primary" href={`/player-development/${identity.slug}/level-up`}>Open Level Up Portal</Link>
        </article>
      </div>
    </section>
  )
}

function PlayerMissionDashboard({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const primaryModule = identity.weeks[0]
  const primaryFocus = identity.sections[0]
  const trainingMenus = getPlayerTrainingMenus(identity)
  const courtsideRead = getPlayerDevelopmentIdentityCourtsideRead(identity)

  return (
    <>
      <section className={styles.missionDashboard} aria-labelledby="mission-dashboard-title">
        <div className={styles.missionHero}>
          <TiqFeatureIcon name="matchPrep" size="lg" variant="surface" />
          <div>
            <span>Today&apos;s player mission</span>
            <h2 id="mission-dashboard-title">Use one tool today. Prove one habit.</h2>
            <p>{identity.mantra}</p>
          </div>
        </div>
        <div className={styles.missionGrid}>
          <article>
            <span>Current focus</span>
            <strong>{primaryFocus?.title ?? 'Choose one habit'}</strong>
            <p>{primaryFocus?.cue ?? 'Pick the habit that changes the next match fastest.'}</p>
          </article>
          <article>
            <span>Today&apos;s cue</span>
            <strong>When the habit breaks, reset before the next ball.</strong>
            <p>Make the cue visible before practice, not after the mistake.</p>
          </article>
          <article>
            <span>Tool to use</span>
            <strong>{primaryModule?.title ?? 'Weekly action plan'}</strong>
            <p>{primaryModule?.pressureGame ?? 'Test the habit under score, fatigue, or a missed ball.'}</p>
          </article>
          <article>
            <span>Reward</span>
            <strong>Check the rep when you respond like the player you are becoming.</strong>
            <p>Reward the controlled behavior, not only the point result.</p>
          </article>
        </div>
        <div className={styles.missionActions}>
          <Link className="button-primary" href="#weekly-action-plan">Start today</Link>
          <Link className="button-secondary" href="#toolbelt">Pick a tool</Link>
          <Link className="button-secondary" href="#match-card">Match mode</Link>
          <Link className="button-secondary" href="#performance-upgrade">Performance upgrade</Link>
        </div>
      </section>
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
    </>
  )
}

function WorkbookPreview({
  identity,
  active,
  printActive,
}: {
  identity: PlayerDevelopmentIdentity
  active: boolean
  printActive: boolean
}) {
  const moduleCount = identity.weeks.length

  return (
    <section
      className={`${styles.printBook} ${active ? styles.focusSection : ''}`}
      aria-labelledby="workbook-title"
      data-print-active={printActive ? 'true' : 'false'}
    >
      <WorkbookPage className={styles.coverPage} core footer="Workbook cover">
        <div className={styles.pageTopline}>
          <BrandWordmark compact onLight />
          <span>Print backup</span>
        </div>
        <div className={styles.coverContent}>
          <p className={styles.kicker}>{moduleCount}-module {identity.programLabel.toLowerCase()}</p>
          <h2 id="workbook-title">{identity.title}</h2>
          <p>{identity.audience} {identity.promise}</p>
          <div className={styles.levelPath}>
            <span>{identity.levelPath.from}</span>
            <i />
            <span>{identity.levelPath.to}</span>
          </div>
          <div className={styles.coverMeta}>
            <span>Player</span>
            <span>Coach</span>
            <span>{moduleCount} modules</span>
          </div>
          <div className={styles.coverAccess}>
            <strong>Optional print backup. Phone Level Up is the connected path.</strong>
            <p>Use these pages only when paper helps. Scan to open Level Up for phone courtside reps, proof scores, progress, and coach handoffs when {playerTier.name} access is active.</p>
            <QrAction href={`/player-development/${identity.slug}/level-up`} label="Open Level Up" />
          </div>
        </div>
        <CourtDiagram diagram={identity.weeks[0]?.diagram ?? 'movement-screen'} title={`${identity.title.replace(/^The /, '')} court map`} />
      </WorkbookPage>

      <WorkbookPage core footer="Packet index">
        <PageHeader label="Packet index" title="How to use this backup" />
        <WorkbookPacketIndex identity={identity} />
      </WorkbookPage>

      <WorkbookPage core footer="Level Up Portal companion">
        <PageHeader label="Level Up Portal Companion" title="The field guide plus the card library" />
        <div className={styles.tiqPromptBlock}>
          <span>Digital-first training</span>
          <p>
            The print backup holds the plan. The Level Up Portal gives you the live card library: coach-assigned tools,
            identity recommendations, favorites, and proof history.
          </p>
          <QrAction href={`/player-development/${identity.slug}/level-up`} label="Open Level Up Portal" mode="player-plus" />
        </div>
      </WorkbookPage>

      <WorkbookPage core footer="Today's lesson">
        <PageHeader label="Lesson-ready page" title="Use this before your next session" />
        <TodayLessonSheet identity={identity} />
      </WorkbookPage>

      <WorkbookPage core footer="Goal check-in">
        <PageHeader label="Player check-in" title="Goal, work, proof, next step" />
        <PlayerGoalCheckIn identity={identity} />
      </WorkbookPage>

      <WorkbookPage core footer="Weekly action plan">
        <div id="weekly-action-plan" />
        <PageHeader label="Start here" title="Your one-week action plan" />
        <PlayerWeeklyActionPlan identity={identity} />
      </WorkbookPage>

      <WorkbookPage core footer="Focus decision">
        <div id="toolbelt" />
        <PageHeader label="Tool belt" title="Pick the tool that solves this week" />
        <PlayerFocusDecisionPage identity={identity} />
      </WorkbookPage>

      <WorkbookPage core footer="Progression card">
        <PageHeader label="Progression" title="Know when to repeat, progress, or test in a match" />
        <PlayerProgressionCard identity={identity} />
      </WorkbookPage>

      <WorkbookPage core footer="Match card">
        <div id="match-card" />
        <PageHeader label="Match card" title="Before, during, after" />
        <PlayerMatchOnePager identity={identity} />
      </WorkbookPage>

      <WorkbookPage core footer="Identity">
        <PageHeader label="Identity page" title="Define how you win" />
        <div className={styles.identityBlueprint}>
          <div>
            <span>Archetype</span>
            <strong>{identity.archetype}</strong>
            <p>{identity.levelPath.context}</p>
          </div>
          <div>
            <span>Level path</span>
            <strong>{identity.levelPath.from} to {identity.levelPath.to}</strong>
            <p>{identity.mantra}</p>
          </div>
        </div>
        <div className={styles.identityGrid}>
          {identity.traits.map((trait) => (
            <div className={styles.traitBox} key={trait}>{trait}</div>
          ))}
        </div>
        <div className={styles.outcomeGrid}>
          {identity.outcomes.map((outcome) => (
            <span key={outcome}>{outcome}</span>
          ))}
        </div>
        <div className={styles.mantraPanel}>
          <span>Player mantra</span>
          <strong>{identity.mantra}</strong>
        </div>
        <ReflectionLines label="My match identity in one sentence" rows={4} />
        <ReflectionLines label="The habit my coach should hold me to" rows={4} />
      </WorkbookPage>

      <WorkbookPage footer="Style finder">
        <PageHeader label="Style finder" title="Recognize the player you are becoming" />
        <IdentityProfileBoard identity={identity} />
      </WorkbookPage>

      <WorkbookPage footer="Match triggers">
        <PageHeader label="Match triggers" title="When this identity has to show up" />
        <IdentityTriggerSheet identity={identity} />
      </WorkbookPage>

      <WorkbookPage footer="Self audit">
        <PageHeader label="Self audit" title="Find the next training priority" />
        <IdentitySelfAudit identity={identity} />
      </WorkbookPage>

      <WorkbookPage footer="Identity guardrails">
        <PageHeader label="Guardrails" title="What this identity is not" />
        <IdentityGuardrails identity={identity} />
      </WorkbookPage>

      <WorkbookPage footer="Evidence library">
        <PageHeader label="Evidence library" title="What proof looks like" />
        <MatchEvidenceLibrary identity={identity} />
      </WorkbookPage>

      <WorkbookPage footer={`${playerTier.name} handoff`}>
        <PageHeader label={`${playerTier.name} workflow`} title="Turn the backup into court work" />
        <div className={styles.playerPlusBridge}>
          <TiqFeatureIcon name="myLab" size="lg" variant="surface" />
          <div>
            <span>Backup to My Lab</span>
            <h3>Set one goal, track one behavior, bring one note to your coach.</h3>
            <p>
              Level Up is the primary path. This paper guide stands on its own when needed. {playerTier.name} unlocks the connected layer:
              goal updates, match reflections, serve target charts, progress history, and coach handoff notes.
            </p>
          </div>
        </div>
        <PlayerPlusAccessNote />
        <div className={styles.bridgeSteps}>
          {identity.tiqPrompts.map((prompt, index) => (
            <article key={prompt.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{prompt.title}</strong>
              <p>{prompt.cue}</p>
              <QrAction href={prompt.href} label={prompt.title} />
            </article>
          ))}
        </div>
        <ReflectionLines label="This module I will bring this evidence into TenAceIQ" rows={4} />
      </WorkbookPage>

      <WorkbookPage core footer="Training menu">
        <PageHeader label="Player tool belt" title="Find the right drill fast" />
        <PlayerToolBeltMenu identity={identity} />
      </WorkbookPage>

      <WorkbookPage footer="Solo training">
        <div id="solo-training" />
        <PageHeader label="Player practice" title="Court work you can do by yourself" />
        <PlayerSoloTraining identity={identity} />
      </WorkbookPage>

      <WorkbookPage footer="Hitting partner">
        <div id="partner-training" />
        <PageHeader label="Player practice" title="Drills to run with a hitting partner" />
        <PlayerPartnerTraining identity={identity} />
      </WorkbookPage>

      <WorkbookPage footer="Off-court work">
        <div id="off-court-work" />
        <PageHeader label="Player practice" title="Off-court work that changes match habits" />
        <PlayerOffCourtTraining identity={identity} />
      </WorkbookPage>

      <WorkbookPage core footer="Performance upgrade">
        <div id="performance-upgrade" />
        <PageHeader label="Performance upgrade" title="Level up the engine that supports your game" />
        <PlayerPerformanceUpgrade identity={identity} />
      </WorkbookPage>

      <WorkbookPage footer="At-home performance">
        <div id="at-home-performance" />
        <PageHeader label="At-home performance" title="Strength, conditioning, mobility, and recovery" />
        <PlayerAtHomePerformanceTraining identity={identity} />
      </WorkbookPage>

      <WorkbookPage footer="Focus selector">
        <PageHeader label="Focus selector" title="Choose the next two-week focus" />
        <NextFocusSelector identity={identity} />
      </WorkbookPage>

      <WorkbookPage footer="Practice chooser">
        <PageHeader label="Practice chooser" title="If this is the leak, train this" />
        <PracticeChooser identity={identity} />
      </WorkbookPage>

      <WorkbookPage footer="Coach conversation">
        <PageHeader label="Coach conversation" title="Bring this to the next lesson" />
        <CoachConversationSheet identity={identity} />
      </WorkbookPage>

      <WorkbookPage footer="Opponent plans">
        <PageHeader label="Opponent plans" title="Adjust without losing the identity" />
        <OpponentAdjustmentSheet identity={identity} />
      </WorkbookPage>

      <WorkbookPage footer="Match-day routine">
        <PageHeader label="Match day" title="Before match, during match, after match" />
        <MatchDayRoutine identity={identity} />
      </WorkbookPage>

      <WorkbookPage footer="Development path">
        <PageHeader label="Path map" title="Development phase map" />
        <div className={styles.phaseMap}>
          {identity.phases.map((phase, index) => (
            <article className={styles.phaseCard} key={phase.title}>
              <div className={styles.phaseNumber}>{String(index + 1).padStart(2, '0')}</div>
              <div>
                <span>{phase.weeks}</span>
                <h3>{phase.title}</h3>
                <p>{phase.focus}</p>
                <strong>Proof</strong>
                <p>{phase.proof}</p>
              </div>
            </article>
          ))}
        </div>
        <div className={styles.phaseHandoff}>
          <TiqFeatureIcon name="myLab" size="md" variant="surface" />
          <div>
            <span>{playerTier.name} rhythm</span>
            <strong>Plan the phase, train the module, upload the evidence.</strong>
        <p>Print pages are useful when paper helps. {playerTier.name} turns each phase into tracked goals, coach notes, and match reflections inside TenAceIQ.</p>
          </div>
        </div>
      </WorkbookPage>

      <WorkbookPage footer="Baseline">
        <PageHeader label="Baseline evaluation" title="Rate the habits before the development block" />
        <RubricScale />
        <div className={styles.scoreGrid}>
          {identity.sections.map((section) => (
            <article className={styles.scoreBox} key={section.id}>
              <TiqFeatureIcon name={section.icon} size="sm" variant="ghost" />
              <h3>{section.title}</h3>
              {section.tracker.slice(0, 4).map((item) => (
                <div className={styles.scoreLine} key={item}>
                  <span>{item}</span>
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              ))}
            </article>
          ))}
        </div>
      </WorkbookPage>

      <WorkbookPage footer="Level-up scorecard">
        <PageHeader label={`${playerTier.name} scorecard`} title={`${identity.levelPath.from} to ${identity.levelPath.to}`} />
        <EvidenceRubric />
        <LevelUpScorecard identity={identity} />
      </WorkbookPage>

      <WorkbookPage footer="Readiness gates">
        <PageHeader label="Readiness gates" title={`What ${identity.levelPath.to} requires`} />
        <PlayerReadinessGates identity={identity} />
      </WorkbookPage>

      {identity.weeks.map((week) => (
        <WeeklyWorkbookPage identity={identity} key={week.week} week={week} />
      ))}

      <WorkbookPage footer="Accountability">
        <PageHeader label="Accountability" title="Module recap + coach notes" />
        <TrackerTable columns={['Focus', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Match', 'Evidence']} rows={['Movement', 'Serve', 'Attack selection', 'Conditioning', 'Doubles']} />
        <div className={styles.twoColumn}>
          <ReflectionLines label="Module recap" rows={6} />
          <ReflectionLines label="Coach notes" rows={6} />
        </div>
      </WorkbookPage>

      <WorkbookPage footer={`${playerTier.name} evidence`}>
        <PageHeader label={`${playerTier.name} evidence`} title="What goes back into TenAceIQ" />
        <PlayerPlusEvidenceLog identity={identity} weeks={identity.weeks.slice(0, 4)} />
      </WorkbookPage>

      <WorkbookPage footer={`${playerTier.name} evidence`}>
        <PageHeader label={`${playerTier.name} evidence`} title="Second-half evidence log" />
        <PlayerPlusEvidenceLog identity={identity} weeks={identity.weeks.slice(4)} />
        <div className={styles.twoColumn}>
          <ReflectionLines label="Best evidence from this block" rows={4} />
          <ReflectionLines label="Coach follow-up request" rows={4} />
        </div>
      </WorkbookPage>

      <WorkbookPage footer="Level Up check-in">
        <PageHeader label="Level Up check-in" title="Coach-ready check-in" />
        <PlayerPlusCheckIn identity={identity} />
        <div className={styles.twoColumn}>
          <ReflectionLines label="What I want TenAceIQ to track next" rows={4} />
          <ReflectionLines label="What I need from my coach" rows={4} />
        </div>
      </WorkbookPage>

      <WorkbookPage footer={`${playerTier.name} companion`}>
        <PageHeader label="Connected companion" title={`What ${playerTier.name} adds to the phone path`} />
        <PlayerPlusCompanionMap identity={identity} />
      </WorkbookPage>

      <ReusableWorkbookSheets identity={identity} />
    </section>
  )
}

function PlayerPlusAccessNote() {
  return (
    <div className={styles.accessNote}>
      <TiqFeatureIcon name="playerRatings" size="sm" variant="ghost" />
      <div>
        <strong>Level Up first. Print backup when needed.</strong>
        <p>
          Anyone can use the print backup as a training guide if it is shared with them.
          Coach-invited players can complete assigned Level Up work through the coach tier.
          {playerTier.name} unlocks self-guided goals, check-ins, progress history, and recommendations.
        </p>
      </div>
    </div>
  )
}

function WorkbookPacketIndex({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const sections = [
    ['Start here', 'Write the plan goal and rate where you are today.'],
    ['Tool belt', 'Choose the tool that matches what you want to improve.'],
    ['Training menu', 'Find solo, partner, performance, match, doubles, and off-court work.'],
    ['Performance Upgrade', 'Choose the movement, strength, conditioning, or recovery tool that supports this week\'s habit.'],
    ['Modules', 'Use the module only when it supports this week\'s goal.'],
    [`${playerTier.name} companion`, 'Update goals, quick check-ins, and coach assignment status.'],
  ] as const

  return (
    <div className={styles.packetIndex}>
      <div className={styles.packetIndexHero}>
        <TiqFeatureIcon name="reports" size="lg" variant="surface" />
        <div>
          <span>{identity.levelPath.from} to {identity.levelPath.to}</span>
          <strong>This is a tool belt. Use the page that matches the problem in front of you.</strong>
          <p>Each week should produce one clear goal, a few quick ratings, and one small note if it helps you choose the next tool.</p>
        </div>
      </div>
      <div className={styles.packetIndexGrid}>
        {sections.map(([title, text], index) => (
          <article key={title}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{title}</strong>
            <p>{text}</p>
          </article>
        ))}
      </div>
      <TrackerTable columns={['If I need', 'Go to', 'Use it for', 'Quick check-in']} rows={['Plan goal', 'Tool belt', 'Self drill', 'Partner / doubles drill', 'Performance upgrade', 'Off-court habit']} />
    </div>
  )
}

function TodayLessonSheet({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const firstModule = identity.weeks[0]
  const focusOptions = identity.sections.slice(0, 5)

  return (
    <div className={styles.todayLessonSheet}>
      <div className={styles.lessonReadyHero}>
        <TiqFeatureIcon name="schedule" size="lg" variant="surface" />
        <div>
          <span>Your session setup</span>
          <strong>Pick one focus, test it under pressure, leave with one assignment.</strong>
          <p>
            Use this page before the session starts. It gives you a clear target and a quick pass/fix/retest loop.
          </p>
        </div>
      </div>
      <div className={styles.sessionFields}>
        {['Player', 'Date', 'Module', 'Coach'].map((field) => (
          <div key={field}>
            <span>{field}</span>
            <i />
          </div>
        ))}
      </div>
      <div className={styles.todayFocusGrid}>
        {focusOptions.map((section, index) => (
          <article key={section.id}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{section.title}</strong>
            <p>{section.cue}</p>
          </article>
        ))}
      </div>
      <div className={styles.lessonTestGrid}>
        <article>
          <span>Warm-up read</span>
          <strong>{firstModule?.mainDrill ?? 'Start with the cleanest repeatable rep.'}</strong>
          <p>Watch feet, target clarity, and recovery before adding score.</p>
        </article>
        <article>
          <span>Pressure test</span>
          <strong>{firstModule?.pressureGame ?? 'Make the drill survive score pressure.'}</strong>
          <p>Retest the same habit after fatigue, missed balls, or a 30-30 score.</p>
        </article>
        <article>
          <span>Proof due</span>
          <strong>{firstModule?.accountability ?? 'Write the evidence before the next lesson.'}</strong>
          <p>You should leave knowing exactly what counts as progress.</p>
        </article>
      </div>
      <TrackerTable
        columns={['Test', 'Pass', 'Fix cue', 'Retest result']}
        rows={['Routine holds under pressure', 'Target named before contact', 'Recovery happens after contact', 'You can explain the next assignment']}
      />
      <QuickRatingStrip labels={['Plan clear', 'Body ready', 'Focus locked', 'Confidence']} />
      <div className={styles.twoColumn}>
        <ReflectionLines label="Plan goal in one sentence" rows={3} />
        <ReflectionLines label="Small note if needed" rows={3} />
      </div>
    </div>
  )
}

function PlayerGoalCheckIn({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const rows = [
    'Plan goal',
    'Practice effort',
    'Execution',
    'Pressure response',
    'Confidence',
  ]

  return (
    <div className={styles.playerCheckInSheet}>
      <div className={styles.playerCheckInHero}>
        <TiqFeatureIcon name="myLab" size="lg" variant="surface" />
        <div>
          <span>Player quick check-in</span>
          <strong>Rate it fast. Write one note only if it helps you choose the next tool.</strong>
          <p>
            This is not a summary page. It is a quick read on your plan, your work, and what you should train next.
          </p>
        </div>
      </div>
      <div className={styles.goalLoopGrid}>
        {['Plan', 'Rate', 'Choose', 'Act'].map((step, index) => (
          <article key={step}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{step}</strong>
            <p>
              {step === 'Plan'
                ? `Pick one ${identity.title.replace(/^The /, '').toLowerCase()} habit.`
                : step === 'Rate'
                  ? 'Use numbers first. Save writing for what actually matters.'
                  : step === 'Choose'
                    ? 'Use the tool belt: solo, partner, doubles, match, performance, or off-court.'
                    : 'Do the smallest useful action before adding more goals.'}
            </p>
          </article>
        ))}
      </div>
      <QuickRatingStrip labels={['Plan clarity', 'Effort', 'Execution', 'Pressure', 'Confidence']} />
      <TrackerTable columns={['Quick check-in', '0-5 rating', 'Tool to use next', 'Tiny note if needed']} rows={rows} />
      <HabitRewardStrip labels={['I rated it honestly', 'I chose the next useful tool', 'I kept the note small enough to act on']} />
      <div className={styles.twoColumn}>
        <ReflectionLines label="Plan goal" rows={3} />
        <ReflectionLines label="Small overall note if needed" rows={3} />
      </div>
    </div>
  )
}

function PlayerWeeklyActionPlan({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const { solo, partner, offCourt, performance } = getPlayerTrainingMenus(identity)
  const primaryModule = identity.weeks[0]
  const actions = [
    ['Choose', 'Circle one habit that would change your next match fastest.', identity.sections[0]?.title ?? 'Movement'],
    ['Train', 'Do one court action twice this week.', solo[0]?.[0] ?? 'Solo training'],
    ['Upgrade', 'Pick one at-home performance block that supports the habit.', performance[1]?.[0] ?? 'Performance Upgrade'],
    ['Show', 'Bring one 0-5 proof rating back to your coach or My Lab.', primaryModule?.accountability ?? 'Evidence note'],
  ] as const
  const guideRows = [
    `Solo: ${solo[0]?.[0] ?? 'Court work'}`,
    `Partner: ${partner[0]?.[0] ?? 'Hitting drill'}`,
    `Performance: ${performance[1]?.[0] ?? 'Movement engine'}`,
    `Off court: ${offCourt[0]?.[0] ?? 'Match note'}`,
    `Module: ${primaryModule ? `${primaryModule.week} - ${primaryModule.title}` : 'Choose one module'}`,
  ]

  return (
    <div className={styles.weeklyActionPlan}>
      <div className={styles.weeklyActionHero}>
        <TiqFeatureIcon name="matchPrep" size="lg" variant="surface" />
        <div>
          <span>Use this first</span>
          <strong>One week. One habit. One proof note.</strong>
          <p>
            If a page does not help you act this week, skip it. Come back when that page answers a real problem.
          </p>
        </div>
      </div>
      <div className={styles.actionStepGrid}>
        {actions.map(([label, text, example], index) => (
          <article key={label}>
            <span>{String(index + 1).padStart(2, '0')} {label}</span>
            <strong>{text}</strong>
            <p>Example: {example}</p>
          </article>
        ))}
      </div>
      <TrackerTable columns={['This week', 'My choice', 'Done?', 'Proof']} rows={guideRows} />
      <QuickRatingStrip labels={['Goal clear', 'On-court work', 'Performance work', 'Match ready']} />
      <QuickCheckStrip labels={['Picked one habit', 'Court work done', 'Off-court work done', 'Proof written']} />
      <HabitRewardStrip labels={['I responded before reacting', 'I made the next rep clearer', 'I brought proof to my coach']} />
      <CodexAssistBox
        title="Build this week's loop"
        prompt="Turn this week's tennis goal into one cue, one routine, one reward, and one proof note."
      />
      <div className={styles.twoColumn}>
        <ReflectionLines label="The one habit I am training this week" rows={4} />
        <ReflectionLines label="Small note if needed" rows={4} />
      </div>
    </div>
  )
}

function PlayerFocusDecisionPage({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const isRelentless = identity.slug.includes('relentless')
  const choices = isRelentless
    ? [
        ['Serve breaks under pressure', 'Self drill + shoulder/core support', 'Call wide, body, or T before the toss. Add shoulder + core support. Rate routine clarity 0-5.'],
        ['Feet stop after contact', 'Recovery lanes + cone recover', 'Recover before watching the result. Add cone recover + shadow swing. Rate recovery 0-5.'],
        ['You attack too early', 'Offense-neutral-defense rally + mobility reset', 'Call defend, neutral, or offense before contact. Add post-play mobility reset. Rate decision quality 0-5.'],
        ['You rush when stretched', 'Match card + jump rope rhythm', 'Hit high-margin defense, recover, breathe, then play the next ball. Add jump rope rhythm. Rate calm 0-5.'],
        ['Legs die late', 'Late-game footwork + wall sit durability', 'Use score pressure on court. Add lower-body recovery circuit. Rate posture under fatigue 0-5.'],
      ]
    : [
        ['You force line changes', 'Crosscourt earn-and-change + mobility reset', 'Build crosscourt depth before changing direction. Add post-play mobility reset. Rate patience 0-5.'],
        ['Serve does not create a first ball', 'Serve plus-one shadow + shoulder/core support', 'Name the +1 target before the serve. Add shoulder + core support. Rate first-ball clarity 0-5.'],
        ['Returns start neutral or worse', 'Return step-in game + jump rope rhythm', 'Step in on second serves and recover after depth. Add jump rope rhythm. Rate return intent 0-5.'],
        ['You approach and stop', 'Short-ball close + cone close', 'Close, split, then choose the finish. Add cone close + recover. Rate forward movement 0-5.'],
        ['Attacks become panic swings', 'Match card + core/balance circuit', 'Reset when the attack is not earned. Add core + balance circuit. Rate decision quality 0-5.'],
      ]

  return (
    <div className={styles.focusDecisionPage}>
      <div className={styles.focusDecisionHero}>
        <TiqFeatureIcon name="scenarioBuilder" size="lg" variant="surface" />
        <div>
          <span>Tool belt rule</span>
          <strong>Choose the tool that matches what you want to improve.</strong>
          <p>Pick one row. Use it for seven days. Rate it quickly, then switch tools only when the rating tells you to.</p>
        </div>
      </div>
      <div className={styles.focusDecisionGrid}>
        {choices.map(([problem, page, action], index) => (
          <article key={problem}>
            <span>{String(index + 1).padStart(2, '0')} If</span>
            <strong>{problem}</strong>
            <p><b>Tool:</b> {page}</p>
            <p><b>Do:</b> {action}</p>
          </article>
        ))}
      </div>
      <TrackerTable
        columns={['I want to improve', 'Tool I need', '0-5 now', 'Use next']}
        rows={identity.sections.slice(0, 5).map((section) => section.title)}
      />
      <QuickCheckStrip labels={['One focus only', 'Tool chosen', 'Rating done', 'Next action clear']} />
      <HabitRewardStrip labels={['I picked one useful tool', 'I trained the habit, not just the score', 'I made the next rep clearer']} />
      <CodexAssistBox
        title="Choose one court tool"
        prompt="Help me choose one court tool and one Performance Upgrade that match the leak I circled."
      />
    </div>
  )
}

const progressionStages = [
  ['Learn the cue', 'You can say the cue before the ball starts.', 'Repeat if you still need the coach to remind you.'],
  ['Repeat clean reps', 'You can do it without score and recover after the shot.', 'Progress if you can do it three times in a row.'],
  ['Add pressure', 'You can do it with score, fatigue, or a tougher feed.', 'Stay here if it disappears when the point matters.'],
  ['Match proof', 'You can point to one moment from a real match.', 'Move on only when you have proof you can explain.'],
] as const

function PlayerProgressionCard({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const moduleRows = identity.weeks.slice(0, 4).map((week) => `Module ${week.week}: ${week.title}`)

  return (
    <div className={styles.playerProgressionCard}>
      <div className={styles.progressionHero}>
        <TiqFeatureIcon name="reports" size="lg" variant="surface" />
        <div>
          <span>How you move forward</span>
          <strong>Do not chase a new page until the current habit shows up under pressure.</strong>
          <p>Use this card after practice or a match. It tells you whether to repeat, make it harder, or bring it to your coach.</p>
        </div>
      </div>
      <div className={styles.progressionStageGrid}>
        {progressionStages.map(([stage, proof, rule], index) => (
          <article key={stage}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{stage}</strong>
            <p>{proof}</p>
            <p><b>Rule:</b> {rule}</p>
          </article>
        ))}
      </div>
      <TrackerTable
        columns={['Current focus', 'Stage today', 'Proof I have', 'Next move']}
        rows={moduleRows}
      />
      <QuickCheckStrip labels={['Cue clear', 'Clean reps', 'Pressure tested', 'Match proof']} />
      <div className={styles.twoColumn}>
        <ReflectionLines label="I should repeat because" rows={4} />
        <ReflectionLines label="I am ready to progress because" rows={4} />
      </div>
    </div>
  )
}

function PlayerMatchOnePager({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const isRelentless = identity.slug.includes('relentless')
  const preMatch = isRelentless
    ? [
        ['Identity cue', identity.mantra],
        ['Serve plan', 'Call wide, body, or T before the toss.'],
        ['First three games', 'Move feet after contact and watch where the opponent gets rushed.'],
      ]
    : [
        ['Identity cue', identity.mantra],
        ['Serve plan', 'Choose the +1 ball you are trying to create.'],
        ['First three games', 'Build crosscourt before changing line or closing forward.'],
      ]
  const duringMatch = isRelentless
    ? [
        ['If you get tight', 'Breathe, name the target, play with margin.'],
        ['If legs get heavy', 'Recover before watching and make the next ball neutral.'],
        ['If you miss attacking', 'Go back to earning offensive balls before accelerating.'],
      ]
    : [
        ['If you get tight', 'Build one more ball before trying to finish.'],
        ['If you rush forward', 'Split after the approach before choosing the volley.'],
        ['If errors stack', 'Use placement and court position before extra speed.'],
      ]
  const checkInRows = [
    'Score and opponent',
    'Plan rating 0-5',
    'Pressure rating 0-5',
    'One thing to train next',
  ]

  return (
    <div className={styles.matchOnePager}>
      <div className={styles.matchCardHero}>
        <TiqFeatureIcon name="reports" size="lg" variant="surface" />
        <div>
          <span>Carry this to matches</span>
          <strong>Prepare simply. Reset quickly. Check in before the lesson fades.</strong>
          <p>Use this one page on match day. The goal is not a long journal. The goal is one clear next action.</p>
        </div>
      </div>
      <div className={styles.matchCardGrid}>
        <section>
          <span>Before match</span>
          {preMatch.map(([label, text]) => (
            <div key={label}>
              <strong>{label}</strong>
              <p>{text}</p>
            </div>
          ))}
        </section>
        <section>
          <span>During match</span>
          {duringMatch.map(([label, text]) => (
            <div key={label}>
              <strong>{label}</strong>
              <p>{text}</p>
            </div>
          ))}
        </section>
        <section>
          <span>Post-match quick check-in</span>
          <p>Do this within five minutes. Use numbers first. Add one small note only if it changes the next practice.</p>
          <TrackerTable columns={['Check-in item', 'Rating / note']} rows={checkInRows} />
        </section>
      </div>
      <div className={styles.matchCardFooter}>
        <ReflectionLines label="My next practice should start with" rows={4} />
        <QrAction href="/mylab" label="Save check-in" mode="player-plus" />
      </div>
      <QuickCheckStrip labels={['Cue chosen', 'Plan used', 'Reset used', 'Check-in done']} />
      <div className={styles.matchPerformanceLink}>
        <span>Physical support for next match</span>
        <strong>Choose one: jump rope rhythm, cone recovery, wall sit durability, mobility reset, or shoulder + core support.</strong>
      </div>
      <HabitRewardStrip labels={['I used my plan', 'I reset before reacting', 'I know the next practice mission']} />
      <CodexAssistBox
        title="Build next practice"
        prompt="Based on my score, pressure rating, and next practice note, give me one 20-minute practice mission with one court tool and one Performance Upgrade."
      />
    </div>
  )
}

function PlayerSoloTraining({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const { solo } = getPlayerTrainingMenus(identity)

  return (
    <PlayerTrainingSheet
      intro="Use these when you have a court, basket, wall, or open space but no coach. Keep the reps simple and measurable."
      rows={solo}
      tableRows={['Serve basket', 'Wall or shadow work', 'Footwork lane', 'Pressure routine']}
    />
  )
}

function PlayerPartnerTraining({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const { partner } = getPlayerTrainingMenus(identity)

  return (
    <PlayerTrainingSheet
      intro="Use these with a friend. One player feeds or plays the constraint while the other tracks whether the habit shows up."
      rows={partner}
      tableRows={['Feed-and-recover drill', 'Rally constraint', 'Serve or return game', 'Pressure finish']}
    />
  )
}

function PlayerOffCourtTraining({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const { offCourt } = getPlayerTrainingMenus(identity)

  return (
    <PlayerTrainingSheet
      intro="Use these away from the court so the next practice starts with a clearer plan, calmer mind, and better match habit."
      rows={offCourt}
      tableRows={['Match note', 'Routine rehearsal', 'Opponent plan', 'Coach handoff']}
    />
  )
}

function PlayerPerformanceUpgrade({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const isRelentless = identity.slug.includes('relentless')
  const upgradeRows = [
    'Light feet before first ball',
    isRelentless ? 'Recovery after contact' : 'Forward-close balance',
    'Posture under fatigue',
    'Tension before/after play',
  ]
  const movementTools = isRelentless
    ? [
        {
          title: 'Jump rope rhythm',
          useWhen: 'Your feet feel flat or slow before the first ball.',
          cue: 'Light feet, quiet shoulders, ready breath.',
          routine: ['Jump rope 30 sec', 'Rest 20 sec', 'Split-step + first move x6'],
          reward: 'Check the rep when your feet feel ready before the ball.',
          track: 'Light feet 0-5.',
        },
        {
          title: 'Cone recover + shadow swing',
          useWhen: 'You hit and watch instead of recovering after contact.',
          cue: 'Hit, recover, then look.',
          routine: ['Set one home cone and two wide cones', 'Move, shadow swing, recover home', 'Do 3 rounds of 6 controlled reps'],
          reward: 'Check the rep when recovery happens before the imaginary result.',
          track: 'Recovery after contact 0-5.',
        },
      ]
    : [
        {
          title: 'Jump rope rhythm',
          useWhen: 'You need cleaner split-step timing before returns or first strikes.',
          cue: 'Light feet before the decision.',
          routine: ['Jump rope 30 sec', 'Rest 20 sec', 'Split-step + first move x6'],
          reward: 'Check the rep when the first move feels organized.',
          track: 'Light feet 0-5.',
        },
        {
          title: 'Cone close + recover',
          useWhen: 'You approach and stop instead of closing, splitting, and recovering.',
          cue: 'Close, split, choose.',
          routine: ['Set home, short-ball, and recovery cones', 'Move forward, shadow approach, close, split', 'Do 3 rounds of 5 balanced reps'],
          reward: 'Check the rep when you finish balanced.',
          track: 'Forward-close balance 0-5.',
        },
      ]

  return (
    <div className={styles.performanceUpgrade}>
      <div className={styles.performanceUpgradeHero}>
        <TiqFeatureIcon name="matchPrep" size="lg" variant="surface" />
        <div>
          <span>Performance Upgrade</span>
          <strong>Level up the engine that supports your game.</strong>
          <p>Pick one at-home performance tool that supports this week&apos;s tennis habit: cue, routine, reward, proof.</p>
        </div>
      </div>
      <div className={styles.performanceGrowthGrid}>
        <article>
          <span>Movement engine</span>
          <strong>Court-ready movement</strong>
          <p>Use jump rope, cone recovery, and shadow swings to make the first move and recovery after contact easier to repeat.</p>
        </article>
        <article>
          <span>Match-ready conditioning</span>
          <strong>Leg durability</strong>
          <p>Use wall sits, split squats, lateral lunges, and short 20/20 intervals so posture stays organized when points get long.</p>
        </article>
        <article>
          <span>Mobility</span>
          <strong>Move well before adding speed</strong>
          <p>Use hip, ankle, hamstring, glute, thoracic, and shoulder resets so the next session starts cleaner.</p>
        </article>
        <article>
          <span>Recovery</span>
          <strong>Calm the body after play</strong>
          <p>Use post-play stretching and breathing to notice tension before and after, then rate the change 0-5.</p>
        </article>
      </div>
      <div className={styles.movementEngine}>
        <span>Movement engine</span>
        <strong>Choose one tool. Keep it short enough to repeat.</strong>
        <div className={styles.movementEngineGrid}>
          {movementTools.map((tool) => <PlayerToolCard key={tool.title} {...tool} />)}
        </div>
      </div>
      <div className={styles.performancePlan}>
        <TrackerTable columns={['Tennis habit', 'Performance Upgrade', 'Routine', '0-5 proof']} rows={upgradeRows} />
        <QuickRatingStrip labels={['Body ready', 'Light feet', 'Leg durability', 'Recovery']} />
        <HabitRewardStrip
          labels={[
            'I supported the habit I want on court',
            'I moved with control',
            'I finished with proof',
          ]}
        />
      </div>
      <CodexAssistBox
        title="Choose my Performance Upgrade"
        prompt="Based on my current tennis habit, choose one Performance Upgrade from jump rope rhythm, cone recovery, shadow swings, wall sit durability, strength circuit, conditioning finisher, or mobility reset. Give me one cue, one routine, one reward, and one proof rating."
      />
      <div className={styles.performanceSafetyNote}>
        <span>Training guardrails</span>
        <strong>Control before intensity.</strong>
        <p>
          Move well before adding speed. Stop if pain changes your movement. Choose control before intensity. Jump rope should be light and quiet, not max effort. Cone drills should stay controlled before they get fast. Shadow swings should finish balanced. Wall sits should challenge the legs without changing posture or causing pain. For young players, strength work should be technique-first and supervised. The goal is better tennis habits, not max lifting.
        </p>
      </div>
    </div>
  )
}

function PlayerAtHomePerformanceTraining({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const { performance } = getPlayerTrainingMenus(identity)

  return (
    <PlayerTrainingSheet
      intro="Use these at home, on a driveway, in a garage, or beside the court so your movement supports the habit you are trying to show in matches. Pick one Performance Upgrade that matches this week's tennis goal."
      rows={performance}
      tableRows={['Dynamic warm-up', 'Jump rope rhythm', 'Cone recovery', 'Strength circuit', 'Wall sit durability', 'Conditioning finisher', 'Mobility reset']}
    >
      <CodexAssistBox
        title="Choose my at-home block"
        prompt="I want one at-home Performance Upgrade that connects to my tennis goal. Give me one cue, one routine, one reward, and one proof rating."
      />
    </PlayerTrainingSheet>
  )
}

function PlayerToolBeltMenu({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const toolRoutes = [
    ['Plan goal', 'Start with the weekly action plan and goal check-in.', 'Weekly action plan'],
    ['I need reps alone', 'Use solo work: serve basket, wall, shadow, recovery, or routine reps.', 'Solo training'],
    ['I have a partner', 'Use rally constraints, feed drills, serve/return games, or pressure sets.', 'Hitting partner'],
    ['I need doubles work', 'Use communication, first move, poach timing, and partner-position drills.', 'Doubles tools'],
    ['My feet feel heavy', 'Use jump rope rhythm or dynamic warm-up to build light feet.', 'Performance Upgrade'],
    ['I hit and watch', 'Use cone recovery and shadow swings to recover before watching.', 'Performance Upgrade'],
    ['My legs die late', 'Use wall sit durability or a conditioning finisher to keep posture organized.', 'Performance Upgrade'],
    ['I feel tight after play', 'Use the post-play mobility reset and rate tension before/after.', 'Performance Upgrade'],
    ['I am preparing for a match', 'Use the pre-match, during-match, and post-match quick check-in card.', 'Match card'],
    ['I need a plan note', 'Use routine rehearsal, opponent planning, coach handoff, and mental reset.', 'Off-court work'],
  ] as const

  return (
    <div className={styles.toolBeltMenu}>
      <div className={styles.toolBeltHero}>
        <TiqFeatureIcon name="scenarioBuilder" size="lg" variant="surface" />
        <div>
          <span>Use the right tool</span>
          <strong>Pick what you want to improve, then go straight to that page.</strong>
          <p>Do not read every section. Choose the smallest tool that helps your next practice, match, or coach assignment.</p>
        </div>
      </div>
      <div className={styles.toolBeltRouteGrid}>
        {toolRoutes.map(([need, action, page], index) => (
          <article key={need}>
            <span>{String(index + 1).padStart(2, '0')} {need}</span>
            <strong>{page}</strong>
            <p>{action}</p>
          </article>
        ))}
      </div>
      <div className={styles.workbookGrid}>
        {identity.sections.map((section) => (
          <article className={styles.workbookSection} key={section.title}>
            <TiqFeatureIcon name={section.icon} size="sm" variant="ghost" />
            <div>
              <h3>{section.title}</h3>
              <p>{section.cue}</p>
              <ul>
                {section.drills.map((drill) => <li key={drill}>{drill}</li>)}
              </ul>
            </div>
          </article>
        ))}
      </div>
      <TrackerTable columns={['I want to improve', 'Tool page', 'Self / partner / doubles', '0-5 after']} rows={identity.sections.slice(0, 5).map((section) => section.title)} />
    </div>
  )
}

function PlayerTrainingSheet({
  intro,
  rows,
  tableRows,
  children,
}: {
  intro: string
  rows: string[][]
  tableRows: string[]
  children?: React.ReactNode
}) {
  return (
    <div className={styles.playerTrainingSheet}>
      <div className={styles.playerTrainingIntro}>
        <span>Player instructions</span>
        <strong>Pick one, do it honestly, write down proof.</strong>
        <p>{intro}</p>
      </div>
      <div className={styles.playerTrainingGrid}>
        {rows.map(([title, text], index) => (
          <article key={title}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{title}</strong>
            <p>{text}</p>
          </article>
        ))}
      </div>
      {children}
      <TrackerTable columns={['Work block', 'Reps or score', '0-5 rating', 'Tiny note']} rows={tableRows} />
      <QuickRatingStrip labels={['Effort', 'Control', 'Decision', 'Pressure']} />
      <QuickCheckStrip labels={['Done', 'Hard', 'Showed in match', 'Bring to coach']} />
      <HabitRewardStrip labels={['I picked one useful block', 'I trained with control', 'I connected the work to match proof']} />
      <ReflectionLines label="Small note before the next session" rows={3} />
    </div>
  )
}

function QuickRatingStrip({ labels }: { labels: string[] }) {
  return (
    <div className={styles.quickRatingStrip}>
      {labels.map((label) => (
        <span key={label}>
          <strong>{label}</strong>
          <i>0</i><i>1</i><i>2</i><i>3</i><i>4</i><i>5</i>
        </span>
      ))}
    </div>
  )
}

function HabitRewardStrip({ labels }: { labels: string[] }) {
  return (
    <div className={styles.habitRewardStrip}>
      <strong>Reward the habit</strong>
      <div>
        {labels.map((label) => (
          <span key={label}><i /> {label}</span>
        ))}
      </div>
    </div>
  )
}

function CodexAssistBox({ title, prompt }: { title: string; prompt: string }) {
  return (
    <aside className={styles.codexAssistBox}>
      <span>Codex assist</span>
      <strong>{title}</strong>
      <p>{prompt}</p>
      <small>Use this to reduce the work to one clear cue, routine, reward, and proof.</small>
    </aside>
  )
}

function PlayerToolCard({
  title,
  useWhen,
  cue,
  routine,
  reward,
  track,
}: {
  title: string
  useWhen: string
  cue: string
  routine: string[]
  reward: string
  track: string
}) {
  return (
    <article className={styles.playerToolCard}>
      <span>Tool card</span>
      <h3>{title}</h3>
      <div>
        <strong>Use this when</strong>
        <p>{useWhen}</p>
      </div>
      <div>
        <strong>Cue</strong>
        <p>{cue}</p>
      </div>
      <div>
        <strong>Routine</strong>
        <ol>
          {routine.map((step) => <li key={step}>{step}</li>)}
        </ol>
      </div>
      <div>
        <strong>Reward</strong>
        <p>{reward}</p>
      </div>
      <div>
        <strong>Track</strong>
        <p>{track}</p>
      </div>
    </article>
  )
}

function QuickCheckStrip({ labels }: { labels: string[] }) {
  return (
    <div className={styles.quickCheckStrip}>
      {labels.map((label) => (
        <span key={label}><i /> {label}</span>
      ))}
    </div>
  )
}

function IdentityProfileBoard({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const groups = [
    ['Primary weapons', identity.identityProfile.primaryWeapons],
    ['Pressure habits', identity.identityProfile.pressureHabits],
    ['Style leaks', identity.identityProfile.styleLeaks],
  ] as const

  return (
    <div className={styles.identityProfileBoard}>
      {groups.map(([title, items]) => (
        <section key={title}>
          <span>{title}</span>
          <ul>
            {items.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
      ))}
      <div className={styles.identityCommitment}>
        <TiqFeatureIcon name="myLab" size="md" variant="surface" />
        <div>
          <span>Player commitment</span>
          <strong>My style is not a personality label. It is a repeatable match plan.</strong>
          <p>Circle the two weapons that already show up, underline the one leak that costs matches, then turn that leak into the next training goal.</p>
        </div>
      </div>
      <TrackerTable columns={['Style signal', 'Shows up now?', 'Match evidence', 'Training response']} rows={identity.traits} />
    </div>
  )
}

function IdentityTriggerSheet({ identity }: { identity: PlayerDevelopmentIdentity }) {
  return (
    <div className={styles.triggerSheet}>
      <div className={styles.triggerGrid}>
        {identity.identityProfile.matchTriggers.map((trigger, index) => (
          <article key={trigger}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{trigger}</strong>
            <p>What should this identity do first?</p>
          </article>
        ))}
      </div>
      <TrackerTable
        columns={['Match moment', 'Old reaction', 'Identity response', 'Evidence to keep']}
        rows={identity.identityProfile.matchTriggers}
      />
      <div className={styles.coachQuestionGrid}>
        {identity.identityProfile.coachQuestions.map((question) => (
          <article key={question}>
            <span>Ask after play</span>
            <p>{question}</p>
          </article>
        ))}
      </div>
      <ReflectionLines label="The match moment where my style disappeared" rows={4} />
      <ReflectionLines label="The simplest cue that brings it back" rows={4} />
    </div>
  )
}

function IdentitySelfAudit({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const rows = [
    ...identity.identityProfile.primaryWeapons.slice(0, 3),
    ...identity.identityProfile.pressureHabits.slice(0, 3),
    ...identity.identityProfile.styleLeaks.slice(0, 3),
  ]

  return (
    <div className={styles.selfAudit}>
      <div className={styles.auditInstruction}>
        <TiqFeatureIcon name="reports" size="md" variant="surface" />
        <div>
          <span>How to score</span>
          <strong>Rate what actually shows up in matches, not what feels good in warmups.</strong>
          <p>Circle one score per line. A score of 1 means it rarely appears under pressure. A score of 5 means opponents can feel it.</p>
        </div>
      </div>
      <TrackerTable columns={['Identity behavior', '1', '2', '3', '4', '5', 'Match proof']} rows={rows} />
      <div className={styles.auditDecisionGrid}>
        <article>
          <span>If the lowest score is a weapon</span>
          <p>Train reps first. You need more repeatable pattern volume before adding pressure.</p>
        </article>
        <article>
          <span>If the lowest score is a pressure habit</span>
          <p>Train score games. The skill exists, but the routine is not surviving stress yet.</p>
        </article>
        <article>
          <span>If the highest cost is a leak</span>
          <p>Train constraints. Remove the bad option and force the identity response.</p>
        </article>
      </div>
    </div>
  )
}

function getWorkbookEnhancements(identity: PlayerDevelopmentIdentity) {
  const isRelentless = identity.slug.includes('relentless')

  return {
    evidenceExamples: isRelentless
      ? [
          'Held second-serve routine on three pressure points.',
          'Recovered neutral after five wide-ball defensive reps.',
          'Attacked only when the ball created an offensive advantage for one full set.',
          'Won more late games because feet stayed active after contact.',
          'Created a playable +1 after called serve targets.',
        ]
      : [
          'Created short balls from crosscourt depth before changing line.',
          'Closed forward after approach contact instead of watching.',
          'Won points with placement before extra racquet speed.',
          'Used serve +1 patterns to create the first advantage.',
          'Reduced donated errors after opening the court.',
        ],
    identityNot: isRelentless
      ? [
          'It is not passive pushing or waiting for the opponent to miss.',
          'It is not running forever without a plan.',
          'It is not avoiding attack balls when the attack is earned.',
          'It is not serving safely without a target.',
          'It is not pretending fatigue does not affect decisions.',
        ]
      : [
          'It is not swinging harder at every neutral ball.',
          'It is not attacking before court position is earned.',
          'It is not approaching and stopping at contact.',
          'It is not chasing winners to escape long points.',
          'It is not ignoring defense because offense is the identity.',
        ],
    opponentAdjustments: [
      ['Retriever / pusher', isRelentless ? 'Stay patient, use depth, and attack only earned short balls.' : 'Build with height and depth before stepping in.'],
      ['Big hitter', isRelentless ? 'Absorb with height, recover early, and make them play one more ball.' : 'Take time away only after neutralizing the first strike.'],
      ['Net player', isRelentless ? 'Serve and return with target clarity; pass with margin before panic pace.' : 'Use body serves, low returns, and close behind the right ball.'],
      ['Lefty', 'Name the serve and return pattern before the first game so the spin does not create surprise decisions.'],
      ['Consistent baseliner', isRelentless ? 'Win the routine battle and track late-game legs.' : 'Earn the direction change through repeated crosscourt pressure.'],
    ],
    readinessGates: [
      ['Serve pressure', 'Can call a target and protect second serve under score pressure.'],
      ['Movement identity', 'Recovers after contact and stays active late in games.'],
      ['Decision quality', isRelentless ? 'Attacks the correct ball instead of forcing from neutral.' : 'Builds before changing direction or closing forward.'],
      ['Defense to neutral', 'Uses margin, height, and recovery instead of panic errors.'],
      ['Coach evidence', 'Can name the pattern, the proof, and the next assignment.'],
    ],
  }
}

function IdentityGuardrails({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const { identityNot } = getWorkbookEnhancements(identity)

  return (
    <div className={styles.guardrailBoard}>
      <div className={styles.guardrailHero}>
        <TiqFeatureIcon name="matchPrep" size="md" variant="surface" />
        <div>
          <span>Identity clarity</span>
          <strong>A useful style narrows decisions. It should not excuse bad habits.</strong>
          <p>Use this page when you start using the identity as a label instead of a match plan.</p>
        </div>
      </div>
      <div className={styles.guardrailGrid}>
        {identityNot.map((item, index) => (
          <article key={item}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <p>{item}</p>
          </article>
        ))}
      </div>
      <div className={styles.twoColumn}>
        <ReflectionLines label="The version of this style that costs me points" rows={4} />
        <ReflectionLines label="The cue that brings the style back" rows={4} />
      </div>
    </div>
  )
}

function MatchEvidenceLibrary({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const { evidenceExamples } = getWorkbookEnhancements(identity)

  return (
    <div className={styles.evidenceLibrary}>
      <div className={styles.evidenceExampleGrid}>
        {evidenceExamples.map((example) => (
          <article key={example}>
            <span>Counts as proof</span>
            <p>{example}</p>
          </article>
        ))}
      </div>
      <TrackerTable columns={['Evidence moment', 'Match score', 'What it proved', 'Next practice']} rows={identity.sections.slice(0, 5).map((section) => section.title)} />
      <ReflectionLines label="Best proof from my last match" rows={4} />
    </div>
  )
}

function NextFocusSelector({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const focusRows = identity.sections.map((section) => section.title)

  return (
    <div className={styles.focusSelector}>
      <div className={styles.focusSelectorGrid}>
        {identity.sections.map((section) => (
          <article key={section.id}>
            <TiqFeatureIcon name={section.icon} size="sm" variant="ghost" />
            <div>
              <span>{section.title}</span>
              <strong>{section.cue}</strong>
              <p>Choose this if the match evidence points to: {section.tracker.slice(0, 3).join(', ')}.</p>
            </div>
          </article>
        ))}
      </div>
      <TrackerTable
        columns={['Potential focus', 'Why it matters now', 'Practice evidence', 'Match proof', 'Choose?']}
        rows={focusRows}
      />
      <div className={styles.focusContract}>
        <div>
          <span>Two-week contract</span>
          <strong>One focus. One pressure test. One coach note.</strong>
          <p>Do not chase every weakness at once. Pick the focus that would change the next match fastest.</p>
        </div>
        <QrAction href={`/player-development/${identity.slug}/level-up`} label="Save focus" mode="player-plus" />
      </div>
    </div>
  )
}

function PracticeChooser({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const moduleBySection = identity.sections.map((section, index) => {
    const week = identity.weeks[index % identity.weeks.length]

    return {
      section,
      week,
      leak: section.tracker[0] ?? section.title,
    }
  })

  return (
    <div className={styles.practiceChooser}>
      <div className={styles.practiceChooserGrid}>
        {moduleBySection.map(({ leak, section, week }) => (
          <article key={section.id}>
            <TiqFeatureIcon name={section.icon} size="sm" variant="ghost" />
            <div>
              <span>If the leak is</span>
              <strong>{leak}</strong>
              <p>Start with Module {week.week}: {week.title}. Pressure test: {week.pressureGame}</p>
            </div>
          </article>
        ))}
      </div>
      <TrackerTable
        columns={['Leak from match', 'Module to train', 'Pressure test', 'Evidence before moving on']}
        rows={moduleBySection.map(({ section, week }) => `${section.title}: Module ${week.week}`)}
      />
      <div className={styles.practiceRule}>
        <span>Selection rule</span>
        <strong>Train the leak that changes the next match fastest.</strong>
        <p>Choose one leak, one module, and one pressure test. Save the rest for later so you do not scatter attention.</p>
      </div>
    </div>
  )
}

function CoachConversationSheet({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const asks = [
    'What do you see first: movement, serve, decision-making, conditioning, or doubles positioning?',
    'Which style leak costs me the most games?',
    'What should we test under score pressure today?',
    'What evidence would prove this is becoming match reliable?',
  ]

  return (
    <div className={styles.coachConversation}>
      <div className={styles.coachAskGrid}>
        {asks.map((ask) => (
          <article key={ask}>
            <span>Ask coach</span>
            <p>{ask}</p>
          </article>
        ))}
      </div>
      <TrackerTable
        columns={['Coach sees', 'You feel', 'Shared priority', 'Assignment']}
        rows={identity.sections.slice(0, 5).map((section) => section.title)}
      />
      <div className={styles.twoColumn}>
        <ReflectionLines label="Coach's highest-priority correction" rows={4} />
        <ReflectionLines label="What I will bring back as proof" rows={4} />
      </div>
      <div className={styles.coachConversationFooter}>
        <div>
          <span>{playerTier.name} handoff</span>
          <strong>Turn the conversation into a saved assignment.</strong>
          <p>The print backup can guide the lesson on paper. My Lab stores your status update; Coach Hub keeps the coach&apos;s plan and review.</p>
        </div>
        <QrAction href="/mylab#coach-assignments" label="Update status" mode="player-plus" />
      </div>
    </div>
  )
}

function OpponentAdjustmentSheet({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const { opponentAdjustments } = getWorkbookEnhancements(identity)

  return (
    <div className={styles.opponentSheet}>
      <TrackerTable columns={['Opponent style', 'Identity adjustment', 'First three games plan', 'Evidence']} rows={opponentAdjustments.map(([opponent]) => opponent)} />
      <div className={styles.opponentGrid}>
        {opponentAdjustments.map(([opponent, plan]) => (
          <article key={opponent}>
            <span>{opponent}</span>
            <p>{plan}</p>
          </article>
        ))}
      </div>
      <ReflectionLines label="Opponent style I struggle with most" rows={3} />
    </div>
  )
}

function MatchDayRoutine({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const routine = [
    ['Before match', 'Choose one identity cue, one serve pattern, and one pressure response.'],
    ['First three games', 'Collect information: opponent target, rally tolerance, serve return pattern.'],
    ['Pressure points', `Return to the mantra: ${identity.mantra}`],
    ['After match', 'Write one proof, one leak, and one next practice decision.'],
  ] as const

  return (
    <div className={styles.matchDayRoutine}>
      <div className={styles.routineGrid}>
        {routine.map(([moment, action]) => (
          <article key={moment}>
            <span>{moment}</span>
            <strong>{action}</strong>
          </article>
        ))}
      </div>
      <div className={styles.twoColumn}>
        <ReflectionLines label="Today my identity cue is" rows={4} />
        <ReflectionLines label="If I get tight, I will" rows={4} />
      </div>
      <TrackerTable columns={['Match phase', 'Cue used', 'Worked?', 'Next adjustment']} rows={routine.map(([moment]) => moment)} />
    </div>
  )
}

function PlayerReadinessGates({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const { readinessGates } = getWorkbookEnhancements(identity)

  return (
    <div className={styles.playerReadinessGates}>
      <div className={styles.readinessGateGrid}>
        {readinessGates.map(([gate, proof], index) => (
          <article key={gate}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{gate}</strong>
            <p>{proof}</p>
          </article>
        ))}
      </div>
      <TrackerTable columns={['Gate', 'Not yet', 'Showing up', 'Match reliable', 'Coach initials']} rows={readinessGates.map(([gate]) => gate)} />
      <ReflectionLines label={`What must be true before I claim ${identity.levelPath.to}`} rows={4} />
    </div>
  )
}

function WeeklyWorkbookPage({ identity, week }: { identity: PlayerDevelopmentIdentity; week: PlayerDevelopmentWeek }) {
  return (
    <>
      <WorkbookPage footer={`Module ${week.week} drill`}>
        <div id={`module-${week.week}`} />
        <PageHeader label={`Module ${week.week}`} title={week.title} />
        <div className={styles.weekPageGrid}>
          <div className={styles.weekPrimary}>
            <section className={styles.weekObjective}>
              <span>Objective</span>
              <p>{week.objective}</p>
            </section>
            <ModuleTestCard week={week} />
            <PracticePrescription week={week} />
            <WeekPlanTable week={week} />
          </div>
          <aside className={styles.weekAside}>
            <CourtDiagram diagram={week.diagram} title={`Module ${week.week} court cue`} />
            <DiagramReadout diagram={week.diagram} />
            <TiqPromptBlock
              href={`/player-development/${identity.slug}/level-up`}
              text={week.tiqPrompt}
              title="Level Up check-in"
            />
          </aside>
        </div>
      </WorkbookPage>
      <WorkbookPage footer={`Module ${week.week} evidence`}>
        <PageHeader label={`Module ${week.week} evidence`} title={`${week.title} proof sheet`} />
        <ModuleStandards week={week} />
        <div className={styles.moduleEvidenceGrid}>
          <ReflectionLines label="What I can repeat under pressure" rows={5} />
          <ReflectionLines label="What broke down or got rushed" rows={5} />
          <ReflectionLines label="Coach cue to carry forward" rows={5} />
          <ReflectionLines label={`${playerTier.name} evidence to save`} rows={5} />
        </div>
      </WorkbookPage>
    </>
  )
}

function PracticePrescription({ week }: { week: PlayerDevelopmentWeek }) {
  const prescription = [
    ['Warm up', '8 min', 'Shadow the movement pattern and name the cue before the ball.'],
    ['Skill block', '18 min', week.mainDrill],
    ['Pressure block', '16 min', week.pressureGame],
    ['Review', '8 min', week.accountability],
  ] as const

  return (
    <div className={styles.practicePrescription}>
      <div className={styles.prescriptionHead}>
        <span>Practice prescription</span>
        <strong>Make the module measurable before it becomes match work.</strong>
      </div>
      <div className={styles.prescriptionGrid}>
        {prescription.map(([label, time, text]) => (
          <article key={label}>
            <span>{time}</span>
            <strong>{label}</strong>
            <p>{text}</p>
          </article>
        ))}
      </div>
    </div>
  )
}

function ModuleTestCard({ week }: { week: PlayerDevelopmentWeek }) {
  const tests = [
    ['Pass', 'You can repeat the cue without coach rescue.'],
    ['Pressure', 'Same habit survives score, fatigue, or a missed ball.'],
    ['Proof', week.accountability],
  ] as const

  return (
    <div className={styles.moduleTestCard}>
      <div>
        <span>Module test</span>
        <strong>Run it clean, then run it under pressure.</strong>
      </div>
      <div className={styles.moduleTestGrid}>
        {tests.map(([label, text]) => (
          <article key={label}>
            <span>{label}</span>
            <p>{text}</p>
          </article>
        ))}
      </div>
    </div>
  )
}

function ModuleStandards({ week }: { week: PlayerDevelopmentWeek }) {
  const standards = [
    {
      label: 'Rep counts when',
      text: week.mainDrill,
    },
    {
      label: 'Pressure proof',
      text: week.pressureGame,
    },
    {
      label: 'Evidence to keep',
      text: week.accountability,
    },
  ]

  return (
    <div className={styles.moduleStandards}>
      {standards.map((standard) => (
        <article key={standard.label}>
          <span>{standard.label}</span>
          <p>{standard.text}</p>
        </article>
      ))}
    </div>
  )
}

function RubricScale() {
  const levels = [
    ['1', 'Not reliable yet'],
    ['2', 'Shows up in drills'],
    ['3', 'Holds up with pressure'],
    ['4', 'Transfers to sets'],
    ['5', 'Opponent feels it'],
  ] as const

  return (
    <div className={styles.rubricScale} aria-label="Evaluation scale">
      {levels.map(([score, label]) => (
        <div key={score}>
          <strong>{score}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  )
}

function EvidenceRubric() {
  const items = [
    ['Observed', 'A coach, teammate, or match note can point to it.'],
    ['Repeatable', 'It happened more than once, not only on a perfect feed.'],
    ['Pressurized', 'It held up when score, fatigue, or opponent quality rose.'],
    ['Actionable', 'It creates a clear next assignment.'],
  ] as const

  return (
    <div className={styles.evidenceRubric}>
      {items.map(([title, text]) => (
        <article key={title}>
          <span>{title}</span>
          <p>{text}</p>
        </article>
      ))}
    </div>
  )
}

function WeekPlanTable({ week }: { week: PlayerDevelopmentWeek }) {
  const rows = [
    ['Main drill', week.mainDrill],
    ['Pressure game', week.pressureGame],
    ['Accountability', week.accountability],
    ['Coach cue', week.coachCue],
  ] as const

  return (
    <div className={styles.weekPlanTableWrap}>
      <table className={styles.weekPlanTable}>
        <tbody>
          {rows.map(([label, text]) => (
            <tr key={label}>
              <th>{label}</th>
              <td>{text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TiqPromptBlock({ href = '/mylab', title, text }: { href?: string; title: string; text: string }) {
  return (
    <div className={styles.tiqPromptBlock}>
      <span>{title}</span>
      <p>{text}</p>
      <QrAction href={href} label={title} mode="player-plus" />
    </div>
  )
}

function QrAction({
  href,
  label,
  mode = 'open',
}: {
  href: string
  label: string
  mode?: 'open' | 'player-plus'
}) {
  const absoluteHref = toAbsoluteTiqUrl(href)
  const badge = mode === 'player-plus' ? `${playerTier.name} to save` : 'Open guide'

  return (
    <div className={styles.qrAction}>
      <QrCode href={absoluteHref} />
      <div>
        <span>{badge}</span>
        <strong>{label}</strong>
        <small>{absoluteHref.replace(/^https?:\/\//, '')}</small>
      </div>
    </div>
  )
}

function QrCode({ href }: { href: string }) {
  const qr = createQrCode(href, { errorCorrectionLevel: 'M' })
  const size = qr.modules.size
  const cells: React.ReactNode[] = []

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      if (qr.modules.get(row, column)) {
        cells.push(<rect height="1" key={`${row}-${column}`} width="1" x={column} y={row} />)
      }
    }
  }

  return (
    <svg className={styles.qrCode} role="img" aria-label={`QR code for ${href}`} viewBox={`0 0 ${size} ${size}`}>
      <rect fill="#ffffff" height={size} width={size} />
      <g fill="#071226">{cells}</g>
    </svg>
  )
}

function toAbsoluteTiqUrl(href: string) {
  return new URL(href, TIQ_SITE_URL).toString()
}

function PlayerPlusEvidenceLog({ identity, weeks = identity.weeks }: { identity: PlayerDevelopmentIdentity; weeks?: PlayerDevelopmentWeek[] }) {
  const actionCycle = [
    { href: '/mylab', label: 'My Lab goal', icon: 'myLab' as const },
    { href: `/player-development/${identity.slug}/level-up`, label: 'Level Up proof', icon: 'reports' as const },
    { href: '/mylab#coach-assignments', label: 'Assignment status', icon: 'messagingCenter' as const },
    { href: '/profile', label: 'Progress check', icon: 'playerRatings' as const },
  ]

  return (
    <div className={styles.evidenceLog}>
      {weeks.map((week, index) => {
        const action = actionCycle[index % actionCycle.length]
        return (
          <article key={week.week}>
            <div className={styles.evidenceIcon}>
              <TiqFeatureIcon name={action.icon} size="sm" variant="ghost" />
            </div>
            <div>
              <span>Module {week.week}</span>
              <strong>{week.title}</strong>
              <p>{week.accountability}</p>
            </div>
            <div className={styles.evidenceAction}>
              <span>TIQ action</span>
              <strong>{action.label}</strong>
              <QrAction href={action.href} label="Scan" mode="player-plus" />
            </div>
          </article>
        )
      })}
    </div>
  )
}

function PlayerPlusCheckIn({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const checkInRows = identity.phases.map((phase, index) => ({
    phase,
    prompt: identity.tiqPrompts[index % identity.tiqPrompts.length],
  }))

  return (
    <div className={styles.checkInBoard}>
      <div className={styles.checkInHero}>
        <TiqFeatureIcon name="reports" size="lg" variant="surface" />
        <div>
          <span>{playerTier.name} review loop</span>
          <strong>Evidence creates the next assignment.</strong>
          <p>
            Use this page after each phase to decide what you update in My Lab. When you are linked, your assignment recap
            syncs back to Coach Hub so the coach can plan the next session.
          </p>
        </div>
      </div>
      <div className={styles.checkInRows}>
        {checkInRows.map(({ phase, prompt }, index) => (
          <article key={phase.title}>
            <div className={styles.checkInNumber}>{String(index + 1).padStart(2, '0')}</div>
            <div>
              <span>{phase.weeks}</span>
              <strong>{phase.title}</strong>
              <p>{phase.proof}</p>
            </div>
            <div className={styles.checkInAction}>
              <span>TenAceIQ action</span>
              <strong>{prompt.title}</strong>
              <p>{prompt.cue}</p>
              <QrAction href={prompt.href} label="Open in TenAceIQ" mode="player-plus" />
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function PlayerPlusCompanionMap({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const dataAssistPlayerDevelopmentHref = '/data-assist?intent=upload-source&context=Player%20development'
  const rows = [
    ['Save my identity', 'Turn the style finder into a My Lab goal', '/mylab'],
    ['Save my two-week focus', 'Track the one focus that changes the next match fastest', `/player-development/${identity.slug}/level-up`],
    ['Build the tactic board', 'Turn the Level Up cue into a visual point plan in TIQ Tactical Studio', '/tactics'],
    ['Log match evidence', 'Keep proof from pressure points, serve targets, and style triggers', `/player-development/${identity.slug}/level-up`],
    ['Update coach assignment status', 'Mark the work complete in My Lab; linked coaches see the recap in Coach Hub', '/mylab#coach-assignments'],
    ['Check readiness', `Compare evidence against ${identity.levelPath.to} gates`, '/profile'],
    ['Notice missing context', DATA_ASSIST_STORY.shortCue, dataAssistPlayerDevelopmentHref],
  ] as const

  return (
    <div className={styles.companionMap}>
      {rows.map(([paperAction, playerAction, href]) => (
        <article key={paperAction}>
          <div>
            <span>Paper action</span>
            <strong>{paperAction}</strong>
          </div>
          <div>
            <span>{playerTier.name} action</span>
            <p>{playerAction}</p>
          </div>
          <QrAction href={href} label="Connect" mode="player-plus" />
        </article>
      ))}
    </div>
  )
}

function LevelUpScorecard({ identity }: { identity: PlayerDevelopmentIdentity }) {
  return (
    <div className={styles.levelUpScorecard}>
      {identity.metrics.map((metric, index) => (
        <article key={metric.skill}>
          <div className={styles.levelUpIndex}>{String(index + 1).padStart(2, '0')}</div>
          <div>
            <span>{metric.skill}</span>
            <strong>{metric.target}</strong>
            <dl>
              <div>
                <dt>Baseline</dt>
                <dd>{metric.baseline}</dd>
              </div>
              <div>
                <dt>Proof</dt>
                <dd>{metric.evidence}</dd>
              </div>
              <div>
                <dt>{playerTier.name} action</dt>
                <dd>{metric.playerPlusAction}</dd>
              </div>
            </dl>
          </div>
        </article>
      ))}
    </div>
  )
}

function CoachPlannerPreview({
  identity,
  active,
  printActive,
}: {
  identity: PlayerDevelopmentIdentity
  active: boolean
  printActive: boolean
}) {
  const moduleCount = identity.coachLessons.length
  const lessonSupportProof = [
    {
      label: 'Player identity',
      body: `${identity.title} and the module focus stay visible before the coach chooses drills.`,
    },
    {
      label: 'Readiness adapter',
      body: 'The plan changes from the player feel check instead of running a fixed script.',
    },
    {
      label: 'One-hour plan',
      body: 'Warm-up, skill block, pressure block, and competitive close fit one lesson.',
    },
    {
      label: 'Level Up handoff',
      body: 'The lesson ends with one card, one 0-5 proof standard, and one Coach Hub review cue.',
    },
  ] as const

  return (
    <section
      className={`${styles.printBook} ${active ? styles.focusSection : ''}`}
      aria-labelledby="coach-title"
      data-print-active={printActive ? 'true' : 'false'}
    >
      <WorkbookPage footer="Coach index">
        <PageHeader label="Coach index" title="How to run this planner" />
        <CoachPacketIndex identity={identity} />
      </WorkbookPage>

      <WorkbookPage footer="Coach progression">
        <PageHeader label="Coach planner" title={`${moduleCount}-module lesson progression`} id="coach-title" />
        <div className={styles.lessonGrid}>
          {identity.coachLessons.map((week) => (
            <article className={styles.lessonCard} key={week.week}>
              <span>Module {week.week}</span>
              <h3>{week.focus}</h3>
              <p>{week.objective}</p>
              <ul>
                {week.blocks.map((block) => <li key={block}>{block}</li>)}
              </ul>
              <strong>Homework</strong>
              <p>{week.homework}</p>
            </article>
          ))}
        </div>
      </WorkbookPage>

      <WorkbookPage footer="Readiness adapter">
        <PageHeader label="Coach guide" title="Adjust the lesson to how the player feels" />
        <CoachReadinessAdapter identity={identity} />
      </WorkbookPage>

      <WorkbookPage footer="Progression rules">
        <PageHeader label="Coach guide" title="Use the same progression language as the player" />
        <CoachProgressionRules identity={identity} />
      </WorkbookPage>

      <WorkbookPage footer="Lesson plans 1-4">
        <PageHeader label="Coach guide" title="One-hour lesson plans: Modules 1-4" />
        <CoachOneHourPlans identity={identity} lessons={identity.coachLessons.slice(0, 4)} />
      </WorkbookPage>

      <WorkbookPage footer="Lesson plans 5-8">
        <PageHeader label="Coach guide" title="One-hour lesson plans: Modules 5-8" />
        <CoachOneHourPlans identity={identity} lessons={identity.coachLessons.slice(4)} />
      </WorkbookPage>

      <WorkbookPage footer="One-hour lesson">
        <PageHeader label="One-hour lesson" title="Lesson plan template" />
        <div className={styles.lessonTemplate}>
          <TemplateBlock time="0:00-0:08" title="Readiness review" text="Review tracker, last match reflection, and one player-owned goal." />
          <TemplateBlock time="0:08-0:18" title="Movement primer" text="Split-step rhythm, recovery lanes, and balance after contact." />
          <TemplateBlock time="0:18-0:40" title="Main drill block" text="Theme drill with scoring, target cue, and pressure progression." />
          <TemplateBlock time="0:40-0:54" title="Competitive close" text="Live points with the module's identity constraint." />
          <TemplateBlock time="0:54-1:00" title="Homework handoff" text="Assign one measurable action and one TenAceIQ check-in." />
        </div>
        <div className={styles.coachLessonSupportProof} aria-label="Coach lesson support proof cue">
          <div>
            <span>Coach lesson support proof cue</span>
            <strong>Prove the lesson supports the player path.</strong>
          </div>
          <div className={styles.coachLessonSupportProofGrid}>
            {lessonSupportProof.map((item) => (
              <article key={item.label}>
                <span>{item.label}</span>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </div>
        <div className={styles.coachLevelUpHandoff}>
          <span>Level Up assignment handoff</span>
          <strong>End with one card, one proof standard, and one review cue.</strong>
          <p>
            Send the player into Level Up with a 0-5 proof rating, one tiny note, and the same focus you plan to review in Coach Hub.
          </p>
          <Link className="button-secondary" href={`/player-development/${identity.slug}/level-up`}>
            Open Level Up path
          </Link>
        </div>
        <CourtDiagram diagram="doubles-serve-pattern" title="Doubles pressure lanes" />
      </WorkbookPage>

      <WorkbookPage footer="Coach cue bank">
        <PageHeader label="Coach cue bank" title="What to say, what to watch, when to progress" />
        <CoachCueBank identity={identity} />
      </WorkbookPage>

      <WorkbookPage footer="Readiness gates">
        <PageHeader label="Readiness gates" title="Repeat, progress, or transfer" />
        <ReadinessGates identity={identity} />
      </WorkbookPage>

      <WorkbookPage footer="Evaluation">
        <PageHeader label="Evaluation" title="Skill evaluation tracking" />
        <RubricScale />
        <LevelUpScorecard identity={identity} />
        <TrackerTable columns={['Skill', 'Baseline', 'Midpoint', 'Final', 'Coach cue']} rows={identity.metrics.map((metric) => metric.skill)} />
      </WorkbookPage>

      <WorkbookPage footer="Coach review">
        <PageHeader label="Coach review" title={`${playerTier.name} evidence review`} />
        <CoachEvidenceReview identity={identity} />
        <div className={styles.twoColumn}>
          <ReflectionLines label="Next private lesson priority" rows={4} />
          <ReflectionLines label="Next Level Up assignment" rows={4} />
        </div>
      </WorkbookPage>
    </section>
  )
}

function CoachPacketIndex({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const steps = [
    ['Progression', `Use the ${identity.coachLessons.length}-module progression as the lesson arc.`],
    ['One-hour template', 'Keep the lesson rhythm consistent: review, prime, drill, compete, assign.'],
    ['Cue bank', 'Use the exact module cue, watch point, and assignment before improvising.'],
    ['Readiness gates', 'Decide whether to repeat, progress, or transfer the skill.'],
    ['Evidence review', 'Make the next assignment from what the player actually proved.'],
  ] as const

  return (
    <div className={styles.packetIndex}>
      <div className={styles.packetIndexHero}>
        <TiqFeatureIcon name="schedule" size="lg" variant="surface" />
        <div>
          <span>Coach workflow</span>
          <strong>Coach the evidence, not the page count.</strong>
          <p>Use this planner to turn each player path module into one private lesson, one pressure test, and one measurable assignment.</p>
        </div>
      </div>
      <div className={styles.packetIndexGrid}>
        {steps.map(([title, text], index) => (
          <article key={title}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{title}</strong>
            <p>{text}</p>
          </article>
        ))}
      </div>
      <TrackerTable columns={['Coach decision', 'Repeat if', 'Progress if', 'Transfer if']} rows={identity.metrics.map((metric) => metric.skill)} />
    </div>
  )
}

function CoachReadinessAdapter({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const feelingRows = [
    ['Confident', 'Keep the main drill hard and make the pressure test honest.', 'Raise the scoring standard. Ask for specific proof.'],
    ['Tight', 'Simplify to routine, breath, target, and first clean decision.', 'Shorten instruction. Repeat the first successful pattern.'],
    ['Tired', 'Train shape, recovery, and decision quality without chasing speed.', 'Use shorter bursts and more reset language.'],
    ['Confused', 'Pick one cue and one visible outcome. Remove extra corrections.', 'Ask the player to explain the rep before adding volume.'],
  ] as const
  const moduleRows = identity.weeks.slice(0, 4).map((week) => `Module ${week.week}: ${week.title}`)

  return (
    <div className={styles.coachReadinessAdapter}>
      <div className={styles.coachReadinessHero}>
        <TiqFeatureIcon name="schedule" size="lg" variant="surface" />
        <div>
          <span>Use the player check-in first</span>
          <strong>The same lesson should feel different when the player is tight, tired, confident, or confused.</strong>
          <p>Start from the player path: goal, work, proof, next step. Then choose the lesson tone that fits today.</p>
        </div>
      </div>
      <div className={styles.coachFeelingGrid}>
        {feelingRows.map(([feeling, lessonMove, coachMove]) => (
          <article key={feeling}>
            <span>{feeling}</span>
            <strong>{lessonMove}</strong>
            <p>{coachMove}</p>
          </article>
        ))}
      </div>
      <TrackerTable columns={['Player says', 'Coach adjusts', 'Still test this', 'Assignment']} rows={['I feel ready', 'I feel tight', 'I feel tired', 'I feel unsure']} />
      <div className={styles.twoColumn}>
        <TrackerTable columns={['Module option', 'Use today?']} rows={moduleRows} />
        <ReflectionLines label="Today I will simplify the lesson by" rows={5} />
      </div>
    </div>
  )
}

function CoachProgressionRules({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const coachRules = [
    ['Repeat', 'The player cannot name the cue or loses the habit without reminders.', 'Lower the feed, shorten the rep, and protect one clear success.'],
    ['Progress', 'The player owns the cue and repeats the habit in a clean drill.', 'Add score, a recovery demand, or a tougher ball.'],
    ['Pressure', 'The habit works in drill reps but breaks when the point matters.', 'Keep the same focus and make the pressure test more specific.'],
    ['Transfer', 'The player brings match proof and can explain the moment.', 'Connect the habit to the next pattern, opponent, or match plan.'],
  ] as const
  const rows = identity.weeks.slice(0, 4).map((week) => `Module ${week.week}: ${week.title}`)

  return (
    <div className={styles.coachProgressionRules}>
      <div className={styles.progressionHero}>
        <TiqFeatureIcon name="schedule" size="lg" variant="surface" />
        <div>
          <span>Coach-player alignment</span>
          <strong>The player path and lesson plan should agree on the next move.</strong>
          <p>Use the player progression card before you choose volume, pressure, or a new module. Easy alignment beats extra instruction.</p>
        </div>
      </div>
      <div className={styles.progressionRuleGrid}>
        {coachRules.map(([decision, evidence, action]) => (
          <article key={decision}>
            <span>{decision}</span>
            <strong>{evidence}</strong>
            <p>{action}</p>
          </article>
        ))}
      </div>
      <TrackerTable
        columns={['Player evidence', 'Coach decision', 'Lesson adjustment', 'Homework']}
        rows={rows}
      />
      <div className={styles.progressionCoachLinks}>
        <article>
          <span>If the player feels tight</span>
          <strong>Stay at the same stage and simplify the cue.</strong>
          <p>Do not progress just because the page is next. Make the current action playable.</p>
        </article>
        <article>
          <span>If the player feels ready</span>
          <strong>Use score before you add another technical idea.</strong>
          <p>The next test should prove the habit survives pressure, not just that the player understands it.</p>
        </article>
        <article>
          <span>Performance Upgrade</span>
          <strong>Add one physical support tool only when it supports the court habit.</strong>
          <p>Examples: cone recovery for hit-and-watch, wall sit durability for late-match posture, jump rope rhythm for flat feet, mobility reset for tightness after play.</p>
        </article>
      </div>
    </div>
  )
}

function CoachOneHourPlans({
  identity,
  lessons,
}: {
  identity: PlayerDevelopmentIdentity
  lessons: CoachLessonPlan[]
}) {
  return (
    <div className={styles.coachHourPlans}>
      {lessons.map((lesson) => {
        const week = identity.weeks.find((candidate) => candidate.week === lesson.week)
        const blocks = [
          ['0-8', 'Check in', 'Ask for the player goal, last proof, and one place the habit broke down.'],
          ['8-18', 'Prime', week?.objective ?? lesson.objective],
          ['18-38', 'Main drill', week?.mainDrill ?? lesson.blocks[0] ?? lesson.focus],
          ['38-52', 'Pressure test', week?.pressureGame ?? 'Make the drill survive score pressure.'],
          ['52-60', 'Assignment', week?.accountability ?? lesson.homework],
        ] as const

        return (
          <article key={lesson.week}>
            <div className={styles.coachPlanHeader}>
              <span>Module {lesson.week}</span>
              <strong>{lesson.focus}</strong>
              <p>{lesson.objective}</p>
            </div>
            <div className={styles.coachPlanBlocks}>
              {blocks.map(([time, title, text]) => (
                <section key={`${lesson.week}-${time}`}>
                  <span>{time}</span>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </section>
              ))}
            </div>
            <div className={styles.coachPlanFooter}>
              <span>Coach cue</span>
              <p>{week?.coachCue ?? 'Keep the assignment measurable and tied to player evidence.'}</p>
            </div>
          </article>
        )
      })}
    </div>
  )
}

function CoachCueBank({ identity }: { identity: PlayerDevelopmentIdentity }) {
  return (
    <div className={styles.cueBank}>
      {identity.weeks.map((week) => (
        <article key={week.week}>
          <span>Module {week.week}</span>
          <strong>{week.title}</strong>
          <dl>
            <div>
              <dt>Say</dt>
              <dd>{week.coachCue}</dd>
            </div>
            <div>
              <dt>Watch</dt>
              <dd>{PLAYER_DEVELOPMENT_DIAGRAMS[week.diagram].read}</dd>
            </div>
            <div>
              <dt>Assign</dt>
              <dd>{week.accountability}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  )
}

function ReadinessGates({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const gates = identity.metrics.map((metric) => ({
    repeat: metric.baseline,
    progress: metric.target,
    transfer: metric.evidence,
    skill: metric.skill,
  }))

  return (
    <div className={styles.readinessGates}>
      {gates.map((gate) => (
        <article key={gate.skill}>
          <h3>{gate.skill}</h3>
          <div>
            <span>Repeat</span>
            <p>{gate.repeat}</p>
          </div>
          <div>
            <span>Progress</span>
            <p>{gate.progress}</p>
          </div>
          <div>
            <span>Transfer</span>
            <p>{gate.transfer}</p>
          </div>
        </article>
      ))}
    </div>
  )
}

function CoachEvidenceReview({ identity }: { identity: PlayerDevelopmentIdentity }) {
  return (
    <div className={styles.coachReviewGrid}>
      {identity.phases.map((phase, index) => (
        <article key={phase.title}>
          <TiqFeatureIcon name={index === 0 ? 'myLab' : index === 1 ? 'reports' : 'schedule'} size="sm" variant="ghost" />
          <span>{phase.weeks}</span>
          <h3>{phase.title}</h3>
          <p>{phase.focus}</p>
          <div className={styles.reviewChecklist}>
            <label><i /> Player evidence is specific</label>
            <label><i /> Coach cue matches the match problem</label>
            <label><i /> Next assignment is measurable</label>
          </div>
        </article>
      ))}
    </div>
  )
}

function ReusableWorkbookSheets({ identity }: { identity: PlayerDevelopmentIdentity }) {
  return (
    <>
      <WorkbookPage footer="Player check-in">
        <PageHeader label="Reusable sheet" title="Player quick check-in" />
        <div className={styles.sheetLayout}>
          <TrackerTable columns={['Habit', '0-5 now', 'Tool to use next', 'Tiny note']} rows={identity.sections.slice(0, 5).map((section) => section.title)} />
          <QuickRatingStrip labels={['Plan', 'Effort', 'Execution', 'Pressure']} />
          <ReflectionLines label="Small note if needed" rows={4} />
        </div>
      </WorkbookPage>

      <WorkbookPage footer="Match reflection">
        <PageHeader label="Reusable sheet" title="Match reflection" />
        <MatchReflectionMatrix identity={identity} />
        <div className={styles.threeColumn}>
          <ReflectionLines label="Score and opponent" rows={4} />
          <ReflectionLines label="What held up under pressure" rows={4} />
          <ReflectionLines label="What changed after game three" rows={4} />
        </div>
        <ReflectionLines label="The next practice should focus on" rows={5} />
      </WorkbookPage>

      <WorkbookPage footer="Serve target chart">
        <PageHeader label="Reusable sheet" title="Serve target chart" />
        <div className={styles.serveSheetGrid}>
          <div className={styles.serveSheetVisuals}>
            <CourtDiagram diagram="serve-target-ladder" title="Serve target map" />
            <ServeTargetLegend />
          </div>
          <ServeTargetMatrix />
        </div>
        <ReflectionLines label="Serve routine cue" rows={3} />
      </WorkbookPage>

      <WorkbookPage footer="Doubles tracker">
        <PageHeader label="Reusable sheet" title="Doubles development tracker" />
        <DoublesDevelopmentTracker />
        <div className={styles.twoColumn}>
          <ReflectionLines label="Partner cue that helped most" rows={4} />
          <ReflectionLines label="Middle ball or poach pattern to repeat" rows={4} />
        </div>
      </WorkbookPage>

      <WorkbookPage footer="Coach assignment">
        <PageHeader label="Reusable sheet" title="Assignment sheet" />
        <AssignmentContract identity={identity} />
        <div className={styles.assignmentGrid}>
          <ReflectionLines label="Coach assignment" rows={5} />
          <ReflectionLines label="Your evidence to bring back" rows={5} />
        </div>
        <TrackerTable columns={['Day', 'Work completed', 'Confidence', 'Note']} rows={['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Match day']} />
      </WorkbookPage>

      <WorkbookPage footer={`${playerTier.name} review`}>
        <PageHeader label="Reusable sheet" title={`${playerTier.name} review sheet`} />
        <PlayerPlusCheckIn identity={identity} />
      </WorkbookPage>
    </>
  )
}

function MatchReflectionMatrix({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const rows = [
    'First four games',
    '30-30 / deuce points',
    'Return games',
    'Serving under pressure',
    'Final two games',
  ]

  return (
    <div className={styles.matchMatrix}>
      <div className={styles.matchScoreStrip}>
        <span>{identity.title.replace(/^The /, '')}</span>
        <strong>Match evidence, not memory</strong>
        <p>Use this immediately after play. Circle the moments that explain what should be trained next.</p>
      </div>
      <TrackerTable columns={['Match moment', 'What happened', 'TIQ habit', 'Next adjustment']} rows={rows} />
    </div>
  )
}

function ServeTargetMatrix() {
  const rows = [
    'Deuce wide',
    'Deuce body',
    'Deuce T',
    'Ad wide',
    'Ad body',
    'Ad T',
    'Second serve body',
    'Pressure serve call',
  ]

  return (
    <div className={styles.serveTargetMatrix}>
      <TrackerTable columns={['Target', 'Made', 'Missed', 'Created +1?', 'Pressure note']} rows={rows} />
      <div className={styles.serveRules}>
        <strong>Charting rule</strong>
        <p>Made means the serve landed in and started the intended pattern. Created +1 means the next ball was neutral or better.</p>
      </div>
    </div>
  )
}

function ServeTargetLegend() {
  const targets = [
    ['Wide', 'Pull the returner toward the sideline and create court space for the next ball.'],
    ['Body', 'Jam the returner lane and force a late contact or shorter reply.'],
    ['T', 'Land near the center service line to reduce angle and set up the first ball.'],
  ] as const

  return (
    <div className={styles.serveTargetLegend}>
      {targets.map(([target, cue]) => (
        <article key={target}>
          <span>{target.charAt(0)}</span>
          <div>
            <strong>{target}</strong>
            <p>{cue}</p>
          </div>
        </article>
      ))}
    </div>
  )
}

function DoublesDevelopmentTracker() {
  return (
    <div className={styles.doublesTracker}>
      <CourtDiagram diagram="doubles-serve-pattern" title="Doubles pattern map" />
      <TrackerTable
        columns={['Pattern', 'Call before point', 'First move', 'Middle owned?', 'Result']}
        rows={['Serve wide + partner shade', 'Serve T + middle close', 'Return cross + recover', 'Lob read + switch', 'Poach/fake call']}
      />
    </div>
  )
}

function AssignmentContract({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const rows = identity.sections.slice(0, 5).map((section) => section.title)

  return (
    <div className={styles.assignmentContract}>
      <TrackerTable columns={['Skill', 'Exact work', 'Scoring standard', 'Evidence due', `${playerTier.name} update`]} rows={rows} />
      <div className={styles.assignmentNote}>
        <TiqFeatureIcon name="myLab" size="sm" variant="ghost" />
        <p>Make the assignment measurable enough that the next coach conversation starts with evidence, not a guess.</p>
      </div>
    </div>
  )
}

function ConnectedCompanion({ identity }: { identity: PlayerDevelopmentIdentity }) {
  return (
    <section className={styles.integrationPanel} aria-labelledby="integration-title">
      <div>
        <p className={styles.kicker}>Connected companion</p>
        <h2 id="integration-title">Where the work gets saved</h2>
        <p>
          QR codes and links route players to My Lab goals, matchup prep, progress check-ins,
          Coach Hub assignments, and {DATA_ASSIST_STORY.shortCue}
        </p>
      </div>
      <div className={styles.integrationSteps}>
        {identity.tiqPrompts.map((prompt) => (
          <Link href={prompt.href} key={prompt.title}>
            <strong>{prompt.title}</strong>
            <span>{prompt.cue}</span>
            <small>{playerTier.upgradeCue}</small>
          </Link>
        ))}
      </div>
    </section>
  )
}

function WorkbookPage({
  children,
  className = '',
  core = false,
  footer,
}: {
  children: React.ReactNode
  className?: string
  core?: boolean
  footer?: string
}) {
  return (
    <article className={`${styles.workbookPage} ${className}`} data-core-page={core ? 'true' : undefined}>
      <header className={styles.paperBrandBar}>
        <BrandWordmark compact />
        <span>Player Development System</span>
      </header>
      <div className={styles.workbookPageBody}>{children}</div>
      <footer className={styles.pageFooter}>
        <span>{footer || 'TenAceIQ Player Development'}</span>
        <span>TenAceIQ</span>
      </footer>
    </article>
  )
}

function PageHeader({ label, title, id }: { label: string; title: string; id?: string }) {
  return (
    <header className={styles.pageHeader}>
      <span>{label}</span>
      <h2 id={id}>{title}</h2>
    </header>
  )
}

function ReflectionLines({ label, rows }: { label: string; rows: number }) {
  return (
    <div className={styles.reflectionLines}>
      <strong>{label}</strong>
      {Array.from({ length: rows }, (_, index) => (
        <span key={`${label}-${index}`} />
      ))}
    </div>
  )
}

function TrackerTable({ columns, rows }: { columns: string[]; rows: string[] }) {
  return (
    <div className={styles.trackerWrap}>
      <table className={styles.trackerTable}>
        <thead>
          <tr>
            {columns.map((column) => <th key={column}>{column}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row}>
              {columns.map((column, index) => <td key={`${row}-${column}`}>{index === 0 ? row : ''}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TemplateBlock({ time, title, text }: { time: string; title: string; text: string }) {
  return (
    <article>
      <span>{time}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  )
}

function CourtDiagram({ diagram, title }: { diagram: PlayerDevelopmentDiagram; title: string }) {
  const meta = PLAYER_DEVELOPMENT_DIAGRAMS[diagram]
  const tacticalOverlay = getTacticalOverlay(diagram)
  const overlay = getWorkbookCourtOverlay(tacticalOverlay)
  const diagramStats = getDiagramStats(tacticalOverlay)

  return (
    <figure className={styles.courtFigure}>
      <figcaption>
        <div>
          <span>{title}</span>
          <small>{meta.title}</small>
        </div>
        <dl className={styles.courtFigureStats} aria-label={`${meta.title} board contents`}>
          {diagramStats.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </figcaption>
      <TiqCourt alt={title} className={styles.tiqCourtFrame} overlay={overlay} showLabels />
    </figure>
  )
}

function getWorkbookCourtOverlay(overlay: DrillOverlay): DrillOverlay {
  const players = overlay.players?.map((player, index) => ({
    ...player,
    label: player.label || `P${index + 1}`,
    size: player.size ?? 1.1,
  }))

  return {
    ...overlay,
    players,
  }
}

function getDiagramStats(overlay: DrillOverlay) {
  const counts = [
    ['Players', overlay.players?.length ?? 0],
    ['Routes', overlay.arrows?.length ?? 0],
    ['Targets', (overlay.zones?.length ?? 0) + (overlay.markers?.length ?? 0)],
  ] as const

  return counts.map(([label, value]) => [label, value.toString()] as const)
}

function DiagramReadout({ diagram }: { diagram: PlayerDevelopmentDiagram }) {
  const meta = PLAYER_DEVELOPMENT_DIAGRAMS[diagram]

  return (
    <div className={styles.diagramReadout}>
      <span>Court read</span>
      <strong>{meta.title}</strong>
      <p>{meta.intent}</p>
      <dl>
        <div>
          <dt>What it shows</dt>
          <dd>{meta.setup}</dd>
        </div>
        <div>
          <dt>What to watch</dt>
          <dd>{meta.read}</dd>
        </div>
      </dl>
    </div>
  )
}

function getTacticalOverlay(diagram: PlayerDevelopmentDiagram): DrillOverlay {
  const {
    attackBall,
    deuceServeBody,
    deuceServeT,
    deuceServeWide,
    netPlayer,
    returnDepthMiddle,
    returnerDeuce,
    serverDeuce,
    serverRecovery,
  } = courtSpots
  const servePlayers = [
    { id: 'server', handedness: 'righty' as const, label: 'S', pose: 'serve' as const, team: 'home' as const, ...serverDeuce },
    { id: 'receiver', handedness: 'righty' as const, label: 'R', pose: 'ready' as const, team: 'away' as const, ...returnerDeuce },
  ]

  const overlays: Partial<Record<PlayerDevelopmentDiagram, DrillOverlay>> = {
    'movement-screen': {
      players: [{ id: 'ready', label: 'Ready', team: 'A', pose: 'ready', x: 50, y: 76 }],
      arrows: [
        { id: 'split-left', from: { x: 50, y: 76 }, to: { x: 37, y: 69 }, type: 'movement' },
        { id: 'recover', from: { x: 37, y: 69 }, to: { x: 50, y: 76 }, type: 'recovery' },
        { id: 'split-right', from: { x: 50, y: 76 }, to: { x: 63, y: 69 }, type: 'movement' },
      ],
      zones: [{ id: 'recover', marker: 'target', x: 44, y: 70, width: 12, height: 10 }],
    },
    'wide-ball-reset': {
      players: [{ id: 'defender', label: 'D', team: 'A', pose: 'forehand', x: 27, y: 70 }],
      arrows: [
        { id: 'reset-ball', from: { x: 27, y: 70 }, to: { x: 58, y: 31 }, type: 'ball' },
        { id: 'recover', from: { x: 27, y: 70 }, to: { x: 48, y: 76 }, type: 'recovery' },
      ],
      zones: [{ id: 'safe', marker: 'target', x: 51, y: 26, width: 17, height: 10 }],
    },
    'serve-target-ladder': {
      players: servePlayers,
      arrows: [
        { curved: true, id: 'wide', from: serverDeuce, to: deuceServeWide, type: 'ball' },
        { curved: true, id: 'body', from: serverDeuce, to: deuceServeBody, type: 'ball' },
        { curved: true, id: 't', from: serverDeuce, to: deuceServeT, type: 'ball' },
      ],
      zones: [{ ...courtZones.deuceServiceTargets, id: 'box' }],
      markers: [
        { id: 'wide-ball', type: 'ball', ...deuceServeWide },
        { id: 'body-ball', type: 'ball', ...deuceServeBody },
        { id: 't-ball', type: 'ball', ...deuceServeT },
      ],
      labels: [
        { id: 'w', text: 'W', ...deuceServeWide },
        { id: 'b', text: 'B', ...deuceServeBody },
        { id: 't', text: 'T', ...deuceServeT },
      ],
    },
    'second-serve-plus-one': {
      players: [...servePlayers, { id: 'plus-one', label: '+1', team: 'A', pose: 'forehand', x: 50, y: 75 }],
      arrows: [
        { curved: true, id: 'body', from: serverDeuce, to: deuceServeBody, type: 'ball' },
        { curved: true, id: 'plus', from: attackBall, to: { x: 31, y: 57 }, type: 'ball' },
      ],
      zones: [{ ...courtZones.deuceBodyWindow, id: 'body-zone' }],
      markers: [{ id: 'attack-ball', label: '+1', type: 'ball', ...attackBall }],
    },
    'ball-call-rally': {
      players: [
        { id: 'start', label: 'Call', team: 'A', pose: 'ready', x: 50, y: 76 },
        { id: 'close', label: 'Close', team: 'A', pose: 'volley', x: 50, y: 55 },
      ],
      arrows: [
        { id: 'build', from: { x: 33, y: 67 }, to: { x: 50, y: 54 }, type: 'ball' },
        { id: 'attack', from: { x: 50, y: 54 }, to: { x: 68, y: 30 }, type: 'ball' },
        { id: 'close', from: { x: 50, y: 76 }, to: { x: 50, y: 55 }, type: 'movement' },
      ],
      zones: [
        { id: 'defense', marker: 'cone', x: 28, y: 61, width: 14, height: 10 },
        { id: 'neutral', marker: 'target', x: 44, y: 48, width: 12, height: 9 },
        { id: 'offense', marker: 'target', x: 62, y: 25, width: 13, height: 9 },
      ],
    },
    'short-ball-approach': {
      players: [
        { id: 'approach', label: 'Approach', pose: 'forehand', team: 'home', x: 50, y: 73 },
        { id: 'split', label: 'Split', pose: 'ready', team: 'home', x: 50, y: 56 },
      ],
      arrows: [
        { id: 'move-forward', from: { x: 50, y: 73 }, to: { x: 50, y: 56 }, type: 'movement' },
        { curved: true, id: 'deep-approach', from: { x: 50, y: 56 }, to: { x: 32, y: 29 }, type: 'ball' },
      ],
      zones: [
        { id: 'approach-target', marker: 'target', tone: 'green', x: 27, y: 23, width: 18, height: 12 },
        { id: 'split-zone', marker: 'target', tone: 'white', x: 44, y: 51, width: 12, height: 10 },
      ],
    },
    'defensive-neutralizer': {
      players: [
        { id: 'defend', label: 'Defend', pose: 'forehand', team: 'home', x: 25, y: 70 },
        { id: 'reset', label: 'Reset', pose: 'ready', team: 'home', x: 48, y: 76 },
      ],
      arrows: [
        { curved: true, id: 'high-reset', from: { x: 25, y: 70 }, to: { x: 61, y: 27 }, type: 'ball' },
        { id: 'recover', from: { x: 25, y: 70 }, to: { x: 48, y: 76 }, type: 'recovery' },
      ],
      zones: [
        { id: 'safe-margin', marker: 'target', tone: 'green', x: 53, y: 22, width: 20, height: 12 },
        { id: 'danger-wide', marker: 'cone', tone: 'blue', x: 20, y: 65, width: 12, height: 12 },
      ],
    },
    'fatigue-pattern': {
      players: [
        { id: 'ball-one', label: '1', pose: 'forehand', team: 'home', x: 36, y: 70 },
        { id: 'ball-three', label: '3', pose: 'ready', team: 'home', x: 50, y: 76 },
      ],
      arrows: [
        { curved: true, id: 'one-two', from: { x: 36, y: 70 }, to: { x: 50, y: 42 }, type: 'ball' },
        { curved: true, id: 'two-three', from: { x: 50, y: 42 }, to: { x: 65, y: 68 }, type: 'ball' },
        { id: 'reset', from: { x: 65, y: 68 }, to: { x: 50, y: 76 }, type: 'recovery' },
      ],
      markers: [
        { id: 'ball-two', label: '2', type: 'ball', x: 50, y: 42 },
        { id: 'ball-three-marker', label: '3', type: 'ball', x: 65, y: 68 },
      ],
      zones: [{ id: 'breath-reset', marker: 'target', tone: 'white', x: 44, y: 72, width: 12, height: 9 }],
    },
    'poach-timing': {
      players: [
        { id: 'server', handedness: 'righty', label: 'S', pose: 'serve', team: 'home', ...serverDeuce },
        { id: 'partner', label: 'P', pose: 'volley', team: 'home', ...netPlayer },
        { id: 'returner', label: 'R', pose: 'ready', team: 'away', ...returnerDeuce },
      ],
      arrows: [
        { curved: true, id: 'serve-body', from: serverDeuce, to: deuceServeBody, type: 'ball' },
        { id: 'poach', from: netPlayer, to: { x: 47, y: 48 }, type: 'movement' },
      ],
      zones: [{ id: 'poach-lane', marker: 'target', tone: 'green', x: 40, y: 43, width: 16, height: 14 }],
    },
    'doubles-serve-pattern': {
      players: [
        { id: 'server', handedness: 'righty', label: 'S', pose: 'serve', team: 'home', ...serverDeuce },
        { id: 'partner', handedness: 'righty', label: 'P', pose: 'volley', team: 'home', ...netPlayer },
      ],
      arrows: [
        { curved: true, id: 'serve-wide', from: serverDeuce, to: deuceServeWide, type: 'ball' },
        { id: 'partner-close', from: netPlayer, to: { x: 45, y: 51 }, type: 'movement' },
      ],
      zones: [{ id: 'middle', marker: 'target', x: 38, y: 46, width: 18, height: 16 }],
    },
    'attack-audit': {
      players: [{ id: 'decision', label: 'Decide', pose: 'ready', team: 'home', x: 50, y: 76 }],
      arrows: [
        { curved: true, id: 'build', from: { x: 50, y: 76 }, to: { x: 38, y: 56 }, type: 'ball' },
        { curved: true, id: 'attack', from: { x: 50, y: 76 }, to: { x: 64, y: 28 }, type: 'ball' },
      ],
      zones: [
        { id: 'build-zone', marker: 'cone', tone: 'white', x: 33, y: 51, width: 12, height: 10 },
        { id: 'attack-zone', marker: 'target', tone: 'green', x: 58, y: 22, width: 16, height: 12 },
      ],
    },
    'crosscourt-line-change': {
      players: [{ id: 'builder', label: 'Build', pose: 'forehand', team: 'home', x: 37, y: 70 }],
      arrows: [
        { curved: true, id: 'crosscourt-one', from: { x: 37, y: 70 }, to: { x: 64, y: 28 }, type: 'ball' },
        { curved: true, id: 'line-change', from: { x: 37, y: 70 }, to: { x: 31, y: 28 }, type: 'ball' },
      ],
      zones: [
        { id: 'crosscourt-depth', marker: 'target', tone: 'green', x: 58, y: 22, width: 17, height: 12 },
        { id: 'line-target', marker: 'target', tone: 'blue', x: 26, y: 22, width: 12, height: 12 },
      ],
    },
    'serve-plus-one': {
      players: [
        { id: 'serve', handedness: 'righty', label: 'S', pose: 'serve', team: 'home', ...serverDeuce },
        { id: 'plus-one', label: '+1', pose: 'forehand', team: 'home', ...attackBall },
      ],
      arrows: [
        { curved: true, id: 'serve-wide', from: serverDeuce, to: deuceServeWide, type: 'ball' },
        { curved: true, id: 'first-ball', from: attackBall, to: { x: 66, y: 27 }, type: 'ball' },
      ],
      markers: [{ id: 'attack-ball', label: '+1', type: 'ball', ...attackBall }],
      zones: [{ id: 'open-court', marker: 'target', tone: 'green', x: 60, y: 22, width: 15, height: 11 }],
    },
    'second-serve-heavy': {
      players: servePlayers,
      arrows: [
        { curved: true, id: 'heavy-body', from: serverDeuce, to: deuceServeBody, type: 'ball' },
        { id: 'recover-ready', from: serverDeuce, to: serverRecovery, type: 'recovery' },
      ],
      zones: [{ ...courtZones.deuceBodyWindow, id: 'body-window' }],
    },
    'return-step-in': {
      players: [
        { id: 'returner', label: 'R', pose: 'ready', team: 'away', x: 35, y: 26 },
        { id: 'step-in', label: 'Step', pose: 'forehand', team: 'away', x: 40, y: 37 },
      ],
      arrows: [
        { id: 'step-in', from: { x: 35, y: 26 }, to: { x: 40, y: 37 }, type: 'movement' },
        { curved: true, id: 'deep-return', from: { x: 40, y: 37 }, to: { x: 50, y: 73 }, type: 'ball' },
      ],
      zones: [{ id: 'deep-middle', marker: 'target', tone: 'green', x: 43, y: 66, width: 14, height: 12 }],
    },
    'inside-baseline': {
      players: [
        { id: 'baseline', label: 'Base', pose: 'ready', team: 'home', x: 50, y: 76 },
        { id: 'inside', label: 'In', pose: 'forehand', team: 'home', x: 50, y: 66 },
      ],
      arrows: [
        { id: 'step-in', from: { x: 50, y: 76 }, to: { x: 50, y: 66 }, type: 'movement' },
        { curved: true, id: 'time-away', from: { x: 50, y: 66 }, to: { x: 66, y: 29 }, type: 'ball' },
      ],
      zones: [{ id: 'inside-lane', marker: 'target', tone: 'white', x: 44, y: 62, width: 12, height: 10 }],
    },
    'approach-volley': {
      players: [
        { id: 'approach', label: 'Approach', pose: 'forehand', team: 'home', x: 50, y: 70 },
        { id: 'volley', label: 'Volley', pose: 'volley', team: 'home', x: 50, y: 53 },
      ],
      arrows: [
        { id: 'close', from: { x: 50, y: 70 }, to: { x: 50, y: 53 }, type: 'movement' },
        { curved: true, id: 'approach-ball', from: { x: 50, y: 70 }, to: { x: 31, y: 29 }, type: 'ball' },
        { id: 'volley-lane', from: { x: 50, y: 53 }, to: { x: 65, y: 34 }, type: 'ball' },
      ],
      zones: [{ id: 'split-volley', marker: 'target', tone: 'green', x: 44, y: 49, width: 12, height: 10 }],
    },
    'net-finish': {
      players: [{ id: 'net', label: 'Finish', pose: 'volley', team: 'home', x: 50, y: 48 }],
      arrows: [
        { id: 'behind', from: { x: 50, y: 48 }, to: { x: 31, y: 31 }, type: 'ball' },
        { id: 'open', from: { x: 50, y: 48 }, to: { x: 69, y: 31 }, type: 'ball' },
      ],
      zones: [
        { id: 'behind-target', marker: 'target', tone: 'green', x: 26, y: 25, width: 12, height: 11 },
        { id: 'open-target', marker: 'target', tone: 'green', x: 63, y: 25, width: 12, height: 11 },
      ],
    },
    'attack-reset': {
      players: [{ id: 'attacker', label: 'Choose', pose: 'forehand', team: 'home', x: 50, y: 72 }],
      arrows: [
        { curved: true, id: 'forced-attack', from: { x: 50, y: 72 }, to: { x: 68, y: 29 }, type: 'ball' },
        { curved: true, id: 'smart-reset', from: { x: 50, y: 72 }, to: { x: 50, y: 31 }, type: 'recovery' },
      ],
      zones: [
        { id: 'attack-risk', marker: 'cone', tone: 'blue', x: 62, y: 24, width: 14, height: 11 },
        { id: 'reset-safe', marker: 'target', tone: 'green', x: 44, y: 25, width: 13, height: 11 },
      ],
    },
    'first-strike-set': {
      players: [
        { id: 'server', handedness: 'righty', label: 'S', pose: 'serve', team: 'home', ...serverDeuce },
        { id: 'returner', label: 'R', pose: 'ready', team: 'away', ...returnerDeuce },
      ],
      arrows: [
        { curved: true, id: 'serve-t', from: serverDeuce, to: deuceServeT, type: 'ball' },
        { curved: true, id: 'return-deep', from: returnerDeuce, to: returnDepthMiddle, type: 'ball' },
      ],
      zones: [
        { ...courtZones.deuceBodyWindow, id: 'serve-plan' },
        { ...courtZones.returnDepthMiddle, id: 'return-plan' },
      ],
    },
    'player-led-review': {
      players: [{ id: 'review', label: 'Own it', pose: 'ready', team: 'home', x: 50, y: 74 }],
      arrows: [
        { id: 'evidence-one', from: { x: 50, y: 74 }, to: { x: 36, y: 55 }, type: 'movement' },
        { id: 'evidence-two', from: { x: 50, y: 74 }, to: { x: 64, y: 55 }, type: 'movement' },
      ],
      zones: [
        { id: 'best-drill', marker: 'target', tone: 'green', x: 30, y: 50, width: 13, height: 10 },
        { id: 'next-path', marker: 'target', tone: 'blue', x: 58, y: 50, width: 13, height: 10 },
      ],
    },
    'pattern-set': {
      players: [
        { id: 'serve', handedness: 'righty', label: 'S', pose: 'serve', team: 'home', ...serverDeuce },
        { id: 'first-ball', label: '+1', team: 'A', pose: 'forehand', x: 50, y: 74 },
      ],
      arrows: [
        { curved: true, id: 't', from: serverDeuce, to: deuceServeT, type: 'ball' },
        { id: 'first-ball', from: { x: 50, y: 74 }, to: { x: 31, y: 54 }, type: 'ball' },
      ],
    },
  }

  return overlays[diagram] ?? {
    players: [{ id: 'player', label: 'P', team: 'A', pose: 'ready', x: 50, y: 74 }],
    arrows: [{ id: 'pattern', from: { x: 50, y: 74 }, to: { x: 63, y: 42 }, type: 'ball' }],
  }
}

export function getCourtOverlay(diagram: PlayerDevelopmentDiagram) {
  const overlays: Record<PlayerDevelopmentDiagram, React.ReactNode> = {
    'movement-screen': (
      <>
        <rect className={styles.courtZone} x="108" y="132" width="64" height="28" rx="5" />
        <path className={styles.courtRecoveryLane} d="M140 150 L140 112" />
        <path className={styles.courtArrow} d="M140 150 C118 145 94 138 72 132" />
        <path className={styles.courtArrow} d="M72 132 C96 116 116 104 140 96" />
        <path className={styles.courtArrow} d="M140 96 C164 104 186 116 208 132" />
        <CourtLabel x={140} y={126} text="split + recover" />
        <CourtPlayer x={140} y={150} label="Ready" pose="ready" />
        <CourtBall x={72} y={132} />
        <CourtBall x={140} y={96} />
        <CourtBall x={208} y={132} />
      </>
    ),
    'wide-ball-reset': (
      <>
        <rect className={styles.courtZoneDanger} x="34" y="116" width="44" height="40" rx="5" />
        <rect className={styles.courtZone} x="120" y="132" width="48" height="28" rx="5" />
        <rect className={styles.courtZone} x="154" y="34" width="42" height="30" rx="5" />
        <path className={styles.courtArrow} d="M58 138 C86 105 124 70 180 49" />
        <path className={styles.courtRecoveryLane} d="M58 138 C82 154 112 154 140 146" />
        <CourtLabel x={62} y={111} text="wide pressure" tone="danger" />
        <CourtLabel x={178} y={29} text="high reset" />
        <CourtLabel x={140} y={165} text="recover lane" tone="quiet" />
        <CourtPlayer x={58} y={132} label="Defend" pose="forehand" />
        <CourtBall x={180} y={49} />
      </>
    ),
    'serve-target-ladder': (
      <>
        <CourtTarget x={50} y={74} label="Wide" shortLabel="W" labelPosition="inside" />
        <CourtTarget x={84} y={76} label="Body" shortLabel="B" labelPosition="inside" />
        <CourtTarget x={132} y={91} label="T" labelPosition="inside" />
        <path className={styles.courtArrow} d="M198 166 C162 130 102 96 50 74" />
        <path className={styles.courtArrowAlt} d="M198 166 C166 132 126 102 84 76" />
        <path className={styles.courtArrowAlt} d="M198 166 C172 138 150 116 132 91" />
        <CourtPlayer x={198} y={166} label="Server" pose="serve" />
        <CourtPlayer x={98} y={47} label="Receiver" pose="ready" scale={0.82} />
      </>
    ),
    'second-serve-plus-one': (
      <>
        <rect className={styles.courtZone} x="94" y="58" width="42" height="37" rx="5" />
        <rect className={styles.courtZone} x="84" y="82" width="40" height="36" rx="5" />
        <path className={styles.courtArrow} d="M198 166 C166 132 126 102 84 76" />
        <path className={styles.courtArrowAlt} d="M150 151 C128 132 108 114 94 96" />
        <CourtTarget x={84} y={76} label="Body" shortLabel="B" labelPosition="inside" />
        <CourtLabel x={84} y={56} text="heavy body" />
        <CourtLabel x={98} y={78} text="+1 lane" tone="quiet" />
        <CourtPlayer x={198} y={166} label="Second serve" pose="serve" />
        <CourtPlayer x={150} y={151} label="+1 ready" pose="forehand" />
        <CourtBall x={90} y={95} />
      </>
    ),
    'ball-call-rally': (
      <>
        <rect className={styles.courtZoneDanger} x="54" y="116" width="50" height="34" rx="5" />
        <rect className={styles.courtZone} x="118" y="82" width="46" height="30" rx="5" />
        <rect className={styles.courtAttackZone} x="176" y="42" width="44" height="32" rx="5" />
        <rect className={styles.courtAttackZone} x="116" y="92" width="52" height="28" rx="5" />
        <CourtTarget x={82} y={132} label="Defense" shortLabel="D" tone="danger" labelPosition="inside" />
        <CourtTarget x={140} y={96} label="Neutral" shortLabel="N" labelPosition="inside" />
        <CourtTarget x={198} y={58} label="Offense" shortLabel="O" labelPosition="inside" />
        <path className={styles.courtArrow} d="M82 132 C103 112 121 104 140 96" />
        <path className={styles.courtArrow} d="M140 96 C159 78 177 66 198 58" />
        <path className={styles.courtRecoveryLane} d="M140 150 L140 106" />
        <path className={styles.courtArrowAlt} d="M140 106 C158 88 178 70 198 58" />
        <CourtLabel x={140} y={154} text="call before swing" />
        <CourtLabel x={142} y={126} text="close + split" tone="quiet" />
        <CourtPlayer x={140} y={150} label="Call first" pose="ready" />
        <CourtPlayer x={140} y={106} label="Close" pose="forehand" />
      </>
    ),
    'short-ball-approach': (
      <>
        <rect className={styles.courtZone} x="82" y="58" width="116" height="37" rx="5" />
        <rect className={styles.courtAttackZone} x="114" y="92" width="52" height="28" rx="5" />
        <path className={styles.courtRecoveryLane} d="M140 150 L140 106" />
        <path className={styles.courtArrow} d="M140 104 C122 90 108 78 94 58" />
        <path className={styles.courtArrowAlt} d="M140 104 L140 68" />
        <CourtLabel x={132} y={51} text="deep approach" />
        <CourtLabel x={140} y={124} text="split line" tone="quiet" />
        <CourtPlayer x={140} y={150} label="Approach" pose="forehand" />
        <CourtPlayer x={140} y={104} label="Split" pose="ready" />
        <CourtBall x={94} y={58} />
      </>
    ),
    'defensive-neutralizer': (
      <>
        <rect className={styles.courtZoneDanger} x="34" y="120" width="48" height="38" rx="5" />
        <rect className={styles.courtZone} x="104" y="28" width="86" height="32" rx="5" />
        <rect className={styles.courtZone} x="112" y="132" width="56" height="28" rx="5" />
        <path className={styles.courtArrow} d="M58 137 C78 92 121 54 168 38" />
        <path className={styles.courtRecoveryLane} d="M58 137 C84 152 112 154 140 146" />
        <CourtLabel x={64} y={116} text="under pressure" tone="danger" />
        <CourtLabel x={146} y={24} text="high margin target" />
        <CourtLabel x={138} y={166} text="recover + breathe" tone="quiet" />
        <CourtPlayer x={58} y={137} label="Under pressure" pose="forehand" />
        <CourtPlayer x={140} y={146} label="Reset" pose="ready" />
        <CourtBall x={168} y={38} />
      </>
    ),
    'fatigue-pattern': (
      <>
        <rect className={styles.courtZone} x="108" y="130" width="64" height="30" rx="5" />
        <path className={styles.courtArrow} d="M68 132 L140 96" />
        <path className={styles.courtArrow} d="M140 96 L212 132" />
        <path className={styles.courtRecoveryLane} d="M212 132 C184 151 164 156 140 146" />
        <CourtLabel x={140} y={84} text="3-ball pattern" />
        <CourtLabel x={140} y={164} text="breath reset" tone="quiet" />
        <CourtPlayer x={68} y={132} label="Ball 1" pose="forehand" />
        <CourtPlayer x={212} y={132} label="Ball 3" pose="forehand" />
        <CourtPlayer x={140} y={146} label="Breathe" pose="ready" />
      </>
    ),
    'poach-timing': (
      <>
        <rect className={styles.courtAttackZone} x="137" y="58" width="64" height="74" rx="4" />
        <path className={styles.courtArrow} d="M82 146 C112 124 158 95 190 76" />
        <path className={styles.courtArrowAlt} d="M198 146 C176 128 160 100 145 70" />
        <path className={styles.courtRecoveryLane} d="M198 146 L198 118" />
        <CourtLabel x={82} y={164} text="server" tone="quiet" />
        <CourtLabel x={184} y={164} text="stay / fake / go" />
        <CourtLabel x={166} y={55} text="middle ownership" />
        <CourtPlayer x={82} y={146} label="Server" pose="serve" />
        <CourtPlayer x={198} y={146} label="Partner" pose="ready" />
        <CourtPlayer x={145} y={70} label="Poach" pose="volley" />
      </>
    ),
    'doubles-serve-pattern': (
      <>
        <CourtTarget x={50} y={74} label="Wide" shortLabel="W" labelPosition="inside" />
        <CourtTarget x={132} y={91} label="T" labelPosition="inside" />
        <rect className={styles.courtAttackZone} x="96" y="78" width="52" height="54" rx="4" />
        <path className={styles.courtArrow} d="M198 146 C162 123 101 96 50 74" />
        <path className={styles.courtArrowAlt} d="M92 132 C108 118 122 102 132 91" />
        <path className={styles.courtRecoveryLane} d="M92 132 C110 124 126 117 142 112" />
        <CourtLabel x={198} y={164} text="serve call" tone="quiet" />
        <CourtLabel x={130} y={137} text="partner closes middle" />
        <CourtPlayer x={198} y={146} label="Server" pose="serve" />
        <CourtPlayer x={92} y={132} label="Partner close" pose="volley" />
      </>
    ),
    'pattern-set': (
      <>
        <CourtTarget x={132} y={91} label="T" labelPosition="inside" />
        <path className={styles.courtArrow} d="M198 166 C172 138 150 116 132 91" />
        <path className={styles.courtArrowAlt} d="M150 150 C128 129 104 111 88 92" />
        <path className={styles.courtRecoveryLane} d="M150 150 C166 137 180 123 196 108" />
        <CourtLabel x={88} y={86} text="first ball" />
        <CourtLabel x={188} y={102} text="recover option" tone="quiet" />
        <CourtPlayer x={198} y={166} label="Serve" pose="serve" />
        <CourtPlayer x={150} y={150} label="+1 choice" pose="forehand" />
      </>
    ),
    'player-led-review': (
      <>
        <rect className={styles.courtZone} x="82" y="58" width="116" height="74" rx="5" />
        <path className={styles.courtArrow} d="M82 132 C104 96 124 76 140 58" />
        <path className={styles.courtArrowAlt} d="M198 132 C176 96 156 76 140 58" />
        <CourtLabel x={140} y={52} text="evidence rep" />
        <CourtLabel x={138} y={152} text="player chooses" tone="quiet" />
        <CourtPlayer x={82} y={132} label="Favorite drill" pose="forehand" />
        <CourtPlayer x={198} y={132} label="Pressure rep" pose="ready" />
        <CourtBall x={140} y={58} />
      </>
    ),
    'attack-audit': (
      <>
        <rect className={styles.courtZone} x="62" y="116" width="44" height="32" rx="5" />
        <rect className={styles.courtZone} x="120" y="82" width="42" height="30" rx="5" />
        <rect className={styles.courtAttackZone} x="176" y="42" width="44" height="32" rx="5" />
        <CourtTarget x={82} y={132} label="Build" shortLabel="B" labelPosition="inside" />
        <CourtTarget x={140} y={95} label="Neutral" shortLabel="N" labelPosition="inside" />
        <CourtTarget x={198} y={58} label="Attack" shortLabel="A" labelPosition="inside" />
        <path className={styles.courtArrowAlt} d="M140 150 C118 134 100 128 82 132" />
        <path className={styles.courtArrow} d="M140 150 C160 118 178 88 198 58" />
        <CourtLabel x={128} y={80} text="choose first" tone="quiet" />
        <CourtPlayer x={140} y={150} label="Decision" pose="ready" />
      </>
    ),
    'crosscourt-line-change': (
      <>
        <rect className={styles.courtZone} x="82" y="95" width="58" height="37" rx="5" />
        <rect className={styles.courtAttackZone} x="160" y="42" width="44" height="32" rx="5" />
        <path className={styles.courtArrow} d="M82 132 C104 112 120 104 140 95" />
        <path className={styles.courtArrow} d="M140 95 C161 78 178 67 198 58" />
        <path className={styles.courtArrowAlt} d="M82 132 L198 58" />
        <CourtLabel x={102} y={90} text="build cross" />
        <CourtLabel x={178} y={39} text="change on balance" />
        <CourtPlayer x={82} y={132} label="Build cross" pose="forehand" />
        <CourtBall x={198} y={58} />
      </>
    ),
    'serve-plus-one': (
      <>
        <CourtTarget x={50} y={74} label="Wide" shortLabel="W" labelPosition="inside" />
        <path className={styles.courtArrow} d="M198 166 C162 130 102 96 50 74" />
        <rect className={styles.courtAttackZone} x="178" y="82" width="42" height="30" rx="5" />
        <path className={styles.courtArrowAlt} d="M150 150 C164 130 180 113 198 95" />
        <CourtLabel x={50} y={58} text="wide serve" />
        <CourtLabel x={198} y={118} text="+1 forehand" />
        <CourtPlayer x={198} y={166} label="Serve" pose="serve" />
        <CourtPlayer x={150} y={150} label="+1 forehand" pose="forehand" />
        <CourtBall x={198} y={95} />
      </>
    ),
    'second-serve-heavy': (
      <>
        <rect className={styles.courtZone} x="94" y="58" width="44" height="37" rx="5" />
        <rect className={styles.courtZone} x="92" y="82" width="42" height="34" rx="5" />
        <path className={styles.courtArrow} d="M198 166 C166 132 126 102 84 76" />
        <path className={styles.courtArrowAlt} d="M150 150 C132 134 116 116 104 94" />
        <CourtTarget x={84} y={76} label="Body" shortLabel="B" labelPosition="inside" />
        <CourtLabel x={84} y={56} text="spin window" />
        <CourtLabel x={108} y={78} text="heavy +1" tone="quiet" />
        <CourtPlayer x={198} y={166} label="Second serve" pose="serve" />
        <CourtPlayer x={150} y={150} label="Hold ground" pose="ready" />
      </>
    ),
    'return-step-in': (
      <>
        <rect className={styles.courtZone} x="82" y="132" width="116" height="40" rx="5" />
        <rect className={styles.courtAttackZone} x="86" y="46" width="42" height="32" rx="5" />
        <path className={styles.courtRecoveryLane} d="M140 170 L140 142" />
        <path className={styles.courtArrow} d="M140 142 C124 117 109 91 96 58" />
        <CourtLabel x={140} y={126} text="step inside" />
        <CourtLabel x={100} y={42} text="deep return" />
        <CourtPlayer x={140} y={170} label="Return ready" pose="ready" />
        <CourtPlayer x={140} y={142} label="Step in" pose="forehand" />
        <CourtBall x={96} y={58} />
      </>
    ),
    'inside-baseline': (
      <>
        <rect className={styles.courtZone} x="82" y="95" width="116" height="37" rx="5" />
        <rect className={styles.courtAttackZone} x="178" y="42" width="40" height="32" rx="5" />
        <path className={styles.courtRecoveryLane} d="M140 145 L140 118" />
        <path className={styles.courtArrow} d="M140 118 C160 99 176 82 194 58" />
        <CourtLabel x={132} y={91} text="inside baseline" />
        <CourtLabel x={194} y={39} text="time away" />
        <CourtPlayer x={140} y={145} label="Start" pose="ready" />
        <CourtPlayer x={140} y={118} label="Inside line" pose="forehand" />
        <CourtBall x={194} y={58} />
      </>
    ),
    'approach-volley': (
      <>
        <rect className={styles.courtZone} x="112" y="94" width="56" height="28" rx="5" />
        <rect className={styles.courtAttackZone} x="86" y="38" width="44" height="28" rx="5" />
        <rect className={styles.courtAttackZone} x="150" y="38" width="44" height="28" rx="5" />
        <path className={styles.courtRecoveryLane} d="M140 150 L140 104" />
        <path className={styles.courtArrow} d="M140 104 C132 84 124 72 116 62" />
        <path className={styles.courtArrowAlt} d="M140 104 C148 84 156 72 164 62" />
        <CourtLabel x={140} y={91} text="split on pass" tone="quiet" />
        <CourtLabel x={116} y={35} text="volley left" />
        <CourtLabel x={164} y={35} text="volley right" />
        <CourtPlayer x={140} y={150} label="Approach" pose="forehand" />
        <CourtPlayer x={140} y={104} label="Split" pose="ready" />
        <CourtPlayer x={116} y={62} label="Volley 1" pose="volley" />
        <CourtPlayer x={164} y={62} label="Volley 2" pose="volley" />
      </>
    ),
    'net-finish': (
      <>
        <rect className={styles.courtAttackZone} x="82" y="18" width="116" height="40" rx="5" />
        <rect className={styles.courtZone} x="112" y="88" width="56" height="34" rx="5" />
        <path className={styles.courtRecoveryLane} d="M140 132 L140 108" />
        <path className={styles.courtArrow} d="M140 108 C130 82 122 66 116 54" />
        <path className={styles.courtArrowAlt} d="M140 108 C150 82 158 66 164 54" />
        <CourtLabel x={140} y={81} text="own the middle" tone="quiet" />
        <CourtLabel x={140} y={14} text="finish to open court" />
        <CourtPlayer x={140} y={108} label="Net position" pose="volley" />
        <CourtPlayer x={140} y={132} label="Close" pose="ready" />
        <CourtBall x={116} y={54} />
        <CourtBall x={164} y={54} />
      </>
    ),
    'attack-reset': (
      <>
        <rect className={styles.courtZoneDanger} x="176" y="42" width="44" height="32" rx="5" />
        <rect className={styles.courtZone} x="118" y="82" width="44" height="32" rx="5" />
        <CourtTarget x={198} y={58} label="Attack" shortLabel="A" tone="danger" labelPosition="inside" />
        <CourtTarget x={140} y={95} label="Reset" shortLabel="R" labelPosition="inside" />
        <path className={styles.courtArrow} d="M140 145 C164 118 183 88 198 58" />
        <path className={styles.courtArrowAlt} d="M198 58 C174 78 156 88 140 95" />
        <CourtLabel x={198} y={38} text="forced attack" tone="danger" />
        <CourtLabel x={118} y={80} text="recover shape" tone="quiet" />
        <CourtPlayer x={140} y={145} label="Failed attack" pose="forehand" />
        <CourtBall x={140} y={95} />
      </>
    ),
    'first-strike-set': (
      <>
        <CourtTarget x={132} y={91} label="T" labelPosition="inside" />
        <path className={styles.courtArrow} d="M198 166 C172 138 150 116 132 91" />
        <rect className={styles.courtAttackZone} x="74" y="66" width="42" height="32" rx="5" />
        <rect className={styles.courtZone} x="184" y="82" width="40" height="32" rx="5" />
        <path className={styles.courtArrowAlt} d="M150 150 C122 124 100 103 86 82" />
        <path className={styles.courtArrow} d="M150 150 C164 130 182 112 204 96" />
        <CourtLabel x={140} y={88} text="serve starts point" />
        <CourtLabel x={86} y={62} text="strike early" />
        <CourtLabel x={204} y={126} text="backup target" tone="quiet" />
        <CourtPlayer x={198} y={166} label="Serve" pose="serve" />
        <CourtPlayer x={150} y={150} label="Strike 1" pose="forehand" />
        <CourtBall x={86} y={82} />
        <CourtBall x={204} y={96} />
      </>
    ),
  }

  return overlays[diagram]
}

function CourtTarget({
  x,
  y,
  label,
  labelPosition = 'above',
  shortLabel,
  tone = 'default',
}: {
  x: number
  y: number
  label: string
  labelPosition?: 'above' | 'inside'
  shortLabel?: string
  tone?: 'default' | 'danger'
}) {
  return (
    <g className={tone === 'danger' ? styles.courtTargetDanger : styles.courtTarget}>
      <circle cx={x} cy={y} r="7.5" />
      <circle cx={x} cy={y} r="2.2" />
      <text x={x} y={labelPosition === 'inside' ? y + 3 : y - 14} textAnchor="middle">
        {shortLabel || label}
      </text>
    </g>
  )
}

function CourtBall({ x, y }: { x: number; y: number }) {
  return <circle className={styles.courtBall} cx={x} cy={y} r="5" />
}

function CourtLabel({
  x,
  y,
  text,
  tone = 'default',
}: {
  x: number
  y: number
  text: string
  tone?: 'default' | 'quiet' | 'danger'
}) {
  return (
    <g className={`${styles.courtLabel} ${tone === 'quiet' ? styles.courtLabelQuiet : ''} ${tone === 'danger' ? styles.courtLabelDanger : ''}`}>
      <text x={x} y={y} textAnchor="middle">{text}</text>
    </g>
  )
}

function CourtPlayer({
  x,
  y,
  label,
  pose = 'ready',
  scale = 1,
}: {
  x: number
  y: number
  label: string
  pose?: 'ready' | 'serve' | 'forehand' | 'volley'
  scale?: number
}) {
  const headCy = y - 13
  const headRadius = 5.7
  const headClipId = `court-player-head-${x}-${y}-${pose}`
  const headSeam = [
    `M${x - headRadius * 0.86} ${headCy - headRadius * 0.02}`,
    `C${x - headRadius * 0.58} ${headCy - headRadius * 0.54}`,
    `${x - headRadius * 0.08} ${headCy - headRadius * 0.2}`,
    `${x + headRadius * 0.12} ${headCy + headRadius * 0.06}`,
    `C${x + headRadius * 0.38} ${headCy + headRadius * 0.4}`,
    `${x + headRadius * 0.7} ${headCy + headRadius * 0.34}`,
    `${x + headRadius * 0.9} ${headCy + headRadius * 0.05}`,
  ].join(' ')
  const racquet = {
    ready: { cx: x + 10, cy: y - 1, handle: `M${x + 4} ${y + 1}L${x + 8} ${y}` },
    serve: { cx: x + 10, cy: y - 17, handle: `M${x + 3} ${y - 7}L${x + 8} ${y - 14}` },
    forehand: { cx: x + 11, cy: y - 3, handle: `M${x + 4} ${y - 1}L${x + 9} ${y - 2}` },
    volley: { cx: x + 10, cy: y - 8, handle: `M${x + 4} ${y - 2}L${x + 8} ${y - 6}` },
  }[pose]
  const arms = {
    ready: `M${x - 5} ${y - 4}L${x - 10} ${y}M${x + 5} ${y - 4}L${x + 9} ${y - 1}`,
    serve: `M${x - 5} ${y - 4}L${x - 9} ${y + 1}M${x + 5} ${y - 5}L${x + 8} ${y - 14}`,
    forehand: `M${x - 5} ${y - 4}L${x - 10} ${y}M${x + 5} ${y - 4}L${x + 10} ${y - 2}`,
    volley: `M${x - 5} ${y - 4}L${x - 10} ${y - 2}M${x + 5} ${y - 4}L${x + 9} ${y - 6}`,
  }[pose]

  return (
    <g className={styles.courtPlayer} aria-label={label}>
      <g transform={`translate(${x} ${y}) scale(${scale}) translate(${-x} ${-y})`}>
        <defs>
          <clipPath id={headClipId}>
            <circle cx={x} cy={headCy} r={headRadius - 1.1} />
          </clipPath>
        </defs>
        <circle className={styles.courtPlayerHead} cx={x} cy={headCy} r={headRadius} />
        <g clipPath={`url(#${headClipId})`}>
          <path className={styles.courtPlayerSeamBack} d={headSeam} />
          <path className={styles.courtPlayerLogoArc} d={headSeam} />
        </g>
        <path className={styles.courtPlayerBody} d={`M${x} ${y - 7}L${x} ${y + 6}`} />
        <path className={styles.courtPlayerBody} d={arms} />
        <path className={styles.courtPlayerBody} d={`M${x} ${y + 6}L${x - 7} ${y + 15}M${x} ${y + 6}L${x + 7} ${y + 15}`} />
        <path className={styles.courtRacquetHandle} d={racquet.handle} />
        <ellipse className={styles.courtRacquetHead} cx={racquet.cx} cy={racquet.cy} rx="3.9" ry="5.1" />
      </g>
    </g>
  )
}
