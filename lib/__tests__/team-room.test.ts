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
      messageId: 'match-card-1',
      court: '4.5 Doubles',
      player: 'Alex Morgan',
      arrivalAction: 'message',
    })).toBe('/team-room?team=SuperSmash+Bros&league=2026+Tri-Level&flight=3.5%2F4.0%2F4.5&date=2026-08-08&opponent=Baseline+Crew&time=6%3A00+PM&facility=North+Courts&message=match-card-1&court=4.5+Doubles&player=Alex+Morgan&arrival=message')
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
    const matchFlowMigration = readFileSync(join(process.cwd(), 'supabase/migrations/20260802000100_extend_team_room_match_flow.sql'), 'utf8')
    const lineupBuilder = readFileSync(join(process.cwd(), 'app/captain/lineup-builder/page.tsx'), 'utf8')
    const reminderRunner = readFileSync(join(process.cwd(), 'app/api/team-rooms/reminders/route.ts'), 'utf8')
    const joinPage = readFileSync(join(process.cwd(), 'app/team-room/join/page.tsx'), 'utf8')
    const vercelConfig = readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')

    expect(roomPage).toContain('Add to Home Screen')
    expect(roomPage).toContain('Share invite')
    expect(roomPage).toContain('Announcement')
    expect(roomPage).toContain('Ask availability')
    expect(roomPage).toContain("Can't play")
    expect(roomPage).toContain('Text players not connected')
    expect(roomPage).toContain('Needs attention')
    expect(roomPage).toContain('Automatic follow-up')
    expect(roomPage).toContain('Mark seen')
    expect(roomPage).toContain('MatchRecap')
    expect(roomPage).toContain('/brand/icons/pwa-192.png')
    expect(roomPage).toContain('aria-label="Back to My Teams"')
    expect(roomPage).toContain('Register to access your teams.')
    expect(roomPage).not.toContain('/tenaceiq-icon-192.png')
    expect(roomApi).toContain("action === 'create_invite'")
    expect(roomApi).toContain("action === 'post_match_card'")
    expect(roomApi).toContain("action === 'respond'")
    expect(roomApi).toContain("action === 'acknowledge_lineup'")
    expect(roomApi).toContain("action === 'schedule_reminder'")
    expect(roomApi).toContain("action === 'remind_waiting'")
    expect(roomApi).toContain('selectActiveTeamRoomCard')
    expect(roomApi).toContain('mirrorAvailabilityResponse')
    expect(roomApi).toContain("url.searchParams.get('summary') === '1'")
    expect(roomApi).toContain('syncTeamRoomParticipants')
    expect(joinApi).toContain("source_type: 'manual_invite'")
    expect(captainPage).toContain('Team Room')
    expect(teamPage).toContain('Open Team Chat')
    expect(messagesPage).toContain("conversation.conversationType === 'team'")
    expect(manifest).toContain("url: '/team-room'")
    expect(migration).toContain('drop policy if exists "Members can create own team profile links"')
    expect(migration).toContain('drop policy if exists "Members can update own team profile links"')
    expect(matchCardMigration).toContain('create table if not exists public.team_room_message_responses')
    expect(matchCardMigration).toContain('add column if not exists metadata jsonb')
    expect(matchFlowMigration).toContain('create table if not exists public.team_room_lineup_acknowledgments')
    expect(matchFlowMigration).toContain('create table if not exists public.team_room_reminder_schedules')
    expect(matchFlowMigration).toContain('create table if not exists public.team_room_member_preferences')
    expect(reminderRunner).toContain('processSchedule')
    expect(reminderRunner).toContain('sendOptInEmails')
    expect(joinPage).toContain('Season availability')
    expect(joinPage).toContain('Browser alerts')
    expect(vercelConfig).toContain('/api/team-rooms/reminders')
    expect(lineupBuilder).toContain("action: 'post_match_card'")
    expect(lineupBuilder).toContain("cardType: 'projected_lineup'")
  })

  it('supports a real-time, recoverable Team Chat app experience', () => {
    const roomPage = readFileSync(join(process.cwd(), 'app/team-room/page.tsx'), 'utf8')
    const roomStyles = readFileSync(join(process.cwd(), 'app/team-room/team-room.module.css'), 'utf8')
    const roomApi = readFileSync(join(process.cwd(), 'app/api/team-rooms/route.ts'), 'utf8')
    const attachmentApi = readFileSync(join(process.cwd(), 'app/api/team-rooms/attachments/route.ts'), 'utf8')
    const pushApi = readFileSync(join(process.cwd(), 'app/api/team-rooms/push/route.ts'), 'utf8')
    const pushServer = readFileSync(join(process.cwd(), 'lib/team-room-push-server.ts'), 'utf8')
    const serviceWorker = readFileSync(join(process.cwd(), 'public/team-room-sw.js'), 'utf8')
    const siteShell = readFileSync(join(process.cwd(), 'app/components/site-shell.tsx'), 'utf8')
    const upliftMigration = readFileSync(join(process.cwd(), 'supabase/migrations/20260802000200_uplift_team_room_chat.sql'), 'utf8')

    expect(roomPage).toContain(".channel(`team-room:${room.id}`")
    expect(roomPage).toContain("'postgres_changes'")
    expect(roomPage).toContain("'presence'")
    expect(roomPage).toContain('TeamRoomMemberDrawer')
    expect(roomPage).toContain('Turn on background alerts')
    expect(roomPage).toContain('replyToMessageId')
    expect(roomPage).toContain('Add file')
    expect(roomPage).toContain('tenaceiq-team-room-draft:')
    expect(roomPage).toContain('tenaceiq-team-room-scroll:')
    expect(roomPage).toContain('function TeamRoomPortalState')
    expect(roomPage).toContain('<PortalToolBar suppressed={compactSiteMenuOpen} />')
    expect(roomPage).toContain('<TeamConnectionInvite />')
    expect(roomPage).toContain('<SiteFooter railLayout={false} railWidth={0} />')
    expect(roomPage).not.toContain('}, 9000)')
    expect(roomStyles).toContain('.appBar')
    expect(roomStyles).toContain('.memberDrawer')
    expect(roomApi).toContain("action === 'toggle_reaction'")
    expect(roomApi).toContain("action === 'edit_message'")
    expect(roomApi).toContain("action === 'delete_message'")
    expect(roomApi).toContain("action === 'remove_member'")
    expect(roomApi).toContain("action === 'restore_member'")
    expect(roomApi).toContain("action === 'revoke_invites'")
    expect(roomApi).toContain(".from('captain_roster_contacts')")
    expect(roomApi).toContain('You no longer have access to this Team Chat.')
    expect(attachmentApi).toContain('MAX_FILE_BYTES = 5 * 1024 * 1024')
    expect(attachmentApi).toContain(".from('internal_conversation_participants')")
    expect(attachmentApi).toContain("storage.from('team-room-files')")
    expect(pushApi).toContain(".from('team_room_push_subscriptions')")
    expect(pushServer).toContain('webpush.sendNotification')
    expect(serviceWorker).toContain("self.addEventListener('push'")
    expect(serviceWorker).toContain("self.addEventListener('notificationclick'")
    expect(siteShell).toContain("appMode || pathname === '/team-room'")
    expect(upliftMigration).toContain('create table if not exists public.team_room_message_reactions')
    expect(upliftMigration).toContain('create table if not exists public.team_room_push_subscriptions')
    expect(upliftMigration.match(/'team-room-files'/g)).toHaveLength(2)
    expect(upliftMigration).toContain('alter publication supabase_realtime add table public.internal_messages')
  })
})
