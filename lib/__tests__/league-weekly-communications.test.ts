import { describe, expect, it } from 'vitest'
import { getWeeklyCommunicationRecipients } from '../league-weekly-communications'
import { buildLeagueWeeklyCourts } from '../league-weekly-format'

const entries = [
  { player_name: 'A', created_by_user_id: 'a' },
  { player_name: 'B', created_by_user_id: 'b' },
  { player_name: 'C', created_by_user_id: 'c' },
  { player_name: 'D', created_by_user_id: 'd' },
  { player_name: 'Guest', created_by_user_id: null },
]
const input = { entries, repliedNames: [' a ', 'b'], roster: ['B', 'C', 'D'], assignments: buildLeagueWeeklyCourts(['A', 'B', 'C', 'D'], {}) }

describe('weekly communication recipients', () => {
  it('reminds only linked members who have not replied, regardless of casing', () => {
    expect(getWeeklyCommunicationRecipients({ ...input, kind: 'reminder' })).toEqual(['c', 'd'])
  })
  it('limits confirmed roster and court notices to their actual players', () => {
    expect(getWeeklyCommunicationRecipients({ ...input, kind: 'roster' })).toEqual(['b', 'c', 'd'])
    expect(getWeeklyCommunicationRecipients({ ...input, kind: 'courts' })).toEqual(['a', 'b', 'c', 'd'])
    expect(getWeeklyCommunicationRecipients({ ...input, assignments: [], kind: 'courts' })).toEqual([])
  })
  it('deduplicates linked accounts and limits changes to affected players', () => {
    expect(getWeeklyCommunicationRecipients({ ...input, entries: [...entries, entries[0]], affectedNames: [' a ', 'B'], kind: 'change' })).toEqual(['a', 'b'])
    expect(getWeeklyCommunicationRecipients({ ...input, kind: 'change' })).toEqual([])
  })
})
