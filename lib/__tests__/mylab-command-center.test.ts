import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildReflectionPatternRead } from '@/lib/player-reflections'

const pageSource = readFileSync(join(process.cwd(), 'app/mylab/page.tsx'), 'utf8')
const componentSource = readFileSync(join(process.cwd(), 'app/mylab/my-lab-command-center.tsx'), 'utf8')
const styleSource = readFileSync(join(process.cwd(), 'app/mylab/my-lab-command-center.module.css'), 'utf8').replace(/\r\n/g, '\n')
const iconSource = readFileSync(join(process.cwd(), 'components/brand/TiqFeatureIcon.tsx'), 'utf8')
const portalSource = readFileSync(join(process.cwd(), 'app/components/portal-tool-bar.tsx'), 'utf8')
const pricingSource = readFileSync(join(process.cwd(), 'app/pricing/page.tsx'), 'utf8')
const upgradeSource = readFileSync(join(process.cwd(), 'app/upgrade/page.tsx'), 'utf8')
const reflectionApiSource = readFileSync(join(process.cwd(), 'app/api/player/reflections/route.ts'), 'utf8')
const reflectionModelSource = readFileSync(join(process.cwd(), 'lib/player-reflections.ts'), 'utf8')
const reflectionMigrationSource = readFileSync(join(process.cwd(), 'supabase/migrations/20260928000200_create_player_reflections.sql'), 'utf8')

