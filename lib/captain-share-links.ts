export const CAPTAIN_SHARE_KINDS = [
  'lineup',
  'final-result',
  'availability',
  'practice',
  'live-scorecard',
  'team-room',
  'team-invite',
] as const

export type CaptainShareKind = (typeof CAPTAIN_SHARE_KINDS)[number]

export type CaptainShareLink = {
  token: string
  kind: CaptainShareKind
  targetHref: string
  teamName: string
  opponent: string
  matchDate: string
  detail: string
  expiresAt: string
}

export type CreateCaptainShareLinkInput = Omit<CaptainShareLink, 'token' | 'expiresAt'>

const SHARE_LABELS: Record<CaptainShareKind, string> = {
  lineup: 'Projected lineup',
  'final-result': 'Final result',
  availability: 'Availability check',
  practice: 'Practice plan',
  'live-scorecard': 'Live scorecard',
  'team-room': 'Team Room',
  'team-invite': 'Team invitation',
}

export function isCaptainShareKind(value: unknown): value is CaptainShareKind {
  return typeof value === 'string' && CAPTAIN_SHARE_KINDS.includes(value as CaptainShareKind)
}

export function getCaptainShareLabel(share: Pick<CaptainShareLink, 'kind' | 'detail'>) {
  if (share.kind === 'lineup' && /\bconfirmed\b/i.test(share.detail)) return 'Confirmed lineup'
  return SHARE_LABELS[share.kind]
}

export function getCaptainShareTitle(
  share: Pick<CaptainShareLink, 'kind' | 'detail' | 'teamName' | 'opponent'>,
) {
  const label = getCaptainShareLabel(share)
  const matchup = [share.teamName || 'Your team', share.opponent ? `vs ${share.opponent}` : '']
    .filter(Boolean)
    .join(' ')
  return `${label}: ${matchup}`
}

export function getCaptainShareDescription(
  share: Pick<CaptainShareLink, 'kind' | 'detail' | 'teamName' | 'opponent' | 'matchDate'>,
) {
  const label = getCaptainShareLabel(share)
  const context = [share.matchDate, share.opponent ? `vs ${share.opponent}` : '', share.detail]
    .filter(Boolean)
    .join(' · ')
  return `${label} for ${share.teamName || 'your team'}${context ? ` · ${context}` : ''}. Open the TenAceIQ match-week update.`
}

export async function createCaptainShareLink(
  accessToken: string,
  input: CreateCaptainShareLinkInput,
) {
  const response = await fetch('/api/captain/share-links', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })
  const payload = await response.json() as { ok?: boolean; shareUrl?: string; message?: string }
  if (!response.ok || !payload.ok || !payload.shareUrl) {
    throw new Error(payload.message || 'The share preview could not be prepared.')
  }
  return payload.shareUrl
}
