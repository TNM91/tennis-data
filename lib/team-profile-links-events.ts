export const TEAM_CONNECTIONS_CHANGED_EVENT = 'tenaceiq:team-connections-changed'

export function notifyTeamConnectionsChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(TEAM_CONNECTIONS_CHANGED_EVENT))
}

export function subscribeToTeamConnectionsChanged(listener: () => void) {
  if (typeof window === 'undefined') return () => undefined
  window.addEventListener(TEAM_CONNECTIONS_CHANGED_EVENT, listener)
  return () => window.removeEventListener(TEAM_CONNECTIONS_CHANGED_EVENT, listener)
}
