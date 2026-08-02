import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildTeamRoomHref,
  buildTeamRoomScopeId,
  canManageTeamRoom,
  normalizeTeamRoomKey,
} from '../team-room'

describe('Team Room', () => {
  it('keeps one stable room across TennisLink punctuation differences', () => {
    expect(normalizeTeamRoomKey('SuperSmash Bros/Pottebaum-Meinart'))
      .toBe('supersmash bros pottebaum meinart')
    expect(buildTeamRoomScopeId({
      teamName: 'SuperSmash Bros/Pottebaum-Meinart',
      leagueName: 'Tri-Level',
      flight: '3.5 / 4.0 / 4.5',
    })).toBe('supersmash bros pottebaum meinart__tri level__3 5 4 0 4 5')
  })

  it('builds a direct team-room link with the full team scope', () => {
    expect(buildTeamRoomHref({
      teamName: 'SuperSmash Bros',
      leagueName: '2026 Tri-Level',
      flight: '3.5/4.0/4.5',
    })).toBe('/team-room?team=SuperSmash+Bros&league=2026+Tri-Level&flight=3.5%2F4.0%2F4.5')

    expect(buildTeamRoomHref({
      teamName: 'SuperSmash Bros',
      leagueName: '2026 Tri-Level',
      flight: '3.5/4.0/4.5',
      date: '2026-08-08',
      opponent: 'Baseline Crew',
      time: '6:00 PM',
      facility: 'North Courts',
    })).toBe('/team-room?team=SuperSmash+Bros&league=2026+Tri-Level&flight=3.5%2F4.0%2F4.5&date=2026-08-08&opponent=Baseline+Crew&time=6%3A00+PM&facility=North+Courts')
  })

  it('limits team invitations and announcements to team leaders', () => {
    expect(canManageTeamRoom(['player'])).toBe(false)
    expect(canManageTeamRoom(['player', 'co_captain'])).toBe(true)
    expect(canManageTeamRoom(['captain'])).toBe(true)
  })

  it('connects the room, invite, PWA, Captain, Team, and inbox surfaces', () => {
    const roomPage = readFileSync(join(process.cwd(), 'app/team-room/page.tsx'), 'utf8')
    const roomApi = readFileSync(join(process.cwd(), 'app/api/team-rooms/route.ts'), 'utf8')
    const joinApi = readFileSync(join(process.cwd(), 'app/api/team-rooms/join/route.ts'), 'utf8')
    const captainPage = readFileSync(join(process.cwd(), 'app/captain/page.tsx'), 'utf8')
    const teamPage = readFileSync(join(process.cwd(), 'app/teams/[team]/page.tsx'), 'utf8')
    const messagesPage = readFileSync(join(process.cwd(), 'app/messages/page.tsx'), 'utf8')
    const manifest = readFileSync(join(process.cwd(), 'app/manifest.ts'), 'utf8')
    const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260801001000_create_team_rooms.sql'), 'utf8')
    const matchCardMigration = readFileSync(join(process.cwd(), 'supabase/migrations/20260801001100_add_team_room_match_cards.sql'), 'utf8')
    const lineupBuilder = readFileSync(join(process.cwd(), 'app/captain/lineup-builder/page.tsx'), 'utf8')

    expect(roomPage).toContain('Add to Home Screen')
    expect(roomPage).toContain('Invite team')
    expect(roomPage).toContain('Pin as announcement')
    expect(roomPage).toContain('Ask availability')
    expect(roomPage).toContain("Can't play")
    expect(roomPage).toContain('Text players not connected')
    expect(roomApi).toContain("action === 'create_invite'")
    expect(roomApi).toContain("action === 'post_match_card'")
    expect(roomApi).toContain("action === 'respond'")
    expect(roomApi).toContain('mirrorAvailabilityResponse')
    expect(roomApi).toContain("url.searchParams.get('summary') === '1'")
    expect(roomApi).toContain('syncTeamRoomParticipants')
    expect(joinApi).toContain("source_type: 'manual_invite'")
    expect(captainPage).toContain('Team Room')
    expect(teamPage).toContain('Open Team Room')
    expect(messagesPage).toContain("conversation.conversationType === 'team'")
    expect(manifest).toContain("url: '/team-room'")
    expect(migration).toContain('drop policy if exists "Members can create own team profile links"')
    expect(migration).toContain('drop policy if exists "Members can update own team profile links"')
    expect(matchCardMigration).toContain('create table if not exists public.team_room_message_responses')
    expect(matchCardMigration).toContain('add column if not exists metadata jsonb')
    expect(lineupBuilder).toContain("action: 'post_match_card'")
    expect(lineupBuilder).toContain("cardType: 'projected_lineup'")
  })
})
