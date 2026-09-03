import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const coachSource = readFileSync(join(process.cwd(), 'app/coach/page.tsx'), 'utf8')
const launchSource = readFileSync(join(process.cwd(), 'app/components/coach-launch-path.tsx'), 'utf8')

describe('coach launch surface', () => {
  it('puts one compact first-win path ahead of the deeper Coach tools', () => {
    expect(coachSource).toContain("import CoachLaunchPath from '@/app/components/coach-launch-path'")
    expect(coachSource).toContain('getCoachLaunchProgress({')
    expect(coachSource).toContain('<CoachLaunchPath progress={coachLaunchProgress} />')
    expect(coachSource).toContain('showSteps={false}')
    expect(launchSource).toContain('Turn one lesson into a clear player loop.')
    expect(launchSource).toContain('Coach trophy earned')
    expect(launchSource).toContain("href: '#coach-student-board'")
    expect(launchSource).toContain("href: '#coach-lesson-frame'")
    expect(launchSource).toContain("href: '#coach-linked-dashboard'")
    expect(launchSource).toContain('minmax(min(100%, 185px), 1fr)')
  })
})
