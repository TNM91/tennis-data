import { describe, expect, it } from 'vitest'
import { describeClaimResult } from '@/lib/scorecard-claim-welcome'

describe('scorecard claim welcome', () => {
  it('shows the claimed player result and opposing doubles pair', () => {
    expect(describeClaimResult({
      winner_side: 'B',
      claim_player: [{ side: 'A' }],
      participants: [
        { side: 'A', players: { name: 'Claimed player' } },
        { side: 'A', players: { name: 'Partner' } },
        { side: 'B', players: { name: 'Opponent one' } },
        { side: 'B', players: [{ name: 'Opponent two' }] },
      ],
    })).toEqual({ outcome: 'Loss', opponents: ['Opponent one', 'Opponent two'] })
  })

  it('keeps a pending result neutral and avoids guessing opponents without a player side', () => {
    expect(describeClaimResult({
      winner_side: null,
      claim_player: [{ side: null }],
      participants: [{ side: 'B', players: { name: 'Other player' } }],
    })).toEqual({ outcome: 'Result', opponents: [] })
  })
})
