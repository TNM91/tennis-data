import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function source(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

describe('Coach Hub naming', () => {
  it('uses Coach Hub on visible coach workspace entry points', () => {
    const coachPage = source('app/coach/page.tsx')
    const messagesPage = source('app/messages/page.tsx')
    const loginPage = source('app/login/page.tsx')
    const portal = source('app/components/portal-tool-bar.tsx')
    const coachInvite = source('app/coach/invite/[token]/page.tsx')

    expect(coachPage).toContain('Could not load Coach Hub.')
    expect(coachPage).toContain('Coach Hub brings lesson plans')
    expect(coachPage).toContain('<div style={eyebrowStyle}>Coach Hub</div>')
    expect(coachPage).toContain('COACH_REVIEW_PROOF_SYNC_STEPS')
    expect(coachPage).toContain('aria-label="Coach review proof sync cue"')
    expect(coachPage).toContain('Coach review proof sync cue')
    expect(coachPage).toContain('Synced Level Up proof is coach-visible here.')
    expect(coachPage).toContain('If the player only saved locally, it will stay off this review queue until sync succeeds.')
    expect(coachPage).toContain('type="datetime-local"')
    expect(coachPage).toContain("calendarLayer: 'coach_student_lesson'")
    expect(coachPage).toContain('lessonLocation')
    expect(coachPage).toContain('Add to calendar')
    expect(coachPage).toContain('toWebcalUrl')
    expect(coachPage).toContain('/api/coach/student-calendar-links')
    expect(coachPage).toContain('calendarFeedStatusByStudentId')
    expect(coachPage).toContain('selectedCalendarSubscribed')
    expect(coachPage).toContain('Replace link')
    expect(coachPage).toContain('Coach + student lessons.')
    expect(coachPage).toContain('sharedLessonCalendarEvents')
    expect(coachPage).toContain('/api/coach/student-calendar-links')
    expect(coachPage).toContain('Create subscribe link')
    expect(coachPage).toContain('Revoke feed')
    expect(coachPage).toContain('revokeStudentCalendarLink')
    expect(coachPage).toContain('Synced proof')
    expect(coachPage).toContain('Local boundary')
    expect(coachPage).toContain('Next coach move')
    expect(coachPage).toContain('proofSourceCueStyle')
    expect(messagesPage).toContain('Open Coach Hub')
    expect(loginPage).toContain("destination: 'Coach Hub'")
    expect(portal).toContain("title: 'Coach Hub'")
    expect(coachInvite).toContain('message you from Coach Hub')
    expect(coachInvite).toContain('Linking proof')
    expect(coachInvite).toContain('Know what your coach can see.')
    expect(coachInvite).toContain('Accepting links this player account to this coach relationship.')
    expect(coachInvite).toContain('Private local-only Level Up logs stay off the coach review queue until the player syncs or shares them.')
    expect(coachInvite).toContain('Acceptance proof')
    expect(coachInvite).toContain('Confirm the link before testing assignments.')
    expect(coachInvite).toContain('Coach Hub shows the linked player before any assigned proof is reviewed.')
    expect(coachInvite).toContain('Coach invite account proof cue')
    expect(coachInvite).toContain('Account proof cue')
    expect(coachInvite).toContain('Confirm the account before accepting.')
    expect(coachInvite).toContain('Signed-in account:')
    expect(coachInvite).toContain('Acceptance check:')

    for (const text of [coachPage, messagesPage, loginPage, portal, coachInvite]) {
      expect(text).not.toContain('Coach workspace')
    }
  })
})
