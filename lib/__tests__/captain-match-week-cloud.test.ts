import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const messagingPage = readFileSync(join(process.cwd(), 'app/captain/messaging/page.tsx'), 'utf8')
const draftRoute = readFileSync(join(process.cwd(), 'app/api/captain/lineup-drafts/route.ts'), 'utf8')
const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260908000500_extend_captain_lineup_drafts_match_week.sql'), 'utf8')

describe('captain Match Week cloud state', () => {
  it('shares courts and match details through the protected lineup draft scope', () => {
    expect(messagingPage).toContain("action: 'sync-match-week'")
    expect(messagingPage).toContain('lineupAssignmentsToDraftSlots(input.rows)')
    expect(messagingPage).toContain('matchDetails: input.details')
    expect(messagingPage).toContain('getCaptainLineupDraftScopeKey(matchWeekDraftScope)')
    expect(draftRoute).toContain("body?.action === 'sync-match-week'")
    expect(draftRoute).toContain('cleanMatchWeekSlots(body.teamSlots)')
    expect(draftRoute).toContain(".eq('user_id', authorized.auth.userId)")
  })

  it('keeps a timestamp so an older phone cannot replace newer Match Week work', () => {
    expect(migration).toContain('match_week_updated_at timestamptz')
    expect(draftRoute).toContain('existingUpdatedAt > (Date.parse(updatedAt) || 0)')
    expect(messagingPage).toContain('newestMatchWeekTimestamp(localDetails, localRows)')
    expect(messagingPage).toContain('cloudTimestamp >= localTimestamp')
  })

  it('preserves phone backups for other matches and makes sync status clear', () => {
    expect(messagingPage).toContain(".filter((row) => row.key !== eventKey)")
    expect(messagingPage).toContain("lineups.filter((row) => row.event_key !== eventKey)")
    expect(messagingPage).toContain('writeLocal(LINEUPS_STORAGE_KEY, nextLineups)')
    expect(messagingPage).toContain("'Match week synced'")
    expect(messagingPage).toContain("'Courts saved across devices'")
  })
})
