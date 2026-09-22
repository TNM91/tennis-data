import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const route = readFileSync(join(root, 'app', 'api', 'captain', 'availability-requests', 'route.ts'), 'utf8')
const migration = readFileSync(
  join(root, 'supabase', 'migrations', '20260828000200_restore_captain_invite_response_token_default.sql'),
  'utf8',
)

describe('captain availability reply-token safety', () => {
  it('generates a token in the API when a bulk lineup request omits one', () => {
    expect(route).toContain("import { randomUUID } from 'node:crypto'")
    expect(route).toContain('responseToken: isUuid(player.responseToken) ? player.responseToken : randomUUID()')
    expect(route).toContain('const existingInviteTokens = new Map<string, string>()')
    expect(route).toContain(".select('player_id,player_name,response_token')")
    expect(route).toContain('Existing request JSON from an earlier build can lack a response token.')
    expect(route).toContain('response_token: player.responseToken')
    expect(route).toContain('TiQ could not prepare secure reply links. Please try again in a moment.')
  })

  it('restores the required database default for existing environments', () => {
    expect(migration).toContain('alter column response_token set default gen_random_uuid()')
  })
})
