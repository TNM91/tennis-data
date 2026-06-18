import { describe, expect, it } from 'vitest'
import {
  COACH_INTEGRATION_STEPS,
  COACH_LESSON_BLOCKS,
  COACH_SESSION_PRESETS,
  COACH_WORKSPACE_COMMANDS,
  buildCoachStudentSnapshots,
  buildSessionPresetAssignment,
  getCoachPlannerHref,
  getCoachSessionPreset,
} from '../coach-workspace'

describe('coach workspace model', () => {
  it('keeps the core coach workflow connected to product routes', () => {
    expect(COACH_WORKSPACE_COMMANDS.map((command) => command.href)).toEqual([
      '/player-development/relentless-competitor-4-0/coach-planner',
      '/tactics',
      '/messages?compose=direct&subject=Coach%20assignment%20follow-up&body=Here%27s%20the%20assignment%20from%20today%27s%20lesson%3A%20',
      '/messages?compose=direct&subject=Next%20lesson%20schedule&body=Let%27s%20confirm%20the%20next%20lesson.%20Date%2Ftime%3A%20%20Site%3A%20%20Focus%3A%20',
    ])
  })

  it('builds student snapshots from reusable development identities', () => {
    const students = buildCoachStudentSnapshots()

    expect(students).toHaveLength(3)
    expect(students[0]).toMatchObject({
      identitySlug: 'relentless-competitor-4-0',
      identity: 'The Relentless Competitor',
      status: 'Needs assignment',
    })
    expect(students[1]).toMatchObject({
      identitySlug: 'smart-attacker-4-0-to-4-5',
      identity: 'The Smart Attacker',
      status: 'On track',
    })
  })

  it('uses a stable one-hour lesson frame', () => {
    expect(COACH_LESSON_BLOCKS.map((block) => block.minutes)).toEqual(['0-8', '8-22', '22-42', '42-55', '55-60'])
    expect(COACH_LESSON_BLOCKS.at(-1)?.title).toBe('Assignment')
  })

  it('keeps coach session presets practical and Player ready', () => {
    expect(COACH_SESSION_PRESETS.map((preset) => preset.id)).toEqual([
      'serve-plus-one-pressure',
      'relentless-movement-repeat',
      'attackable-ball-filter',
    ])
    for (const preset of COACH_SESSION_PRESETS) {
      expect(preset.objective).toContain('.')
      expect(preset.drill.length).toBeGreaterThan(30)
      expect(preset.pressureGame.length).toBeGreaterThan(30)
      expect(preset.playerPlusPrompt).toMatch(/Log|Save|Track/)
    }
    expect(getCoachSessionPreset('missing').id).toBe('serve-plus-one-pressure')
  })

  it('turns a session preset into assignment-ready Player follow-through', () => {
    expect(buildSessionPresetAssignment('relentless-movement-repeat')).toMatchObject({
      title: 'Relentless movement repeat',
      focus: 'Stay in motion between shots, split on opponent contact, and recover without panic.',
      tracker: [
        'Objective completed with clear scoring standard',
        'Pressure game result recorded',
        'Player prompt answered before next session',
      ],
    })
    expect(buildSessionPresetAssignment('relentless-movement-repeat').detail).toContain('Live-ball movement chain')
    expect(buildSessionPresetAssignment('relentless-movement-repeat').prompt).toContain('Save three fatigue cues')
  })

  it('documents Player, Coach, Captain, and Full-Court integration', () => {
    expect(COACH_INTEGRATION_STEPS.map((step) => step.label)).toEqual(['Player link', 'Coach', 'Captain', 'Full-Court'])
    expect(COACH_INTEGRATION_STEPS.at(-1)?.value).toBe('Lessons, teams, leagues, and events')
    expect(COACH_INTEGRATION_STEPS.map((step) => step.value).join(' ')).not.toContain('Everything unlocked')
  })

  it('builds coach planner routes by identity slug', () => {
    expect(getCoachPlannerHref('smart-attacker-4-0-to-4-5')).toBe('/player-development/smart-attacker-4-0-to-4-5/coach-planner')
  })
})
