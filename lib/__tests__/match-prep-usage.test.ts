import { describe, expect, it } from 'vitest'
import { matchPrepActionEvent, summarizeMatchPrepUsage } from '../match-prep-usage'
import { buildProductUsageEventInsert } from '../product-usage-events'

describe('match prep usage', () => {
  it('uses the existing authenticated event contract with categorical metadata only', () => {
    for (const action of ['resume_match_prep', 'open_courtside'] as const) {
      const event = matchPrepActionEvent(action)
      expect(buildProductUsageEventInsert('user', event)).toEqual({ user_id: 'user', event_name: 'mylab_match_plan_action', surface: action === 'resume_match_prep' ? 'mylab' : 'matchup', plan_id: null, metadata: { action, entryPoint: action === 'resume_match_prep' ? 'saved_prep' : 'courtside' } })
    }
  })
  it('counts repeated actions and legacy saves while ignoring unrelated or incomplete metadata', () => {
    expect(summarizeMatchPrepUsage([
      { event_name: 'matchup_prep_saved' },
      { event_name: 'mylab_match_plan_action', metadata: { action: 'resume_match_prep' } },
      { event_name: 'mylab_match_plan_action', metadata: { action: 'resume_match_prep' } },
      { event_name: 'mylab_match_plan_action', metadata: { action: 'open_courtside' } },
      { event_name: 'other', metadata: { action: 'open_courtside' } },
      { event_name: 'mylab_match_plan_action', metadata: null },
      { event_name: 'mylab_match_plan_action', metadata: { action: 'serve' } },
    ])).toEqual({ saves: 1, resumeClicks: 2, courtsideOpens: 1 })
  })
  it('returns zero for an empty sample', () => {
    expect(summarizeMatchPrepUsage([])).toEqual({ saves: 0, resumeClicks: 0, courtsideOpens: 0 })
  })
})
