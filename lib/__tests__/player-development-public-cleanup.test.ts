import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(join(process.cwd(), 'app/player-development/page.tsx'), 'utf8')
const systemSource = readFileSync(join(process.cwd(), 'app/player-development/_components/player-development-system.tsx'), 'utf8')
const controlsSource = readFileSync(join(process.cwd(), 'app/player-development/_components/player-development-print-controls.tsx'), 'utf8')
const liveWorkbenchSource = readFileSync(join(process.cwd(), 'app/player-development/_components/player-live-workbench.tsx'), 'utf8')
const trainingMenusSource = readFileSync(join(process.cwd(), 'lib/player-training-menus.ts'), 'utf8')

describe('Player Development public cleanup', () => {
  it('positions the public page as a workbook and coach-planner product story', () => {
    expect(pageSource).toContain('Printable workbook paths, coach planner sheets')
    expect(systemSource).toContain('Turn match goals into court work.')
    expect(systemSource).toContain('My Lab connection')
    expect(systemSource).toContain('Coach Hub assignments')
    expect(systemSource).toContain('Connected companion')
    expect(systemSource).toContain('Where the work gets saved')
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

    expect(systemSource).toContain('Start today&apos;s mission')
    expect(systemSource).toContain('Coach / Lesson Plan')
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
    expect(systemSource).toContain('data-core-page')
    expect(controlsSource).toContain('Print core workbook')
    expect(controlsSource).toContain('Coach section')
    expect(systemSource).toContain('One-hour lesson plans: Modules 1-4')
    expect(systemSource).toContain('One-hour lesson plans: Modules 5-8')
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
