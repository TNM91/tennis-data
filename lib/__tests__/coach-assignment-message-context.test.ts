import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const coachSource = readFileSync(join(process.cwd(), 'app/coach/page.tsx'), 'utf8')
const myLabSource = readFileSync(join(process.cwd(), 'app/mylab/page.tsx'), 'utf8')
const messagesSource = readFileSync(join(process.cwd(), 'app/messages/page.tsx'), 'utf8')

describe('coach assignment message context', () => {
  it('passes assignment context from Coach and Player assignment cards into Messages', () => {
    for (const source of [coachSource, myLabSource]) {
      expect(source).toContain('assignmentId: assignment.id')
      expect(source).toContain('assignmentTitle: assignment.title')
      expect(source).toContain('assignmentFocus: assignment.focus')
      expect(source).toContain("params.set('assignmentId'")
      expect(source).toContain("params.set('assignmentTitle'")
      expect(source).toContain("params.set('assignmentFocus'")
    }
  })

  it('stores and displays assignment metadata on direct coach-player threads', () => {
    expect(messagesSource).toContain('PLAYER_TIER_NAME = MEMBERSHIP_TIERS.player_plus.name')
    expect(messagesSource).toContain('`${PLAYER_TIER_NAME} coach thread`')
    expect(messagesSource).toContain('`${PLAYER_TIER_NAME} coach check-in`')
    expect(messagesSource).toContain('quick {PLAYER_TIER_NAME} check-ins')
    expect(messagesSource).not.toContain('Player+ coach thread')
    expect(messagesSource).not.toContain('Player+ coach check-in')
    expect(messagesSource).not.toContain('quick Player+ check-ins')
    expect(messagesSource).toContain('assignmentId: searchParams.get')
    expect(messagesSource).toContain('assignmentTitle: searchParams.get')
    expect(messagesSource).toContain('assignmentFocus: searchParams.get')
    expect(messagesSource).toContain('metadata: {')
    expect(messagesSource).toContain('Assignment follow-up:')
  })

  it('links message context back to the exact assignment card when possible', () => {
    expect(coachSource).toContain('id={`coach-assignment-${assignment.id}`}')
    expect(myLabSource).toContain('id={`coach-assignment-${assignment.id}`}')
    expect(messagesSource).toContain('conversation.metadata.assignmentId')
    expect(messagesSource).toContain('#coach-assignment-')
    expect(messagesSource).toContain('return `/coach${assignmentAnchor}`')
    expect(messagesSource).toContain('return assignmentAnchor ? `/mylab${assignmentAnchor}` :')
  })
})
