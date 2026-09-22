with sent_lineups as (
  select distinct on (
    message.metadata->'finalLineup'->>'sentByUserId',
    conversation.related_entity_id,
    message.metadata->>'matchDate',
    lower(regexp_replace(coalesce(message.metadata->>'opponent', ''), '[^a-z0-9]+', ' ', 'gi'))
  )
    message.metadata->'finalLineup'->>'sentByUserId' as user_id,
    conversation.related_entity_id as team_scope_id,
    message.metadata->>'matchDate' as match_date,
    lower(regexp_replace(coalesce(message.metadata->>'opponent', ''), '[^a-z0-9]+', ' ', 'gi')) as opponent_team,
    message.id as source_message_id,
    coalesce(nullif(message.metadata->'finalLineup'->>'sentAt', '')::timestamptz, message.created_at) as sent_at
  from public.internal_messages message
  join public.internal_conversations conversation
    on conversation.id = message.conversation_id
  where conversation.related_entity_type = 'team_room'
    and message.metadata @> '{"teamRoomCard": true}'::jsonb
    and jsonb_typeof(message.metadata->'finalLineup') = 'object'
    and coalesce(message.metadata->'finalLineup'->>'sentByUserId', '') <> ''
    and coalesce(message.metadata->'finalLineup'->>'lineupId', '') <> ''
  order by
    message.metadata->'finalLineup'->>'sentByUserId',
    conversation.related_entity_id,
    message.metadata->>'matchDate',
    lower(regexp_replace(coalesce(message.metadata->>'opponent', ''), '[^a-z0-9]+', ' ', 'gi')),
    coalesce(nullif(message.metadata->'finalLineup'->>'sentAt', '')::timestamptz, message.created_at) desc
)
update public.captain_lineup_drafts draft
set
  delivery_status = 'sent',
  delivered_at = sent_lineups.sent_at,
  team_room_message_id = sent_lineups.source_message_id
from sent_lineups
where draft.user_id::text = sent_lineups.user_id
  and regexp_replace(lower(draft.team_name), '[^a-z0-9]+', ' ', 'g') || '__'
      || regexp_replace(lower(draft.league_name), '[^a-z0-9]+', ' ', 'g') || '__'
      || regexp_replace(lower(draft.flight), '[^a-z0-9]+', ' ', 'g') = sent_lineups.team_scope_id
  and coalesce(draft.match_date::text, '') = sent_lineups.match_date
  and regexp_replace(lower(coalesce(draft.opponent_team, '')), '[^a-z0-9]+', ' ', 'g') = sent_lineups.opponent_team;
