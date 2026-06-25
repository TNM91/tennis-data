function normalizePath(value: string) {
  return value.split('?')[0].split('#')[0] || '/'
}

function getHash(value: string) {
  const hashIndex = value.indexOf('#')
  if (hashIndex === -1) return ''
  return value.slice(hashIndex).split('?')[0]
}

const taskAliases: Record<string, string[]> = {
  '/data-assist': ['/admin/data-assist'],
  '/messages': ['/messages'],
  '/captain/availability': ['/captain/lineup-availability'],
  '/captain/practice': ['/captain/practice'],
  '/captain/lineup-builder': ['/captain/lineup-projection', '/captain/scenario-builder'],
  '/captain/weekly-brief': ['/captain/analytics', '/captain/team-brief'],
  '/compete/schedule': ['/league-coordinator'],
  '/league-coordinator/results': ['/compete/results'],
  '/league-coordinator/individual-results': ['/compete/results'],
}

export function isPortalTaskActive(pathname: string, taskHref: string) {
  const current = normalizePath(pathname)
  const target = normalizePath(taskHref)
  const targetHash = getHash(taskHref)

  if (targetHash) return current === target && getHash(pathname) === targetHash

  if (current === target || current.startsWith(`${target}/`)) return true
  if (target === '/compete/schedule' && current.startsWith('/league-coordinator/tournaments')) return false
  if (taskAliases[target]?.some((path) => current === path || current.startsWith(`${path}/`))) return true

  if (target === '/explore/players' && (current === '/players' || current.startsWith('/players/'))) return true
  if (target === '/explore/teams' && (current === '/teams' || current.startsWith('/teams/'))) return true
  if (target === '/explore/leagues' && (current === '/leagues' || current.startsWith('/leagues/'))) return true
  if (target === '/explore/rankings' && current === '/rankings') return true

  return false
}
