import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(join(process.cwd(), 'app/player-development/page.tsx'), 'utf8')
const systemSource = readFileSync(join(process.cwd(), 'app/player-development/_components/player-development-system.tsx'), 'utf8')
const stylesSource = readFileSync(join(process.cwd(), 'app/player-development/_components/player-development.module.css'), 'utf8')
const controlsSource = readFileSync(join(process.cwd(), 'app/player-development/_components/player-development-print-controls.tsx'), 'utf8')
const liveWorkbenchSource = readFileSync(join(process.cwd(), 'app/player-development/_components/player-live-workbench.tsx'), 'utf8')
const trainingMenusSource = readFileSync(join(process.cwd(), 'lib/player-training-menus.ts'), 'utf8')

describe('Player Development public cleanup', () => {
  it('positions the public page as a phone-first Level Up product story', () => {
    expect(pageSource).toContain('Phone-first Level Up paths, on-court tennis drills')
    expect(systemSource).toContain('Turn match goals into phone-ready court work.')
    expect(systemSource).toContain('My Lab connection')
    expect(systemSource).toContain('Coach Hub assignments')
    expect(systemSource).toContain('Connected companion')
    expect(systemSource).toContain('Where the work gets saved')
    expect(systemSource).toContain('Phone-first Level Up')
    expect(systemSource).toContain('TenAceIQ Player ID + Level Up')
    expect(systemSource).toContain('Open phone drill mode')
    expect(systemSource).toContain('Phone Level Up')
    expect(systemSource).toContain('ImproveLandingHub')
    expect(systemSource).toContain("const improveLanding = focus === 'overview' && !identitySlug")
    expect(systemSource).toContain('id="improve-hub-title"')
    expect(systemSource).toContain('Start with the work you can do today')
    expect(systemSource).toContain('Open My Lab')
    expect(systemSource).toContain('Build a tactic board')
    expect(systemSource).toContain("href: '/mylab'")
    expect(systemSource).toContain("href: '/tactics'")
    expect(systemSource).toContain('className={styles.heroTitle}')
    expect(stylesSource).toContain('.improveHub')
    expect(stylesSource).toContain('.improveHubAction')
    expect(controlsSource).toContain('Paper backup')
    expect(controlsSource).toContain('Optional player backup')
    expect(systemSource).toContain('playerLabel={`${playerTier.name} development path`}')
    expect(systemSource).toContain('Optional print backup. Phone Level Up is the connected path.')
    expect(systemSource).toContain('Level Up first. Print backup when needed.')
    expect(systemSource).toContain('when {playerTier.name} access is active')
    expect(systemSource).toContain('`${playerTier.name} handoff`')
    expect(systemSource).toContain('`${playerTier.name} workflow`')
    expect(systemSource).toContain('{playerTier.name} unlocks the connected layer')
    expect(systemSource).toContain('{playerTier.name} rhythm')
    expect(systemSource).toContain('{playerTier.name} turns each phase')
    expect(systemSource).toContain('{playerTier.name} unlocks self-guided goals')
    expect(systemSource).toContain('`${playerTier.name} companion`')
    expect(systemSource).toContain('`${playerTier.name} scorecard`')
    expect(systemSource).toContain('`${playerTier.name} evidence`')
    expect(systemSource).toContain('What ${playerTier.name} adds to the phone path')
    expect(systemSource).toContain('`${playerTier.name} evidence to save`')
    expect(systemSource).toContain('`${playerTier.name} to save`')
    expect(systemSource).toContain('{playerTier.name} review loop')
    expect(systemSource).toContain('{playerTier.name} action')
    expect(systemSource).toContain('`${playerTier.name} evidence review`')
    expect(systemSource).toContain('`${playerTier.name} review sheet`')
    expect(systemSource).toContain('`${playerTier.name} update`')
    expect(systemSource).not.toContain('Player+')
    expect(systemSource).not.toContain('playerLabel="Player+ development path"')
    expect(systemSource).not.toContain('Printable + My Lab companion')
    expect(systemSource).not.toContain('Print Workbook')
    expect(systemSource).not.toContain('Standalone workbook. Player+ connected path.')
    expect(systemSource).not.toContain('Standalone workbook. {playerTier.name} connected path.')
    expect(systemSource).not.toContain('Print guide first. Connected Level Up second.')
    expect(systemSource).not.toContain('What ${playerTier.name} adds to this workbook')
    expect(systemSource).not.toContain('when Player+ access is active')
    expect(systemSource).not.toContain('The paper guide stands on its own. Player+ unlocks the connected layer')
    expect(systemSource).not.toContain('Player+ turns each phase into tracked goals')
    expect(systemSource).not.toContain('Player+ unlocks self-guided goals')
    expect(systemSource).toContain("const dataAssistPlayerDevelopmentHref = '/data-assist?intent=upload-source&context=Player%20development'")
    expect(systemSource).toContain('DATA_ASSIST_STORY.shortCue, dataAssistPlayerDevelopmentHref')
  })

  it('does not expose internal concept or planning language on public copy', () => {
    const combined = `${pageSource}\n${systemSource}\n${controlsSource}`.toLowerCase()

    for (const forbidden of [
      'design audit',
      'component plan',
      'implementation model',
      'asset list',
      'future tiq integration',
      'digital concept',
      'print concept preview',
      'paper system',
    ]) {
      expect(combined).not.toContain(forbidden)
    }
  })

  it('keeps workbook and coach planner pages practical enough to print and use', () => {
    for (const expected of [
      'TodayLessonSheet',
      'PlayerGoalCheckIn',
      'PlayerWeeklyActionPlan',
      'PlayerFocusDecisionPage',
      'PlayerToolBeltMenu',
      'PlayerProgressionCard',
      'PlayerMatchOnePager',
      'PlayerSoloTraining',
      'PlayerPartnerTraining',
      'PlayerOffCourtTraining',
      'PlayerPerformanceUpgrade',
      'PlayerAtHomePerformanceTraining',
      'PlayerLiveWorkbench',
      'ModuleTestCard',
      'CoachReadinessAdapter',
      'CoachProgressionRules',
      'CoachOneHourPlans',
      'QuickRatingStrip',
      'HabitRewardStrip',
      'CodexAssistBox',
      'PlayerMissionDashboard',
    ]) {
      expect(systemSource).toContain(expected)
    }

    expect(systemSource).toContain('Start Level Up')
    expect(systemSource).toContain('Open phone drill mode')
    expect(systemSource).toContain('/player-development/${identity.slug}/level-up')
    expect(systemSource).toContain("focus === 'workbook' ? <WorkbookPreview")
    expect(systemSource).toContain("focus === 'coach' ? <CoachPlannerPreview")
    expect(systemSource).not.toContain('<ReusableSheets identity={identity} />')
    expect(systemSource).toContain('LevelUpOverviewPanel')
    expect(systemSource).toContain('Open Level Up Portal')
    expect(systemSource).toContain('Coach handoff')
    expect(systemSource).toContain('One week. One habit. One proof note.')
    expect(systemSource).toContain('Pick the tool that solves this week')
    expect(systemSource).toContain('This is a tool belt.')
    expect(systemSource).toContain('Offense-neutral-defense rally')
    expect(systemSource).toContain('Defense')
    expect(systemSource).toContain('Neutral')
    expect(systemSource).toContain('Offense')
    expect(systemSource).toContain('Performance Upgrade')
    expect(systemSource).toContain('Level up the engine that supports your game.')
    expect(systemSource).toContain('At-home performance')
    expect(systemSource).toContain('id="solo-training"')
    expect(systemSource).toContain('id="partner-training"')
    expect(systemSource).toContain('id="off-court-work"')
    expect(trainingMenusSource).toContain('Jump rope rhythm builder')
    expect(trainingMenusSource).toContain('Cone recover + shadow swing')
    expect(trainingMenusSource).toContain('wall sit')
    expect(trainingMenusSource).toContain('Post-play mobility reset')
    expect(systemSource).toContain('Reward the habit')
    expect(systemSource).toContain('Cue')
    expect(systemSource).toContain('Routine')
    expect(systemSource).toContain('Track')
    expect(systemSource).toContain('Know when to repeat, progress, or test in a match')
    expect(systemSource).toContain('Use the same progression language as the player')
    expect(systemSource).toContain('Before, during, after')
    expect(systemSource).toContain('Adjust the lesson to how the player feels')
    expect(systemSource).toContain('Update coach assignment status')
    expect(systemSource).toContain('/mylab#coach-assignments')
    expect(systemSource).toContain('My Lab stores your status update; Coach Hub keeps the coach')
    expect(systemSource).toContain('The print backup can guide the lesson on paper.')
    expect(systemSource).toContain('Build the tactic board')
    expect(systemSource).toContain('Turn the Level Up cue into a visual point plan in TIQ Tactical Studio')
    expect(systemSource).toContain("href={`/player-development/${identity.slug}/level-up`}")
    expect(systemSource).not.toContain("href={`/player-development/${identity.slug}/workbook#module-${week.week}`}")
    expect(systemSource).toContain('data-core-page')
    expect(controlsSource).toContain('Print quick backup')
    expect(controlsSource).toContain('Coach backup')
    expect(systemSource).toContain('One-hour lesson plans: Modules 1-4')
    expect(systemSource).toContain('One-hour lesson plans: Modules 5-8')
    expect(systemSource).toContain('Coach lesson support proof cue')
    expect(systemSource).toContain('Prove the lesson supports the player path.')
    expect(systemSource).toContain('Player identity')
    expect(systemSource).toContain('Readiness adapter')
    expect(systemSource).toContain('One-hour plan')
    expect(systemSource).toContain('Level Up handoff')
    expect(systemSource).toContain('Level Up assignment handoff')
    expect(systemSource).toContain('End with one card, one proof standard, and one review cue.')
    expect(systemSource).toContain('Send the player into Level Up with a 0-5 proof rating')
    expect(systemSource).toContain('Open Level Up path')
    expect(systemSource).toContain('coachLevelUpHandoff')
    expect(systemSource).toContain('coachLessonSupportProof')
    expect(systemSource).toContain('turn each player path module into one private lesson')
    expect(systemSource).toContain('Start from the player path: goal, work, proof, next step.')
    expect(systemSource).toContain('The player path and lesson plan should agree on the next move.')
    expect(systemSource).not.toContain('turn each workbook module into one private lesson')
    expect(systemSource).not.toContain('Start from the player workbook: goal, work, proof, next step.')
    expect(systemSource).not.toContain('The player workbook and lesson plan should agree on the next move.')
    expect(stylesSource).toContain('.coachLessonSupportProof')
    expect(stylesSource).toContain('.coachLessonSupportProofGrid')
    expect(stylesSource).toContain('.coachLessonSupportProofGrid article')
    expect(stylesSource).toContain('.coachLevelUpHandoff')
    expect(systemSource).not.toContain('Green-yellow-red rally')
    expect(systemSource).not.toContain('earned green balls')
    expect(systemSource).not.toContain('BodyToolkit')
    expect(systemSource).not.toContain('Body Toolbelt')
    expect(liveWorkbenchSource).toContain('Level Up')
    expect(liveWorkbenchSource).toContain('What do you want to level up right now?')
    expect(liveWorkbenchSource).toContain('Access path')
    expect(liveWorkbenchSource).toContain('Included through your coach')
    expect(liveWorkbenchSource).toContain('Full self-guided Level Up')
    expect(liveWorkbenchSource).toContain('Coach-invited players get assigned Level Up work through the coach tier.')
    expect(liveWorkbenchSource).toContain('On court')
    expect(liveWorkbenchSource).toContain('Off court: mind')
    expect(liveWorkbenchSource).toContain('Start activity')
    expect(liveWorkbenchSource).toContain('DrillTimer')
    expect(liveWorkbenchSource).toContain('Timer')
    expect(liveWorkbenchSource).toContain('Coach challenge')
    expect(liveWorkbenchSource).toContain('Training alone')
    expect(liveWorkbenchSource).toContain('Share this recap with my coach when linked')
    expect(liveWorkbenchSource).toContain('How do you feel right now?')
    expect(liveWorkbenchSource).toContain('Tight')
    expect(liveWorkbenchSource).toContain('Saved')
    expect(liveWorkbenchSource).toContain('Repeat')
    expect(liveWorkbenchSource).toContain('Turn on-court logs into a shared development plan.')
    expect(liveWorkbenchSource).toContain('Lesson calendar reminders')
    expect(liveWorkbenchSource).toContain('Score and save.')
    expect(liveWorkbenchSource).toContain('Over / under')
    expect(liveWorkbenchSource).toContain('window.localStorage')
    expect(liveWorkbenchSource).toContain('tenaceiq:level-up')
    expect(existsSync(join(process.cwd(), 'scripts/verify-player-development-print.mjs'))).toBe(true)
  })
})