describe('My Lab command center', () => {
  it('puts one data-backed court action ahead of the legacy lab workspace', () => {
    const commandCenterIndex = pageSource.indexOf('<MyLabCommandCenter')
    const legacyWorkspaceIndex = pageSource.indexOf('<PlayerWorkshopShell')

    expect(commandCenterIndex).toBeGreaterThanOrEqual(0)
    expect(legacyWorkspaceIndex).toBeGreaterThan(commandCenterIndex)
    expect(pageSource).toContain('latestLevelUpProofCard?.title')
    expect(pageSource).toContain('isProfileConfirmed && hasMyLabFocus ? latestLevelUpProofCard?.durationMinutes || 10 : null')
    expect(pageSource).toContain("? 'Repeat this rep'")
    expect(pageSource).toContain('completedSessions={commandCenterCompletedSessions}')
    expect(pageSource).toContain('firstServeSteps={firstServeSteps}')
    expect(pageSource).toContain('postRepReturn={postRepReturn}')
    expect(pageSource).toContain('nextCourtEvent={nextCourtEvent}')
  })

  it('returns completed players to proof and one score-adjusted weekly plan', () => {
    expect(pageSource).toContain('const postRepReturn = latestLevelUpProof')
    expect(pageSource).toContain('buildMyLabWeeklyImprovementPlan(levelUpProofRecords)')
    expect(pageSource).toContain('weeklyImprovementPlan.nextAction')
    expect(pageSource).toContain("? 'Connect your player record so this proof stays with your tennis.'")
    expect(pageSource).toContain("? 'Tie this proof to one focus for your next match or practice.'")
    expect(componentSource).toContain('Rep saved · {postRepReturn.timeLabel}')
    expect(componentSource).toContain('{postRepReturn.syncLabel}')
    expect(componentSource).toContain('This week')
    expect(componentSource).toContain('Weekly plan · {postRepReturn.planLabel}')
    expect(componentSource).toContain('{postRepReturn.planWhy}')
    expect(componentSource).toContain('{postRepReturn.proofTarget}')
    expect(componentSource).toContain('{postRepReturn.trendLabel}')
    expect(componentSource).toContain('href={postRepReturn.nextHref}')
    expect(styleSource).toContain('.postRepReturn')
    expect(styleSource).toContain('.postRepSync')
    expect(pageSource).toContain("'Account proof is current across devices.'")
    expect(pageSource).toContain('weeklyImprovementPlan.nextCta')
    expect(styleSource).toContain('.postRepPlanMeta')
  })

  it('guides first use with real setup progress and retires the path after the first rep', () => {
    expect(pageSource).toContain('const hasMyLabFocus = Boolean(activeGoal.goal.trim())')
    expect(pageSource).toContain('!isProfileConfirmed || (hasMyLabFocus && latestLevelUpProof)')
    expect(pageSource).toContain("title: 'Connect your player'")
    expect(pageSource).toContain("title: 'Choose one focus'")
    expect(pageSource).toContain("title: 'Finish your first rep'")
    expect(pageSource).toContain("href: !isProfileConfirmed ? '/profile' : hasMyLabFocus ? '/mylab#player-tools' : MY_LAB_GOAL_PROGRESS_HREF")
    expect(pageSource).toContain("action: isProfileConfirmed ? 'Set my focus' : 'Connect player first'")
    expect(pageSource).toContain('open={!isMobile && !hasMyLabFocus}')
    expect(pageSource).toContain("? 'Find your player record'")
    expect(pageSource).toContain("? 'Choose one tennis focus'")
    expect(componentSource).toContain('Build your player loop.')
    expect(componentSource).toContain("aria-current={isCurrent ? 'step' : undefined}")
    expect(componentSource).toContain("data-has-current={nextFirstServeStep >= 0 ? 'true' : 'false'}")
    expect(componentSource).toContain('styles.firstServeStepSecondary')
    expect(componentSource).toContain('href={step.href}')
    expect(pageSource).not.toContain('First My Lab read')
  })

  it('keeps player and opponent details navigable', () => {
    expect(componentSource).toContain('href={`/players/${encodeURIComponent(playerId)}`}')
    expect(componentSource).toContain('href={`/players/${encodeURIComponent(matchup.opponentId)}`}')
    expect(componentSource).toContain('href={matchup?.href || \'/matchup\'}')
    expect(componentSource).toContain('View matchup')
    expect(componentSource).toContain('See progress')
  })

  it('uses real TenAceIQ court assets and a mobile-safe hierarchy', () => {
    expect(componentSource).toContain('src="/tiq/courts/tiq-court-master.png"')
    expect(componentSource).toContain('src="/tiq/tokens/tennis-ball-reference.png"')
    expect(componentSource).toContain('sizes="(max-width: 760px) 100vw, 760px"')
    expect(styleSource).toContain('@media (max-width: 680px)')
    expect(styleSource).toContain('grid-template-columns: 1fr;')
    expect(styleSource).toContain('min-height: 58px;')
    expect(styleSource).toContain('overflow-wrap: anywhere;')
    expect(styleSource).toContain('.firstServeGrid')
    expect(styleSource).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));')
    expect(styleSource).toContain(".firstServeGrid[data-has-current='true'] .firstServeStepSecondary")
    expect(componentSource).toContain("${postRepReturn ? styles.primaryGridAfterRep : ''}")
    expect(componentSource).toContain('{!postRepReturn ? <article className={styles.repCard}>')
    expect(componentSource).toContain('{!postRepReturn ? <article className={styles.momentumCard}>')
    expect(styleSource).toContain('.supportStackAfterRep .matchCard')
    expect(styleSource).toContain('.ballImage {\n    right: 0;')
    expect(styleSource).toContain('width: clamp(128px, 23vw, 178px);')
    expect(styleSource).toContain('width: 108px;')
    expect(styleSource).not.toContain('right: -42px;')
    expect(styleSource).not.toContain('right: -44px;')
  })

  it('keeps the active-player context compact on a phone', () => {
    expect(styleSource).toContain('.playerLink {\n    display: flex;\n    width: fit-content;')
    expect(styleSource).toContain('max-width: min(220px, 58vw);')
    expect(styleSource).toContain('font-size: clamp(2rem, 9.6vw, 2.8rem);')
  })

  it('uses a compact daily pulse instead of a second large weekly card on phones', () => {
    expect(componentSource).toContain('const dailyPulseItems = [')
    expect(componentSource).toContain("label: 'Court time'")
    expect(componentSource).toContain("label: 'This week'")
    expect(componentSource).toContain("label: 'Matchup'")
    expect(componentSource).toContain('aria-label="My Lab daily pulse"')
    expect(componentSource).toContain('{!postRepReturn ? (')
    expect(styleSource).toContain('.dailyPulse')
    expect(styleSource).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));')
    expect(styleSource).toContain('.momentumCard {\n    display: none;')
  })

  it('puts an actual upcoming scheduled match ahead of generic match prep', () => {
    expect(pageSource).toContain('const nextCourtEvent = [')
    expect(pageSource).toContain("item.eventType === 'match' && item.date >= todayDateKey")
    expect(pageSource).toContain("item.kind === 'match' && item.date >= todayDateKey")
    expect(pageSource).toContain('getLocalDateKey(new Date())')
    expect(componentSource).toContain('Next on court')
    expect(componentSource).toContain('className={styles.nextCourtEvent}')
    expect(componentSource).toContain('{nextCourtEvent.cta}')
    expect(componentSource).toContain('{nextCourtEvent.readiness}')
    expect(pageSource).toContain("'Availability needs a reply'")
    expect(pageSource).toContain("'Availability confirmed'")
  })

  it('keeps optional progress and calendar tools behind a mobile disclosure', () => {
    expect(pageSource).toContain('const collapseLegacyWorkspace = isMobile && isProfileConfirmed')
    expect(pageSource).toContain("const PlayerWorkshopShell: 'details' | 'section'")
    expect(pageSource).toContain('<strong>More in My Lab</strong>')
    expect(pageSource).toContain('Progress, teams, and calendar.')
    expect(pageSource).toContain('mobileMyLabExtrasDetailsStyle')
  })

  it('uses one consistent My Lab mark without a nested signature frame', () => {
    expect(iconSource).toContain('myLab: FlaskIcon')
    expect(iconSource).not.toContain("signature = name === 'myLab'")
    expect(iconSource).not.toContain('tiq-feature-icon--signature')
    expect(iconSource).not.toContain('data-icon-treatment')
    expect(componentSource).toContain('<TiqFeatureIcon name="myLab" size="md" variant="surface" />')
    expect(componentSource).toContain('Player tools')
    expect(portalSource).toContain("icon: 'myLab'")
    expect(pricingSource).toContain("player_plus: 'myLab'")
    expect(upgradeSource).toContain("player_plus: 'myLab'")
  })

  it('turns Reflect into a fast device-safe player check-in', () => {
    expect(componentSource).toContain('tiq-mylab-reflection:')
    expect(componentSource).toContain('How did it go?')
    expect(componentSource).toContain('What worked?')
    expect(componentSource).toContain('What changes next?')
    expect(componentSource).toContain('Save reflection')
    expect(componentSource).toContain('Offline work stays safe on this phone.')
    expect(componentSource).toContain('window.localStorage.setItem(reflectionStorageKey')
    expect(componentSource).toContain('aria-pressed={reflectionScore === item.score}')
    expect(styleSource).toContain('.mobileReflectionForm')
    expect(styleSource).toContain('.mobileReflectionScores')
  })

  it('remembers the latest proof-to-next-move cycle on the phone', () => {
    expect(pageSource).toContain('lastResult={lastMatchSummary}')
    expect(componentSource).toContain('Your cycle memory')
    expect(componentSource).toContain('What led to what')
    expect(componentSource).toContain('01 · Proof')
    expect(componentSource).toContain('02 · Result')
    expect(componentSource).toContain('03 · Lesson')
    expect(componentSource).toContain('04 · Next move')
    expect(componentSource).toContain("savedReflection?.next || repNote")
    expect(styleSource).toContain('.mobileCycleMemory')
    expect(styleSource).toContain('.mobileCycleNext')
  })

  it('syncs reflection history to each signed-in player without losing the phone fallback', () => {
    expect(componentSource).toContain("fetch('/api/player/reflections'")
    expect(componentSource).toContain('supabase.auth.getSession()')
    expect(componentSource).toContain('Saved to your account')
    expect(componentSource).toContain('Start a new reflection')
    expect(componentSource).toContain('Past loops')
    expect(componentSource).toContain('mergeReflectionHistory')
    expect(reflectionApiSource).toContain('getSignedInPlayerApiAuth(request)')
    expect(reflectionApiSource).toContain(".from('player_reflections')")
    expect(reflectionApiSource).toContain(".upsert(payload, { onConflict: 'id' })")
    expect(reflectionModelSource).toContain('buildPlayerReflectionPayload')
    expect(reflectionMigrationSource).toContain('enable row level security')
    expect(reflectionMigrationSource).toContain('auth.uid() = player_user_id')
    expect(styleSource).toContain('.mobilePastLoops')
  })

  it('turns completed reflection loops into an evidence-bound pattern read', () => {
    const read = buildReflectionPatternRead([
      { outcome: 3, worked: 'Second serve shape held under pressure', nextStep: 'Keep more margin' },
      { outcome: 3, worked: 'Trusted the second serve', nextStep: 'Use margin over the net' },
      { outcome: 2, worked: 'Second serve improved late', nextStep: 'Stay patient' },
      { outcome: 1, worked: 'Forehand timing was late', nextStep: 'Reset footwork' },
    ])

    expect(read).toMatchObject({
      sampleSize: 4,
      heldUpRate: 50,
      direction: 'Strengthening',
      workingTheme: { label: 'Second Serve', count: 3 },
      adjustmentTheme: { label: 'Margin', count: 2 },
    })
    expect(componentSource).toContain('Your pattern read')
    expect(componentSource).toContain('What keeps working')
    expect(componentSource).toContain('Adjustment resurfacing')
    expect(componentSource).toContain('One more reflection unlocks your first pattern read.')
    expect(styleSource).toContain('.mobilePatternRead')
    expect(styleSource).toContain('.mobilePatternSignals')
  })
})
