const WORKFLOW_RETURN_PREFIXES = [
  '/captain',
  '/coach',
  '/compete',
  '/league-coordinator',
  '/mylab',
  '/player-development',
  '/profile',
] as const

export function getSafeWorkflowReturnTo(value: string | null | undefined, fallback = '') {
  const path = (value || '').trim()
  if (!path || path.length > 500 || !path.startsWith('/') || path.startsWith('//')) return fallback
  return WORKFLOW_RETURN_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`))
    ? path
    : fallback
}

export function addWorkflowResult(href: string, result: string) {
  const safeHref = getSafeWorkflowReturnTo(href)
  if (!safeHref) return ''

  const hashIndex = safeHref.indexOf('#')
  const hash = hashIndex >= 0 ? safeHref.slice(hashIndex) : ''
  const pathAndQuery = hashIndex >= 0 ? safeHref.slice(0, hashIndex) : safeHref
  const queryIndex = pathAndQuery.indexOf('?')
  const path = queryIndex >= 0 ? pathAndQuery.slice(0, queryIndex) : pathAndQuery
  const params = new URLSearchParams(queryIndex >= 0 ? pathAndQuery.slice(queryIndex + 1) : '')
  params.set('setupResult', result.trim())
  return `${path}?${params.toString()}${hash}`
}

export function readWorkflowResult(searchParams: Pick<URLSearchParams, 'get'>) {
  return (searchParams.get('setupResult') || '').trim()
}

export function buildConsumedWorkflowHref(
  pathname: string,
  searchParams: Pick<URLSearchParams, 'toString'>,
  keys: readonly string[],
  hash = '',
) {
  const safePath = getSafeWorkflowReturnTo(pathname)
  if (!safePath) return ''

  const params = new URLSearchParams(searchParams.toString())
  for (const key of keys) params.delete(key)
  const safeHash = hash.startsWith('#') ? hash : ''
  return `${safePath}${params.size ? `?${params.toString()}` : ''}${safeHash}`
}

export function buildConsumedWorkflowResultHref(
  pathname: string,
  searchParams: Pick<URLSearchParams, 'toString'>,
  hash = '',
) {
  return buildConsumedWorkflowHref(pathname, searchParams, ['setupResult'], hash)
}
