import { describe, expect, it } from 'vitest'
import { calculateLiveNetwork, applyLiveNetworkPlayers, retainPreNetworkHistory } from '../tiq-live-network'
import { getTiqEvidence } from '../tiq-rating-evidence'
import type { WorkingPlayer } from '../recalculateRatings'
const player = (id: string): WorkingPlayer => ({ id, name: id, hasVerifiedBaseline: true, baselineSource: 'verified', singlesBase: 4, doublesBase: 4, overallBase: 4, singlesDynamic: 2.2, doublesDynamic: 2.3, overallDynamic: 2.4, singlesUstaDynamic: 4, doublesUstaDynamic: 4, overallUstaDynamic: 4, singlesMatchesProcessed: 0, doublesMatchesProcessed: 0, overallMatchesProcessed: 0, matchesProcessed: 0, lastMatchDate: null })
describe('one current TIQ methodology', () => {
 it('replaces legacy values for provisional and reviewed players without making snapshots', () => {
  const evidence = { season: 2026, priors: new Map([['a', 4.5]]), excluded: new Set(['b']) }
  const result = calculateLiveNetwork({ ...evidence, cutoff: '2026-10-04', matches: [], participants: [], conflictedMatches: new Set() })
  const [a,b] = applyLiveNetworkPlayers([player('a'),player('b')], result, evidence)
  expect(a.overallDynamic).toBe(4.75)
  expect(a.tiqEvidence?.status).toBe('provisional')
  expect(b.tiqEvidence?.status).toBe('review')
  expect(b.overallDynamic).toBe(4.25)
  expect(result.snapshots).toEqual([])
 })
 it('labels unrated formats provisional even when overall is current', () => {
  const p = { tiq_rating_status: 'current' as const, tiq_rating_model: 'tiq-network-1.4', tiq_rating_season: 2026, tiq_doubles_matches: 31, tiq_singles_matches: 0 }
  expect(getTiqEvidence(p,'overall',2026)).toMatchObject({status:'current',matches:31})
  expect(getTiqEvidence(p,'singles',2026).status).toBe('provisional')
  expect(getTiqEvidence(p,'doubles',2027).status).toBe('unknown')
  expect(getTiqEvidence({...p,tiq_rating_status:'review'},'overall',2026).status).toBe('review')
 })
})

it('removes current legacy TIQ for every player while preserving older seasons and separate tracks', () => {
 const row = { player_id: 'excluded', match_id: 'court', snapshot_date: '2026-04-01', rating_type: 'overall' as const, track: 'tiq' as const, dynamic_rating: 3.9, delta: 0, opponent_rating: 4, win_probability: 50, multiplier: 1 }
 const usta = { ...row, track: 'usta' as const }, past = { ...row, snapshot_date: '2025-12-01' }
 expect(retainPreNetworkHistory([row, usta, past],2026)).toEqual([usta,past])
})

it('publishes network strength for a rated format and a clean starting estimate for the other format', () => {
 const evidence = { season: 2026, priors: new Map([['a', 4]]), excluded: new Set<string>() }
 const result = calculateLiveNetwork({ ...evidence, cutoff: '2026-10-04', matches: [{ id:'one', match_date:'2026-04-01', match_type:'singles', score:'6-4 6-4', winner_side:'A', match_source:'usta', rating_eligible:true, league_name:'2026 Adult 18+ 4.0' }], participants: [{match_id:'one',player_id:'a',side:'A'},{match_id:'one',player_id:'b',side:'B'}], conflictedMatches:new Set() })
 const [a] = applyLiveNetworkPlayers([player('a')],result,evidence)
 expect(a.overallDynamic).toBe(a.singlesDynamic)
 expect(a.doublesDynamic).toBe(4.25)
 expect(a.tiqEvidence).toMatchObject({status:'current',singlesMatches:1,doublesMatches:0})
})
