export type RoleHomeResumeState = {
  href: string
  title: string
  detail: string
  icon: string
  contextValue: string
  updatedAt: string
}

const ROLE_HOME_RESUME_PREFIX = 'tenaceiq_role_home_resume_v1'
const ROLE_HOME_RESUME_EVENT = 'tenaceiq:role-home-resume'

export function getRoleHomeResumeStorageKey(resumeKey: string) {
  return `${ROLE_HOME_RESUME_PREFIX}:${normalizeResumeKey(resumeKey)}`
}

export function readRoleHomeResume(resumeKey: string): RoleHomeResumeState | null {
  return parseRoleHomeResumeSnapshot(getRoleHomeResumeSnapshot(resumeKey))
}

export function getRoleHomeResumeSnapshot(resumeKey: string) {
  if (typeof window === 'undefined' || !normalizeResumeKey(resumeKey)) return ''
  try {
    return window.localStorage.getItem(getRoleHomeResumeStorageKey(resumeKey)) || ''
  } catch {
    return ''
  }
}

export function parseRoleHomeResumeSnapshot(raw: string): RoleHomeResumeState | null {
  try {
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<RoleHomeResumeState>
    if (!isSafeRoleHomeHref(parsed.href) || !cleanText(parsed.title)) return null

    return {
      href: parsed.href!,
      title: cleanText(parsed.title),
      detail: cleanText(parsed.detail),
      icon: cleanText(parsed.icon),
      contextValue: cleanText(parsed.contextValue),
      updatedAt: cleanText(parsed.updatedAt),
    }
  } catch {
    return null
  }
}

export function subscribeToRoleHomeResume(resumeKey: string, onChange: () => void) {
  if (typeof window === 'undefined' || !normalizeResumeKey(resumeKey)) return () => undefined
  const storageKey = getRoleHomeResumeStorageKey(resumeKey)
  const handleStorage = (event: StorageEvent) => {
    if (event.key === storageKey) onChange()
  }
  const handleResume = (event: Event) => {
    if ((event as CustomEvent<{ storageKey?: string }>).detail?.storageKey === storageKey) onChange()
  }
  window.addEventListener('storage', handleStorage)
  window.addEventListener(ROLE_HOME_RESUME_EVENT, handleResume)
  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener(ROLE_HOME_RESUME_EVENT, handleResume)
  }
}

export function writeRoleHomeResume(
  resumeKey: string,
  state: Omit<RoleHomeResumeState, 'updatedAt'> & { updatedAt?: string },
) {
  if (typeof window === 'undefined' || !normalizeResumeKey(resumeKey) || !isSafeRoleHomeHref(state.href)) return

  try {
    window.localStorage.setItem(
      getRoleHomeResumeStorageKey(resumeKey),
      JSON.stringify({
        ...state,
        title: cleanText(state.title),
        detail: cleanText(state.detail),
        icon: cleanText(state.icon),
        contextValue: cleanText(state.contextValue),
        updatedAt: state.updatedAt || new Date().toISOString(),
      } satisfies RoleHomeResumeState),
    )
    window.dispatchEvent(new CustomEvent(ROLE_HOME_RESUME_EVENT, {
      detail: { storageKey: getRoleHomeResumeStorageKey(resumeKey) },
    }))
  } catch {
    // Resume is optional when browser storage is unavailable.
  }
}

export function isSafeRoleHomeHref(value: unknown): value is string {
  return typeof value === 'string'
    && value.startsWith('/')
    && !value.startsWith('//')
    && value.length <= 500
}

function normalizeResumeKey(value: string) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9_-]+/g, '-')
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}
