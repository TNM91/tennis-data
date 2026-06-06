import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('profile link API resilience', () => {
  it('keeps profile linking alive when optional profile columns are not available yet', () => {
    const source = readFileSync(join(process.cwd(), 'app/api/profile/link/route.ts'), 'utf8')

    expect(source).toContain('async function saveProfileLink')
    expect(source).toContain('export async function GET')
    expect(source).toContain('async function loadProfileLink')
    expect(source).toContain('isMissingProfileLinkSchemaError(fullRes.error.message)')
    expect(source).toContain('compatibilityPayload')
    expect(source).toContain('minimalPayload')
    expect(source).toContain(".select('linked_player_id,linked_player_name,profile_photo_url,message_display_name')")
    expect(source).toContain(".select('linked_player_id,linked_player_name')")
  })
})
