import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(join(process.cwd(), 'app/player-development/page.tsx'), 'utf8')
const systemSource = readFileSync(join(process.cwd(), 'app/player-development/_components/player-development-system.tsx'), 'utf8')
const controlsSource = readFileSync(join(process.cwd(), 'app/player-development/_components/player-development-print-controls.tsx'), 'utf8')

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
      'PlayerMatchOnePager',
      'PlayerSoloTraining',
      'PlayerPartnerTraining',
      'PlayerOffCourtTraining',
      'ModuleTestCard',
      'CoachReadinessAdapter',
      'CoachOneHourPlans',
    ]) {
      expect(systemSource).toContain(expected)
    }

    expect(systemSource).toContain('One week. One habit. One proof note.')
    expect(systemSource).toContain('Pick the page that solves this week')
    expect(systemSource).toContain('Before, during, after')
    expect(systemSource).toContain('Adjust the lesson to how the player feels')
    expect(systemSource).toContain('data-core-page')
    expect(controlsSource).toContain('Print core workbook')
    expect(systemSource).toContain('One-hour lesson plans: Modules 1-4')
    expect(systemSource).toContain('One-hour lesson plans: Modules 5-8')
    expect(existsSync(join(process.cwd(), 'scripts/verify-player-development-print.mjs'))).toBe(true)
  })
})
