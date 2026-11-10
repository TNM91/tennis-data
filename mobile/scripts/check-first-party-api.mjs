const base = 'https://www.tenaceiq.com/api/mobile/first-party/'
const probe = async (path, method = 'GET') => fetch(new URL(path, base), {
  method, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000),
})

const checks = [
  ['competitions?audience=public', 'GET', 200], ['tournaments', 'GET', 401],
  ['team-rooms', 'GET', 401], ['team-invites', 'POST', 401],
  ['calendar', 'GET', 401], ['updates', 'GET', 401],
]
const failures = (await Promise.all(checks.map(async ([path, method, status]) => {
  try {
    const response = await probe(path, method)
    if (response.status !== status) return `${path} returned HTTP ${response.status}`
    const data = await response.json()
    if (status === 200 && (data.ok !== true || data.releaseScope !== 'first-party') ||
        status === 401 && data.ok === true) return `${path} returned an unexpected response`
    if (['team-rooms', 'team-invites', 'calendar', 'updates'].includes(path) && data.releaseScope !== 'first-party') {
      return `${path} is missing its release scope`
    }
    return null
  } catch {
    return `${path} could not be verified`
  }
}))).filter(Boolean)
if (failures.length) throw Error(`First-party backend is unavailable at ${base}\n${failures.join('\n')}`)
console.log('The first-party app host returned the expected public and signed-out responses.')
