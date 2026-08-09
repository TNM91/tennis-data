export const CLUB_COMMUNICATION_UPDATED_EVENT = 'tenaceiq:club-communication-updated'

export function notifyClubCommunicationUpdated() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(CLUB_COMMUNICATION_UPDATED_EVENT))
}
