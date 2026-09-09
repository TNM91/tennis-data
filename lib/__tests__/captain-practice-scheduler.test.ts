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
    expect(source).toContain('triggerLabel="Review & send invite"')
    expect(source).toContain('defaultNotes={practiceNotes}')
    expect(source.indexOf('aria-label="Practice scheduler setup"')).toBeLessThan(
      source.indexOf('Plan practice without a separate thread.'),
    )
    expect(source).toContain('router.replace(`/login?plan=captain&next=${encodeURIComponent(returnTo)}`)')
    expect(source).toContain('Unlock practice coordination with Captain')
  })

  it('loads Captain scope and a one-time Level Up challenge into the practice form', () => {
    const source = readFileSync(join(process.cwd(), 'app/captain/practice/page.tsx'), 'utf8')

    expect(source).toContain("searchParams.get('team')")
    expect(source).toContain("searchParams.get('league')")
    expect(source).toContain("searchParams.get('flight')")
    expect(source).toContain('buildCaptainLevelUpChallenge')
    expect(source).toContain('incomingLevelUpChallenge ? `${incomingLevelUpChallenge.title}: ${incomingLevelUpChallenge.focus}`')
    expect(source).toContain("['levelUpChallenge', 'card']")
    expect(source).toContain('Challenge loaded')
    expect(source).toContain('Practice focus is filled in.')
  })

  it('uses the existing practice scheduling foundation instead of a separate workflow', () => {
    const composer = readFileSync(join(process.cwd(), 'app/components/schedule-message-composer.tsx'), 'utf8')
    const scheduling = readFileSync(join(process.cwd(), 'lib/internal-scheduling.ts'), 'utf8')
    const teams = readFileSync(join(process.cwd(), 'app/compete/teams/page.tsx'), 'utf8')
    const teamCard = readFileSync(join(process.cwd(), 'app/compete/teams/team-home-card.tsx'), 'utf8')
    const room = readFileSync(join(process.cwd(), 'app/team-room/page.tsx'), 'utf8')

    expect(composer).toContain('defaultNotes')
    expect(composer).toContain('createCaptainPracticeThread')
    expect(composer).toContain("action: 'send'")
    expect(composer).toContain('postedToTeamChat')
    expect(composer).toContain('Text group')
    expect(composer).toContain('View RSVPs')
    expect(scheduling).toContain("eventType: 'captain_practice'")
    expect(scheduling).toContain('Please mark In, Out, or Maybe')
    expect(scheduling).toContain('profileName')
    expect(teams).toContain("buildCaptainScopedHref('/captain/practice'")
    expect(teamCard).toContain('Plan practice')
    expect(room).toContain('<Link className={styles.quickButton} href={practiceHref}>Plan practice</Link>')
  })

  it('shows the captain who is coming without mixing replies from another scheduled event', () => {
    const messages = readFileSync(join(process.cwd(), 'app/messages/page.tsx'), 'utf8')

    expect(messages).toContain('const selectedScheduleResponses = useMemo(')
    expect(messages).toContain('response.eventId === selectedScheduleEvent.id')
    expect(messages).toContain('Practice roster')
    expect(messages).toContain('See every reply')
    expect(messages).toContain("practiceRosterGroups.get('in')")
  })
})
