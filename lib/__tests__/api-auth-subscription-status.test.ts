import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const coachAuth = readFileSync(join(process.cwd(), 'lib/coach-api-auth.ts'), 'utf8')
const playerAuth = readFileSync(join(process.cwd(), 'lib/player-api-auth.ts'), 'utf8')

describe('API auth subscription status normalization', () => {
  it('keeps trial subscriptions usable for Coach and Player API gates', () => {
    for (const source of [coachAuth, playerAuth]) {
      expect(source).toContain('normalizeSubscriptionStatus')
      expect(source).toContain('./access-model-core')
      expect(source).not.toMatch(/from ['"]\.\/access-model['"]/)
      expect(source).not.toContain('function normalizeApiSubscriptionStatus')
      expect(source).not.toContain("subscription_status === 'active' ? 'active' : 'inactive'")
    }
  })
})
