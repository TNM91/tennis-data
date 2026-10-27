# Candidate 134 production migration review

Do not apply before explicit production database approval. Standing beta approval covers the subsequent merge/build/internal TestFlight release, not this schema and permissions change.

Apply in order, each in its existing transaction:

1. `supabase/migrations/20261027000100_expand_native_chat_reactions.sql`
2. `supabase/migrations/20261027000200_named_team_chat_rooms.sql`

First migration extends the existing reaction constraint and service summary to six social reactions while preserving formal ack records. Second creates the service-only room registry and RPC, strengthens named-room authorization through the existing General membership boundary, and extends existing change signals. All current team members can access every named room; only current captains/co-captains create rooms. No history is moved, no rooms/messages are automatically created, and no users are invited or notified by migration.

Read-only catalog preflight on 2026-10-27 found no public.team_chat_rooms table. Normalized CRLF-to-LF pg_proc.prosrc MD5 baselines:

- private.can_access_team_conversation: f977de7db15e7aaa36ad4cbcf67a2e7b
- public.can_read_team_chat_signal: 2e834efd455c1897257b29e72687236b
- public.touch_team_chat_signal: a804b5c02227f816bf54606527c200aa

The existing `team_room_message_reactions_reaction_check` permits exactly `ack`, `helpful`, and `celebrate`; catalog output matched the source baseline. All three function hashes also matched their original migration bodies.

Recheck these baselines and the exact existing reaction constraint before applying; stop and reconcile unexpected changes. After applying, verify table RLS, no anon/authenticated table or RPC access, service-only execute grants, new constraint and installed function bodies against candidate. Do not perform positive private production writes as QA. Preserve existing history; rollback must be a separately reviewed forward fix if rooms/reactions already exist.

Local PostgreSQL verification: `node scripts/check-chat-room-migrations.mjs`. The fixture uses isolated synthetic rows, the actual existing policy definitions and both proposed migrations.
