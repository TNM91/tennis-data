import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8')

describe('TennisRecord public inventory repair', () => {
  const migration = read('supabase/migrations/20260822000400_repair_tennisrecord_public_inventory.sql')
  const service = read('lib/tennisrecord/service.ts')

  it('reprojects only parser-valid TennisRecord-owned records without changing rating eligibility', () => {
    expect(migration).toContain("rated_line.source = 'tennisrecord'")
    expect(migration).toContain("existing.source in ('tennisrecord', 'tennisrecord_quarantined')")
    expect(migration).toContain('and existing.line_number is null')
    expect(migration).toContain('and staged.parse_status = \'valid\'')
    expect(migration).toContain('rating_eligible = false')
    expect(migration).not.toContain("source in ('admin_verified'")
  })

  it('adds valid staged match context to the public team and flight projection', () => {
    expect(migration).toContain('create or replace view public.tennisrecord_public_team_context')
    expect(migration).toContain("'match:' || source_match_key || ':home'")
    expect(migration).toContain("'match:' || source_match_key || ':away'")
    expect(migration).toContain("where parse_status = 'valid'")
    expect(migration).toContain('grant select on public.tennisrecord_public_team_context to anon, authenticated')
  })

  it('carries team metadata on future canonical court records', () => {
    expect(service).toContain('home_team: staged.home_team')
    expect(service).toContain('away_team: staged.away_team')
    expect(service).toContain('rating_eligible: true')
  })
})
