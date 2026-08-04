export const PLATFORM_RESUME_UPDATED_EVENT = 'tenaceiq:resume-updated'

export type PlatformResumeSource =
  | 'captain'
  | 'coach'
  | 'improve'
  | 'compete'
  | 'explore'
  | 'league'
  | 'team-chat'
  | 'preferences'

export function notifyPlatformResumeUpdated(source: PlatformResumeSource) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(PLATFORM_RESUME_UPDATED_EVENT, { detail: { source } }))
}

export function getPlatformResumeCompletionMessage(actionLabel: string) {
  const messageByAction: Record<string, string> = {
    'Check replies': 'Reply follow-up cleared.',
    'Finish lineup': 'Lineup draft cleared.',
    'Send lineup': 'Lineup send cleared.',
    'Finish message': 'Message draft cleared.',
    'Finish assignment': 'Assignment draft cleared.',
    'Finish reply': 'Reply draft cleared.',
    'Finish training': 'Training draft cleared.',
    'Finish team result': 'Team result draft cleared.',
    'Finish player result': 'Player result draft cleared.',
    'Finish tournament': 'Tournament draft cleared.',
  }
  return messageByAction[actionLabel] || 'Work updated.'
}
