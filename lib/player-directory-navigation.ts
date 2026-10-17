const DIRECTORY_PATHS = new Set(['/players', '/explore/players'])
const DIRECTORY_PARAMS = ['q', 'sort', 'filter', 'flight', 'browse', 'show']

export function getPlayerDirectoryReturnHref(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/explore/players'
  try {
    const url = new URL(value, 'https://www.tenaceiq.com')
    if (url.origin !== 'https://www.tenaceiq.com' || !DIRECTORY_PATHS.has(url.pathname)) return '/explore/players'
    const params = new URLSearchParams()
    for (const key of DIRECTORY_PARAMS) {
      const entry = url.searchParams.get(key)
      if (entry) params.set(key, entry.slice(0, 300))
    }
    const query = params.toString()
    const anchor = /^#player-[a-zA-Z0-9-]+$/.test(url.hash) ? url.hash : ''
    return `${url.pathname}${query ? `?${query}` : ''}${anchor}`
  } catch {
    return '/explore/players'
  }
}

export function buildDirectoryPlayerHref(playerId: string, directoryHref: string, showAll: boolean) {
  const url = new URL(getPlayerDirectoryReturnHref(directoryHref), 'https://www.tenaceiq.com')
  if (showAll) url.searchParams.set('show', 'all')
  url.hash = `player-${playerId}`
  const returnTo = `${url.pathname}${url.search}${url.hash}`
  return `/players/${encodeURIComponent(playerId)}?${new URLSearchParams({ returnTo })}`
}
