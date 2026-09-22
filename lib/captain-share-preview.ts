import type { Metadata } from 'next'

export const CAPTAIN_SHARE_KINDS = [
  'lineup',
  'final-result',
  'availability',
  'practice',
  'live-scorecard',
] as const

export type CaptainShareKind = (typeof CAPTAIN_SHARE_KINDS)[number]

type CaptainShareConfig = {
  eyebrow: string
  title: string
  description: string
  action: string
  accent: string
  secondaryAccent: string
}

const SHARE_CONFIG: Record<CaptainShareKind, CaptainShareConfig> = {
  lineup: {
    eyebrow: 'Captain lineup',
    title: 'Your lineup is ready',
    description: 'Open the court assignments, match details, and team conversation.',
    action: 'Open lineup',
    accent: '#9BE11D',
    secondaryAccent: '#C8F56B',
  },
  'final-result': {
    eyebrow: 'Final scorecard',
    title: 'The final result is in',
    description: 'Review every court, the final score, and the team recap.',
    action: 'Open final result',
    accent: '#60A5FA',
    secondaryAccent: '#93C5FD',
  },
  availability: {
    eyebrow: 'Availability check',
    title: 'Can you play?',
    description: 'Reply In, Out, or Maybe so your captain can build the lineup.',
    action: 'Reply now',
    accent: '#FACC15',
    secondaryAccent: '#FDE68A',
  },
  practice: {
    eyebrow: 'Practice RSVP',
    title: 'Are you in for practice?',
    description: 'See the practice details, who is coming, and claim your spot.',
    action: 'Open practice',
    accent: '#34D399',
    secondaryAccent: '#A7F3D0',
  },
  'live-scorecard': {
    eyebrow: 'Match day live',
    title: 'Follow the live scorecard',
    description: 'Open the active courts and keep up with the match as it happens.',
    action: 'Open live scorecard',
    accent: '#FB7185',
    secondaryAccent: '#FECDD3',
  },
}

export function isCaptainShareKind(value: string): value is CaptainShareKind {
  return CAPTAIN_SHARE_KINDS.includes(value as CaptainShareKind)
}

export function getCaptainShareConfig(kind: CaptainShareKind) {
  return SHARE_CONFIG[kind]
}

export function buildCaptainShareHref(input: {
  kind: CaptainShareKind
  targetHref: string
  teamName?: string | null
  opponent?: string | null
  matchDate?: string | null
  detail?: string | null
}) {
  const params = new URLSearchParams()
  params.set('to', safeCaptainShareTarget(input.targetHref))
  if (input.teamName?.trim()) params.set('team', input.teamName.trim())
  if (input.opponent?.trim()) params.set('opponent', input.opponent.trim())
  if (input.matchDate?.trim()) params.set('date', input.matchDate.trim())
  if (input.detail?.trim()) params.set('detail', input.detail.trim())
  return `/share/captain/${input.kind}?${params.toString()}`
}

export function safeCaptainShareTarget(value: string | null | undefined) {
  const candidate = value?.trim() || ''
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return '/team-room'
  return candidate
}

export function buildCaptainShareMetadata(input: {
  kind: CaptainShareKind
  teamName?: string
  opponent?: string
  detail?: string
  sharePath?: string
}): Metadata {
  const config = getCaptainShareConfig(input.kind)
  const matchup = [input.teamName, input.opponent ? `vs ${input.opponent}` : ''].filter(Boolean).join(' ')
  const title = matchup ? `${config.eyebrow}: ${matchup}` : config.title
  const description = input.detail?.trim() || config.description
  const path = safeCaptainSharePath(input.sharePath, input.kind)
  const image = `${path}/opengraph-image`
  const previewImage = `/share/captain/${input.kind}/opengraph-image`

  return {
    title: { absolute: `${title} | TenAceIQ` },
    description,
    robots: { index: false, follow: false },
    openGraph: {
      type: 'website',
      siteName: 'TenAceIQ',
      title,
      description,
      url: path,
      images: [{ url: input.sharePath ? previewImage : image, width: 1200, height: 630, alt: `${config.eyebrow} from TenAceIQ` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [input.sharePath ? previewImage : image],
    },
  }
}

function safeCaptainSharePath(value: string | undefined, kind: CaptainShareKind) {
  const candidate = value?.trim() || ''
  return candidate.startsWith('/') && !candidate.startsWith('//')
    ? candidate
    : `/share/captain/${kind}`
}

export async function createCaptainShortShareUrl(input: {
  kind: CaptainShareKind
  targetHref: string
  accessToken: string
  teamName?: string | null
  opponent?: string | null
  matchDate?: string | null
  detail?: string | null
}) {
  const response = await fetch('/api/captain/share-links', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.accessToken}`,
    },
    body: JSON.stringify(input),
  })
  const payload = await response.json().catch(() => null) as { shareUrl?: string; message?: string } | null
  if (!response.ok || !payload?.shareUrl) {
    throw new Error(payload?.message || 'The short share link could not be created.')
  }
  return payload.shareUrl
}
