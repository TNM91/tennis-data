import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const teamsHub = readFileSync(join(process.cwd(), 'app/compete/teams/page.tsx'), 'utf8')
const teamPage = readFileSync(join(process.cwd(), 'app/teams/[team]/page.tsx'), 'utf8')
const portal = readFileSync(join(process.cwd(), 'app/components/portal-tool-bar.tsx'), 'utf8')
const quickMessage = readFileSync(join(process.cwd(), 'app/components/quick-message-composer.tsx'), 'utf8')
const internalMessages = readFileSync(join(process.cwd(), 'lib/internal-messages.ts'), 'utf8')
const teamChatMigration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260815000000_secure_team_chat_membership.sql'),
  'utf8',
)

describe('membership-first Teams experience', () => {
  it('makes Teams a first-class free destination', () => {
    expect(portal).toContain("label: 'Teams'")
    expect(portal).toContain("route: '/compete/teams'")
    expect(portal).toContain("icon: 'teamRankings'")
    expect(portal).toContain("title: 'Open my teams'")
    expect(teamsHub).toContain('Register to access your teams.')
    expect(teamsHub).toContain('Your Free account includes each linked team’s roster, schedule, stats, and team chat.')
  })

  it('keeps chat inside the linked team page', () => {
    expect(teamPage).toContain('id="team-chat"')
    expect(teamPage).toContain('mode="team"')
    expect(teamPage).toContain('Open team chat')
    expect(teamPage).toContain('Replies also appear in your Messages inbox.')
    expect(quickMessage).toContain("type QuickMessageMode = 'direct' | 'support' | 'league' | 'team'")
    expect(quickMessage).toContain('createTeamConversation(identity')
    expect(internalMessages).toContain("supabase.rpc('open_team_conversation'")
  })

  it('enforces team membership at the database boundary', () => {
    expect(teamChatMigration).toContain('create or replace function private.is_profile_team_member(')
    expect(teamChatMigration).toContain('create or replace function public.open_team_conversation(')
    expect(teamChatMigration).toContain("conversation.related_entity_type <> 'team'")
    expect(teamChatMigration).toContain('and private.can_access_team_conversation(conversation_id, profile_id)')
    expect(teamChatMigration).toContain("raise exception 'Your account is not linked to this team.'")
    expect(teamChatMigration).toContain('or public.is_internal_conversation_participant(conversation_id)')
    expect(teamChatMigration).toContain('create trigger internal_messages_touch_conversation')
    expect(teamChatMigration).toContain("security invoker\nset search_path = ''")
  })

  it('layers Player and Captain tools above free team collaboration', () => {
    expect(teamPage).toContain('isLinkedTeamMember && access.canUseAdvancedPlayerInsights')
    expect(teamPage).toContain('Turn team context into your next improvement.')
    expect(teamPage).toContain('access.canUseCaptainWorkflow ?')
    expect(teamPage).toContain('aria-label="Captain team week tools"')
  })
})
