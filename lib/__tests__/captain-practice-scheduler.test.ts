import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Captain practice scheduler', () => {
  it('surfaces practice coordination as a Captain workspace page', () => {
    const source = readFileSync(join(process.cwd(), 'app/captain/practice/page.tsx'), 'utf8')

    expect(source).toContain('Plan practice without a separate thread.')
    expect(source).toContain('Practice scheduler setup')
    expect(source).toContain('ScheduleMessageComposer')
    expect(source).toContain('mode="captain-practice"')
    expect(source).toContain('triggerLabel="Schedule practice"')
    expect(source).toContain('defaultNotes={practiceNotes}')
    expect(source.indexOf('aria-label="Practice scheduler setup"')).toBeLessThan(
      source.indexOf('Plan practice without a separate thread.'),
    )
    expect(source).toContain("router.replace('/login?plan=captain&next=%2Fcaptain%2Fpractice')")
    expect(source).toContain('Unlock practice coordination with Captain')
  })

  it('uses the existing practice scheduling foundation instead of a separate workflow', () => {
    const composer = readFileSync(join(process.cwd(), 'app/components/schedule-message-composer.tsx'), 'utf8')
    const scheduling = readFileSync(join(process.cwd(), 'lib/internal-scheduling.ts'), 'utf8')

    expect(composer).toContain('defaultNotes')
    expect(composer).toContain('createCaptainPracticeThread')
    expect(scheduling).toContain("eventType: 'captain_practice'")
    expect(scheduling).toContain('Please mark In, Out, or Maybe')
  })
})
