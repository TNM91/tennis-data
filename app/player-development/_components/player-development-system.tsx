import Link from 'next/link'
import { create as createQrCode } from 'qrcode'
import BrandWordmark from '@/app/components/brand-wordmark'
import PlayerSuitePanel from '@/app/components/player-suite-panel'
import SiteShell from '@/app/components/site-shell'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import TiqCourt from '@/components/tactical/TiqCourt'
import { courtSpots, courtZones } from '@/components/tactical/coordinates'
import type { DrillOverlay } from '@/components/tactical/types'
import {
  PLAYER_DEVELOPMENT_IDENTITIES,
  PLAYER_DEVELOPMENT_DIAGRAMS,
  getPlayerDevelopmentIdentity,
  type PlayerDevelopmentDiagram,
  type PlayerDevelopmentIdentity,
  type PlayerDevelopmentWeek,
} from '@/lib/player-development'
import { DATA_ASSIST_STORY, getMembershipTier } from '@/lib/product-story'
import PlayerDevelopmentPrintControls from './player-development-print-controls'
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
  const workbookPrintActive = focus === 'overview' || focus === 'workbook'
  const coachPrintActive = focus === 'overview' || focus === 'coach'

  const content = (
    <main className={`${styles.shell} ${packetView ? styles.packetShell : ''} player-development-print-surface`}>
        {!packetView ? (
          <>
            <section className={styles.hero}>
              <div className={styles.heroCopy}>
                <div className={styles.brandRow}>
                  <BrandWordmark top />
                  <span className={styles.printBadge}>Printable + My Lab companion</span>
                </div>
                <p className={styles.kicker}>TenAceIQ Player Development System</p>
                <h1>{identity.title}</h1>
                <p className={styles.heroText}>
                  A premium workbook and coach planner for {identity.ratingBand.toLowerCase()}: {identity.promise}
                </p>
                <div className={styles.actions}>
                  <Link className="button-primary" href={`/player-development/${identity.slug}/workbook`}>
                    Open workbook
                  </Link>
                  <Link className="button-secondary" href={`/player-development/${identity.slug}/coach-planner`}>
                    Open coach planner
                  </Link>
                </div>
              </div>
              <div className={styles.heroPanel}>
                <CourtDiagram diagram="serve-target-ladder" title="Serve target map" />
                <div className={styles.identityCard}>
                  <TiqFeatureIcon name="myLab" size="md" variant="surface" />
                  <div>
                    <span>Player identity</span>
                    <strong>{identity.title.replace(/^The /, '')}</strong>
                    <p>{identity.mantra}</p>
                  </div>
                </div>
              </div>
            </section>

            <PlayerSuitePanel
              active="development"
              playerLabel="Player+ development path"
              flow={['lab', 'development', 'matchup', 'refresh']}
            />

            <IdentitySelector activeSlug={identity.slug} />

            <section className={styles.structurePanel} aria-labelledby="structure-title">
              <div className={styles.sectionHead}>
                <p className={styles.kicker}>Player Development</p>
                <h2 id="structure-title">Turn match goals into court work.</h2>
                <p>
                  Use workbook paths, coach planner sheets, weekly goals, match evidence, and My Lab check-ins to keep improvement moving between matches and lessons.
                </p>
              </div>
              <div className={styles.planGrid}>
                <PlanCard icon="myLab" title="My Lab connection" items={['Choose a goal', 'Save match evidence', 'Track the next read']} />
                <PlanCard icon="reports" title="Workbook path" items={['Identity page', 'Training menu', 'Module sheets', 'Recap and notes']} />
                <PlanCard icon="schedule" title="Coach planner" items={['Lesson template', 'Cues', 'Homework', 'Evaluation tracking']} />
              </div>
            </section>
          </>
        ) : (
          <section className={styles.packetHeader} aria-label="Print packet">
            <BrandWordmark top />
            <div>
              <p className={styles.kicker}>{focus === 'coach' ? 'Coach planner' : 'Player workbook'}</p>
              <h1>{identity.title}</h1>
            </div>
          </section>
        )}

        <PlayerDevelopmentPrintControls
          activePacket={focus === 'coach' ? 'coach' : focus === 'workbook' ? 'workbook' : 'overview'}
          identitySlug={identity.slug}
        />

        <WorkbookPreview identity={identity} active={focus === 'workbook'} printActive={workbookPrintActive} />
        <CoachPlannerPreview identity={identity} active={focus === 'coach'} printActive={coachPrintActive} />

        {!packetView ? (
          <>
            <ReusableSheets identity={identity} />
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

function IdentitySelector({ activeSlug }: { activeSlug: string }) {
  return (
    <section className={styles.identitySelector} aria-labelledby="identity-selector-title">
      <div className={styles.sectionHead}>
        <p className={styles.kicker}>Development identities</p>
        <h2 id="identity-selector-title">Choose the player path</h2>
        <p>
          Each identity has a workbook path, coach planner, and My Lab companion for the same development loop.
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
      <WorkbookPage className={styles.coverPage} footer="Workbook cover">
        <div className={styles.pageTopline}>
          <BrandWordmark compact onLight />
          <span>Player workbook</span>
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
            <strong>Standalone workbook. Player+ connected path.</strong>
            <p>Use the pages on court with or without the app. Scan to connect goals, progress, and coach handoffs when Player+ access is active.</p>
            <QrAction href={`/player-development/${identity.slug}/workbook`} label="Open path" />
          </div>
        </div>
        <CourtDiagram diagram={identity.weeks[0]?.diagram ?? 'movement-screen'} title={`${identity.title.replace(/^The /, '')} court map`} />
      </WorkbookPage>

      <WorkbookPage footer="Packet index">
        <PageHeader label="Packet index" title="How to use this workbook" />
        <WorkbookPacketIndex identity={identity} />
      </WorkbookPage>

      <WorkbookPage footer="Identity">
        <PageHeader label="Identity page" title="How this player wins" />
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
        <PageHeader label="Style finder" title="Recognize the player you are building" />
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

      <WorkbookPage footer="Player+ handoff">
        <PageHeader label="Player+ workflow" title="Turn the workbook into court work" />
        <div className={styles.playerPlusBridge}>
          <TiqFeatureIcon name="myLab" size="lg" variant="surface" />
          <div>
            <span>Workbook to My Lab</span>
            <h3>Set one goal, track one behavior, bring one note to your coach.</h3>
            <p>
              The paper guide stands on its own. Player+ unlocks the connected layer:
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

      <WorkbookPage footer="Training menu">
        <PageHeader label="Training menu" title="Training menu by theme" />
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
            <span>Player+ rhythm</span>
            <strong>Plan the phase, train the module, upload the evidence.</strong>
        <p>The workbook pages are useful on paper. Player+ turns each phase into tracked goals, coach notes, and match reflections inside TenAceIQ.</p>
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
        <PageHeader label="Player+ scorecard" title={`${identity.levelPath.from} to ${identity.levelPath.to}`} />
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

      <WorkbookPage footer="Player+ evidence">
        <PageHeader label="Player+ evidence" title="What goes back into TenAceIQ" />
        <PlayerPlusEvidenceLog identity={identity} weeks={identity.weeks.slice(0, 4)} />
      </WorkbookPage>

      <WorkbookPage footer="Player+ evidence">
        <PageHeader label="Player+ evidence" title="Second-half evidence log" />
        <PlayerPlusEvidenceLog identity={identity} weeks={identity.weeks.slice(4)} />
        <div className={styles.twoColumn}>
          <ReflectionLines label="Best evidence from this block" rows={4} />
          <ReflectionLines label="Coach follow-up request" rows={4} />
        </div>
      </WorkbookPage>

      <WorkbookPage footer="Player+ check-in">
        <PageHeader label="Player+ check-in" title="Coach-ready check-in" />
        <PlayerPlusCheckIn identity={identity} />
        <div className={styles.twoColumn}>
          <ReflectionLines label="What I want TenAceIQ to track next" rows={4} />
          <ReflectionLines label="What I need from my coach" rows={4} />
        </div>
      </WorkbookPage>

      <WorkbookPage footer="Player+ companion">
        <PageHeader label="Connected companion" title="What Player+ adds to this workbook" />
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
        <strong>Print guide first. Player+ connected tools second.</strong>
        <p>
          Anyone can use the workbook as a training guide if it is shared with them.
          Scanning the QR codes can open TenAceIQ pages, but saving goals, check-ins,
          progress history, and coach assignments requires active Player+ access.
        </p>
      </div>
    </div>
  )
}

function WorkbookPacketIndex({ identity }: { identity: PlayerDevelopmentIdentity }) {
  const sections = [
    ['Identity', 'Define how this player wins and what habits matter most.'],
    ['Training menu', 'Choose weekly work by movement, serve, strokes, conditioning, doubles, or accountability.'],
    ['Modules', 'Run each practice with the prescription, court diagram, pressure game, and evidence note.'],
    ['Reusable sheets', 'Print extra recaps, match reflections, serve charts, doubles trackers, and assignments.'],
    ['Player+ companion', 'Scan QR codes to save goals and evidence when Player+ access is active.'],
  ] as const

  return (
    <div className={styles.packetIndex}>
      <div className={styles.packetIndexHero}>
        <TiqFeatureIcon name="reports" size="lg" variant="surface" />
        <div>
          <span>{identity.levelPath.from} to {identity.levelPath.to}</span>
          <strong>Use the guide in order, then reuse the sheets as needed.</strong>
          <p>The workbook should create one coach-ready note every module and one Player+ action whenever the player wants the work saved inside TenAceIQ.</p>
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
      <TrackerTable columns={['Use this page when', 'Player completes', 'Coach reviews', 'Player+ save point']} rows={['Before the block', 'Each module', 'After a match', 'Before next lesson']} />
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
          <p>Train reps first. The player needs more repeatable pattern volume before adding pressure.</p>
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
          'Attacked only earned green balls for one full set.',
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
          <p>Use this page when the player starts using the identity as a label instead of a match plan.</p>
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
        <QrAction href={`/player-development/${identity.slug}/workbook`} label="Save focus" mode="player-plus" />
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
        <p>Choose one leak, one module, and one pressure test. Save the rest for later so the player does not scatter attention.</p>
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
        columns={['Coach sees', 'Player feels', 'Shared priority', 'Assignment']}
        rows={identity.sections.slice(0, 5).map((section) => section.title)}
      />
      <div className={styles.twoColumn}>
        <ReflectionLines label="Coach's highest-priority correction" rows={4} />
        <ReflectionLines label="What I will bring back as proof" rows={4} />
      </div>
      <div className={styles.coachConversationFooter}>
        <div>
          <span>Player+ handoff</span>
          <strong>Turn the conversation into a saved assignment.</strong>
          <p>The workbook can guide the lesson on paper. Player+ should store the agreed focus and evidence after the session.</p>
        </div>
        <QrAction href={`/player-development/${identity.slug}/coach-planner`} label="Coach note" mode="player-plus" />
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
            <PracticePrescription week={week} />
            <WeekPlanTable week={week} />
          </div>
          <aside className={styles.weekAside}>
            <CourtDiagram diagram={week.diagram} title={`Module ${week.week} court cue`} />
            <DiagramReadout diagram={week.diagram} />
            <TiqPromptBlock
              href={`/player-development/${identity.slug}/workbook#module-${week.week}`}
              text={week.tiqPrompt}
              title="Player+ check-in"
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
          <ReflectionLines label="Player+ evidence to save" rows={5} />
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
  const badge = mode === 'player-plus' ? 'Player+ to save' : 'Open guide'

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
    { href: `/player-development/${identity.slug}/workbook`, label: 'Match reflection', icon: 'reports' as const },
    { href: `/player-development/${identity.slug}/coach-planner`, label: 'Coach note', icon: 'messagingCenter' as const },
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
          <span>Player+ review loop</span>
          <strong>Evidence creates the next assignment.</strong>
          <p>
            Use this page after each phase to decide what gets updated in My Lab, what gets sent to the coach,
            and what becomes the next match-day focus.
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
    ['Save my two-week focus', 'Track the one focus that changes the next match fastest', `/player-development/${identity.slug}/workbook`],
    ['Build the tactic board', 'Turn the workbook cue into a visual point plan in TIQ Tactical Studio', '/tactics'],
    ['Log match evidence', 'Keep proof from pressure points, serve targets, and style triggers', `/player-development/${identity.slug}/workbook`],
    ['Send coach note', 'Turn coach feedback into the next assignment', `/player-development/${identity.slug}/coach-planner`],
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
            <span>Player+ action</span>
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
                <dt>Player+ action</dt>
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

      <WorkbookPage footer="One-hour lesson">
        <PageHeader label="One-hour lesson" title="Lesson plan template" />
        <div className={styles.lessonTemplate}>
          <TemplateBlock time="0:00-0:08" title="Readiness review" text="Review tracker, last match reflection, and one player-owned goal." />
          <TemplateBlock time="0:08-0:18" title="Movement primer" text="Split-step rhythm, recovery lanes, and balance after contact." />
          <TemplateBlock time="0:18-0:40" title="Main drill block" text="Theme drill with scoring, target cue, and pressure progression." />
          <TemplateBlock time="0:40-0:54" title="Competitive close" text="Live points with the module's identity constraint." />
          <TemplateBlock time="0:54-1:00" title="Homework handoff" text="Assign one measurable action and one TenAceIQ check-in." />
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
        <PageHeader label="Coach review" title="Player+ evidence review" />
        <CoachEvidenceReview identity={identity} />
        <div className={styles.twoColumn}>
          <ReflectionLines label="Next private lesson priority" rows={4} />
          <ReflectionLines label="Next Player+ assignment" rows={4} />
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
          <p>Use this planner to turn each workbook module into one private lesson, one pressure test, and one measurable assignment.</p>
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

function ReusableSheets({ identity }: { identity: PlayerDevelopmentIdentity }) {
  return (
    <section className={styles.sheetPanel} aria-labelledby="sheets-title">
      <div className={styles.sectionHead}>
        <p className={styles.kicker}>Reusable printable sheets</p>
        <h2 id="sheets-title">Ready-to-print sheet library</h2>
      </div>
      <div className={styles.sheetGrid}>
        {identity.reusableSheets.map((sheet) => (
          <article className={styles.sheetCard} key={sheet}>
            <span>{sheet}</span>
            <div className={styles.sheetLines} aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function ReusableWorkbookSheets({ identity }: { identity: PlayerDevelopmentIdentity }) {
  return (
    <>
      <WorkbookPage footer="Player recap">
        <PageHeader label="Reusable sheet" title="Player recap" />
        <div className={styles.sheetLayout}>
          <ReflectionLines label="What improved in this module" rows={5} />
          <ReflectionLines label="What needs coach attention" rows={5} />
          <TrackerTable columns={['Habit', 'Score', 'Evidence', 'Next action']} rows={identity.sections.slice(0, 5).map((section) => section.title)} />
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
          <ReflectionLines label="Player evidence to bring back" rows={5} />
        </div>
        <TrackerTable columns={['Day', 'Work completed', 'Confidence', 'Note']} rows={['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Match day']} />
      </WorkbookPage>

      <WorkbookPage footer="Player+ review">
        <PageHeader label="Reusable sheet" title="Player+ review sheet" />
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
      <TrackerTable columns={['Skill', 'Exact work', 'Scoring standard', 'Evidence due', 'Player+ update']} rows={rows} />
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
  footer,
}: {
  children: React.ReactNode
  className?: string
  footer?: string
}) {
  return (
    <article className={`${styles.workbookPage} ${className}`}>
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
  const overlay = getTacticalOverlay(diagram)

  return (
    <figure className={styles.courtFigure}>
      <figcaption>
        <span>{title}</span>
        <small>{meta.title}</small>
      </figcaption>
      <TiqCourt alt={title} className={styles.tiqCourtFrame} overlay={overlay} showLabels={false} />
    </figure>
  )
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
        { id: 'red', marker: 'cone', x: 28, y: 61, width: 14, height: 10 },
        { id: 'yellow', marker: 'target', x: 44, y: 48, width: 12, height: 9 },
        { id: 'green', marker: 'target', x: 62, y: 25, width: 13, height: 9 },
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
        <CourtTarget x={82} y={132} label="Red" shortLabel="R" tone="danger" labelPosition="inside" />
        <CourtTarget x={140} y={96} label="Yellow" shortLabel="Y" labelPosition="inside" />
        <CourtTarget x={198} y={58} label="Green" shortLabel="G" labelPosition="inside" />
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
