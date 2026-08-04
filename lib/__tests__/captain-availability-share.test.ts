import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildCaptainAvailabilityRequestMessage,
  formatCaptainAvailabilityDate,
} from '../captain-availability-share'

describe('captain availability share', () => {
  it('builds a short request with the complete match context', () => {
    const message = buildCaptainAvailabilityRequestMessage({
      teamName: 'Baseline Aces',
      opponentTeam: 'Net Results',
      matchDate: '2026-08-12',
      matchTime: '7:00 PM',
      facility: 'Riverside Tennis Center',
      requestUrl: 'https://tenaceiq.com/availability/request-token',
    })

    expect(message).toContain('Can you play?')
    expect(message).toContain('Baseline Aces vs Net Results - Wed, Aug 12 - 7:00 PM')
    expect(message).toContain('Location: Riverside Tennis Center')
    expect(message).toContain('Reply here: https://tenaceiq.com/availability/request-token')
    expect(message).toContain('No TIQ account is needed.')
  })

  it('keeps missing optional match details out of the request', () => {
    const message = buildCaptainAvailabilityRequestMessage({
      teamName: 'Baseline Aces',
      matchDate: '2026-08-12',
      requestUrl: '/availability/request-token',
    })

    expect(message).not.toContain('Location:')
    expect(message).not.toContain(' vs ')
    expect(message).not.toContain('undefined')
  })

  it('formats schedule dates without timezone drift', () => {
    expect(formatCaptainAvailabilityDate('2026-08-12')).toBe('Wed, Aug 12')
  })

  it('prepares the full roster and waits for the captain before sharing', () => {
    const source = readFileSync(join(process.cwd(), 'app/captain/availability/page.tsx'), 'utf8')

    expect(source).toContain(".from('team_roster_members')")
    expect(source).toContain("fetch('/api/captain/availability-requests', {")
    expect(source).toContain('invitedPlayers: players.map')
    expect(source).toContain("typeof navigator.share === 'function'")
    expect(source).toContain('await navigator.share')
    expect(source).toContain('Nothing is sent until you tap Share availability.')
    expect(source).not.toContain('setRequestSent(true)')
  })
})
