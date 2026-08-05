import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildCaptainAvailabilityResponseSignature,
  CAPTAIN_AVAILABILITY_REFRESH_MS,
} from '../captain-availability-live'

const captainHomeSource = readFileSync(join(process.cwd(), 'app/captain/page.tsx'), 'utf8')
const availabilitySource = readFileSync(join(process.cwd(), 'app/captain/availability/page.tsx'), 'utf8')

describe('Captain availability live refresh', () => {
  it('builds a stable signature that changes with reply status or time', () => {
    const replies = [
      { player_id: 'player-2', player_name: 'Blair', status: 'maybe', responded_at: '2026-08-04T20:00:00.000Z' },
      { player_id: 'player-1', player_name: 'Alex', status: 'available', responded_at: '2026-08-04T19:00:00.000Z' },
    ]
    expect(buildCaptainAvailabilityResponseSignature(replies)).toBe(
      buildCaptainAvailabilityResponseSignature([...replies].reverse()),
    )
    expect(buildCaptainAvailabilityResponseSignature(replies)).not.toBe(
      buildCaptainAvailabilityResponseSignature([
        replies[0],
        { ...replies[1], status: 'unavailable' },
      ]),
    )
  })

  it('keeps polling light and limited to visible captain pages', () => {
    expect(CAPTAIN_AVAILABILITY_REFRESH_MS).toBe(15_000)
    for (const source of [captainHomeSource, availabilitySource]) {
      expect(source).toContain('document.visibilityState === \'visible\'')
      expect(source).toContain('CAPTAIN_AVAILABILITY_REFRESH_MS')
      expect(source).toContain("window.addEventListener('pageshow', refreshVisibleAvailability)")
      expect(source).toContain("window.addEventListener('focus', refreshVisibleAvailability)")
      expect(source).toContain("document.addEventListener('visibilitychange', refreshVisibleAvailability)")
      expect(source).toContain("'Updated just now'")
      expect(source).toContain("'Live replies'")
    }
  })

  it('uses the request id and guards overlapping Availability page reads', () => {
    expect(availabilitySource).toContain('new URLSearchParams({ requestId: availabilityRequestId })')
    expect(availabilitySource).toContain('availabilityRefreshInFlightRef.current === availabilityRequestId')
    expect(availabilitySource).toContain("cache: 'no-store'")
    expect(captainHomeSource).toContain('captainAvailabilityRequestInFlightRef.current === requestScope')
  })
})
