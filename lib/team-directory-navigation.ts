const DIRECTORY_PATHS = new Set(['/teams', '/explore/teams'])
const DIRECTORY_PARAMS = ['q', 'league', 'flight', 'season', 'sort', 'browse', 'show']

export function getTeamDirectoryReturnHref(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/explore/teams'
  try {
    const url = new URL(value, 'https://www.tenaceiq.com')
    if (url.origin !== 'https://www.tenaceiq.com' || !DIRECTORY_PATHS.has(url.pathname)) return '/explore/teams'
    const params = new URLSearchParams()
    for (const key of DIRECTORY_PARAMS) {
      const entry = url.searchParams.get(key)
      if (entry) params.set(key, entry.slice(0, 300))
    }
    return `${url.pathname}${params.size ? `?${params}` : ''}`
  } catch {
    return '/explore/teams'
  }
}
