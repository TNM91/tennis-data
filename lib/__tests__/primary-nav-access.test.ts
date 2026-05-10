import { describe, expect, it } from 'vitest'
import { buildProductAccessState } from '../access-model'
import { getPrimaryNavLockedLabel, getPrimaryNavTarget } from '../primary-nav-access'

describe('primary nav access', () => {
  it('routes public locked tools through join with the required plan intent', () => {
    const access = buildProductAccessState('public')

    expect(getPrimaryNavTarget('/mylab', access, false)).toEqual({
      href: '/join?plan=player_plus&next=%2Fmylab',
      locked: true,
      requiredPlan: 'player_plus',
    })
  })

  it('routes signed-in locked tools through upgrade with the required plan intent', () => {
    const access = buildProductAccessState('member')

    expect(getPrimaryNavTarget('/league-coordinator', access, true)).toEqual({
      href: '/upgrade?plan=league&next=%2Fleague-coordinator',
      locked: true,
      requiredPlan: 'league',
    })
  })

  it('explains that a free account starts access before the paid plan activates', () => {
    expect(getPrimaryNavLockedLabel('Coordinator', 'league')).toBe(
      'Coordinator requires TIQ League Coordinator. Create a free account first, then activate TIQ League Coordinator.',
    )
  })
})
