import { describe, expect, it } from 'vitest'
import { getCaptainLaunchProgress } from '../captain-launch-progress'

describe('Captain launch progress', () => {
  it('keeps a new Captain on the first unfinished launch action', () => {
    const progress = getCaptainLaunchProgress({
      hasPlayer: true,
      hasTeam: true,
      hasSchedule: false,
      hasContacts: false,
      hasOutreach: false,
    })

    expect(progress.completedCount).toBe(2)
    expect(progress.nextStep).toBe('schedule')
    expect(progress.isComplete).toBe(false)
  })

  it('earns the launch trophy only after the player outreach is started', () => {
    const progress = getCaptainLaunchProgress({
      hasPlayer: true,
      hasTeam: true,
      hasSchedule: true,
      hasContacts: true,
      hasOutreach: true,
    })

    expect(progress).toMatchObject({
      completedCount: 5,
      totalCount: 5,
      nextStep: 'complete',
      isComplete: true,
    })
  })
})
