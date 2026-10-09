import type { ProductUsageEventInput } from './product-usage-events'

export function matchPrepActionEvent(action: 'resume_match_prep' | 'open_courtside'): ProductUsageEventInput {
  return {
    eventName: 'mylab_match_plan_action',
    surface: action === 'resume_match_prep' ? 'mylab' : 'matchup',
    metadata: { action, entryPoint: action === 'resume_match_prep' ? 'saved_prep' : 'courtside' },
  }
}

type PrepUsageRow = { event_name: string; metadata?: Record<string, unknown> | null }

// Counts actions in the supplied sample, not a conversion funnel or cloud-save proof.
export function summarizeMatchPrepUsage(events: PrepUsageRow[]) {
  let saves = 0, resumeClicks = 0, courtsideOpens = 0
  for (const event of events) {
    if (event.event_name === 'matchup_prep_saved') saves++
    if (event.event_name !== 'mylab_match_plan_action') continue
    if (event.metadata?.action === 'resume_match_prep') resumeClicks++
    if (event.metadata?.action === 'open_courtside') courtsideOpens++
  }
  return { saves, resumeClicks, courtsideOpens }
}
