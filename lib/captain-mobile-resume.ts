export type CaptainMobileResume = {
  version: 1
  savedAt: number
  scrollY: number
  disclosures: Array<{ key: string; open: boolean }>
  data: Record<string, unknown>
}

export function captainMobileResumeKey(userId: string | null | undefined, tool: string, scope: string[]) {
  if (!userId || !scope[0]?.trim() || !scope[3]?.trim()) return ''
  return `tiq:captain-mobile-resume:${JSON.stringify([userId, tool, ...scope.map((part) => part.trim())])}`
}

export function readCaptainMobileResume(raw: string | null, now = Date.now()): CaptainMobileResume | null {
  try {
    const value = JSON.parse(raw || 'null') as CaptainMobileResume | null
    if (!value || value.version !== 1 || !Number.isFinite(value.savedAt) || value.savedAt > now || now - value.savedAt > 86_400_000
      || !Number.isFinite(value.scrollY) || value.scrollY < 0 || !Array.isArray(value.disclosures)
      || !value.disclosures.every((item) => item && typeof item.key === 'string' && typeof item.open === 'boolean')
      || !value.data || typeof value.data !== 'object' || Array.isArray(value.data)) return null
    return value
  } catch { return null }
}

export function shouldRefreshCaptainMessageDraft({ scope, body, title, previous, restoredScope, templateId }: {
  scope: string
  body: string
  title: string
  previous: { scope: string; body: string; title: string } | null
  restoredScope: string
  templateId: string
}) {
  return restoredScope !== scope && !templateId
    && (!previous || previous.scope !== scope || (body === previous.body && title === previous.title))
}
