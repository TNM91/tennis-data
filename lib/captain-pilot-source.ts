export const CAPTAIN_PILOT_SOURCES = ['text', 'flyer', 'email', 'referral', 'direct'] as const

export type CaptainPilotSource = (typeof CAPTAIN_PILOT_SOURCES)[number]

export const CAPTAIN_PILOT_SOURCE_LABELS: Record<CaptainPilotSource, string> = {
  text: 'Text',
  flyer: 'Flyer / QR',
  email: 'Email',
  referral: 'Referral',
  direct: 'Direct',
}

export function normalizeCaptainPilotSource(value: unknown): CaptainPilotSource {
  if (typeof value !== 'string') return 'direct'
  const source = value.trim().toLowerCase().replace(/[\s_]+/g, '-')
  if (['text', 'sms', 'message', 'group-text'].includes(source)) return 'text'
  if (['flyer', 'qr', 'qr-code', 'club-flyer', 'print'].includes(source)) return 'flyer'
  if (['email', 'newsletter'].includes(source)) return 'email'
  if (['referral', 'refer', 'captain-referral', 'team-referral'].includes(source)) return 'referral'
  return 'direct'
}

export function getCaptainPilotSourceFromHref(href: string | null | undefined): CaptainPilotSource {
  if (!href) return 'direct'
  try {
    const url = new URL(href, 'https://www.tenaceiq.com')
    return normalizeCaptainPilotSource(
      url.searchParams.get('src')
      ?? url.searchParams.get('utm_source')
      ?? url.searchParams.get('source'),
    )
  } catch {
    return 'direct'
  }
}

export function buildCaptainPilotHref(source: CaptainPilotSource) {
  return source === 'direct' ? '/captain-pilot' : `/captain-pilot?src=${source}`
}
