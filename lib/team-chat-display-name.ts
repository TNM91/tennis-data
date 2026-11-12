export const teamChatDisplayNameLimit = 48

export function readTeamChatDisplayName(value: unknown): string | undefined {
  if (typeof value !== 'string' || /[\p{Cc}\u202a-\u202e\u2066-\u2069@]/u.test(value)) return undefined
  const name = value.trim()
  if (Array.from(name).length <= teamChatDisplayNameLimit) return name
}
