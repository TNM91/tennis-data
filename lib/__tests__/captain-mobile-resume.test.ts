import { describe, expect, it } from 'vitest'
import { captainMobileResumeKey, readCaptainMobileResume, shouldRefreshCaptainMessageDraft } from '@/lib/captain-mobile-resume'

const scope = ['Court Aces', 'USTA', '4.0', '2026-10-10', 'Baseline Crew']
const snapshot = { version: 1, savedAt: 1000, scrollY: 620, disclosures: [{ key: 'Message tools', open: true }], data: { messageBody: 'My edited draft', selectedRecipientIds: ['alex'] } }
describe('Captain mobile session recovery', () => {
  it('isolates captains, tools, teams, leagues, flights, dates, and opponents', () => {
    const key = captainMobileResumeKey('captain-a', 'messaging', scope)
    expect(captainMobileResumeKey('captain-b', 'messaging', scope)).not.toBe(key)
    expect(captainMobileResumeKey('captain-a', 'lineup', scope)).not.toBe(key)
    scope.forEach((_, index) => expect(captainMobileResumeKey('captain-a', 'messaging', scope.map((part, i) => i === index ? `${part}-other` : part))).not.toBe(key))
  })
  it('does not save unscoped or signed-out recovery state', () => {
    expect(captainMobileResumeKey('', 'messaging', scope)).toBe('')
    expect(captainMobileResumeKey('captain-a', 'messaging', ['', 'USTA', '4.0', ''])).toBe('')
  })
  it('recovers edited text, recipients, disclosures, and position', () => {
    expect(readCaptainMobileResume(JSON.stringify(snapshot), 2000)).toEqual(snapshot)
  })
  it.each([null, '{invalid', JSON.stringify({ ...snapshot, version: 2 }), JSON.stringify({ ...snapshot, scrollY: -1 }), JSON.stringify({ ...snapshot, disclosures: [{ open: 'yes' }] }), JSON.stringify({ ...snapshot, data: [] })])('ignores malformed state: %s', (raw) => {
    expect(readCaptainMobileResume(raw, 2000)).toBeNull()
  })
  it('expires old state and rejects timestamps in the future', () => {
    expect(readCaptainMobileResume(JSON.stringify(snapshot), 86_402_000)).toBeNull()
    expect(readCaptainMobileResume(JSON.stringify(snapshot), 500)).toBeNull()
  })
  it('refreshes untouched previews while preserving body edits, title edits, and cleared drafts', () => {
    const input = { scope: 'match-a', body: 'Generated text', title: 'Lineup', previous: { scope: 'match-a', body: 'Generated text', title: 'Lineup' }, restoredScope: '', templateId: '' }
    expect(shouldRefreshCaptainMessageDraft(input)).toBe(true)
    for (const changes of [{ body: 'My edits' }, { body: '' }, { title: 'My private title' }, { restoredScope: 'match-a' }, { templateId: 'saved-template' }]) expect(shouldRefreshCaptainMessageDraft({ ...input, ...changes })).toBe(false)
    expect(shouldRefreshCaptainMessageDraft({ ...input, scope: 'match-b', body: 'My edits' })).toBe(true)
  })
})
