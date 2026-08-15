import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function source(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

describe('privileged maintenance routes', () => {
  it.each([
    'app/api/import/auto/route.ts',
    'app/api/ratings/recalculate/route.ts',
  ])('requires verified platform admin access before using service credentials: %s', (path) => {
    const route = source(path)
    expect(route).toContain('getAdminApiAuth(request)')
    expect(route.indexOf('getAdminApiAuth(request)')).toBeLessThan(route.indexOf('createServerSupabaseClient()'))
  })

  it('does not expose auto-import through wildcard CORS', () => {
    expect(source('app/api/import/auto/route.ts')).not.toContain("'Access-Control-Allow-Origin': '*'")
  })
})
