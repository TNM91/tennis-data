with sent_lineups as (
  select distinct on (
    receipt->>'sentByUserId',
    lower(regexp_replace(coalesce(conversation.metadata->>'teamName', ''), '[^a-z0-9]+', ' ', 'gi')),
    lower(regexp_replace(coalesce(conversation.metadata->>'leagueName', ''), '[^a-z0-9]+', ' ', 'gi')),
    lower(regexp_replace(coalesce(conversation.metadata->>'flight', ''), '[^a-z0-9]+', ' ', 'gi')),
    message.metadata->>'matchDate',
    lower(regexp_replace(coalesce(message.metadata->>'opponent', ''), '[^a-z0-9]+', ' ', 'gi'))
  )
    receipt->>'sentByUserId' as user_id,
    lower(regexp_replace(coalesce(conversation.metadata->>'teamName', ''), '[^a-z0-9]+', ' ', 'gi')) as team_name,
    lower(regexp_replace(coalesce(conversation.metadata->>'leagueName', ''), '[^a-z0-9]+', ' ', 'gi')) as league_name,
    lower(regexp_replace(coalesce(conversation.metadata->>'flight', ''), '[^a-z0-9]+', ' ', 'gi')) as flight,
    message.metadata->>'matchDate' as match_date,
    lower(regexp_replace(coalesce(message.metadata->>'opponent', ''), '[^a-z0-9]+', ' ', 'gi')) as opponent_team,
    message.id as source_message_id,
    coalesce(nullif(receipt->>'sentAt', '')::timestamptz, message.created_at) as sent_at,
    jsonb_path_query_array(message.metadata, '$.lineup[*].players[*]') as player_names
  from public.internal_messages message
  join public.internal_conversations conversation
    on conversation.id = message.conversation_id
  cross join lateral (select message.metadata->'finalLineup' as receipt) final_receipt
  where conversation.related_entity_type = 'team_room'
    and message.metadata @> '{"teamRoomCard": true}'::jsonb
    and jsonb_typeof(receipt) = 'object'
    and coalesce(receipt->>'sentByUserId', '') <> ''
    and coalesce(receipt->>'lineupId', '') <> ''
  order by
    receipt->>'sentByUserId',
    lower(regexp_replace(coalesce(conversation.metadata->>'teamName', ''), '[^a-z0-9]+', ' ', 'gi')),
    lower(regexp_replace(coalesce(conversation.metadata->>'leagueName', ''), '[^a-z0-9]+', ' ', 'gi')),
    lower(regexp_replace(coalesce(conversation.metadata->>'flight', ''), '[^a-z0-9]+', ' ', 'gi')),
    message.metadata->>'matchDate',
    lower(regexp_replace(coalesce(message.metadata->>'opponent', ''), '[^a-z0-9]+', ' ', 'gi')),
    coalesce(nullif(receipt->>'sentAt', '')::timestamptz, message.created_at) desc
)
update public.captain_lineup_drafts draft
set
  delivery_status = 'sent',
  delivered_at = sent_lineups.sent_at,
  team_room_message_id = sent_lineups.source_message_id
from sent_lineups
where draft.user_id::text = sent_lineups.user_id
  and lower(regexp_replace(coalesce(draft.team_name, ''), '[^a-z0-9]+', ' ', 'gi')) = sent_lineups.team_name
  and lower(regexp_replace(coalesce(draft.league_name, ''), '[^a-z0-9]+', ' ', 'gi')) = sent_lineups.league_name
  and lower(regexp_replace(coalesce(draft.flight, ''), '[^a-z0-9]+', ' ', 'gi')) = sent_lineups.flight
  and coalesce(draft.match_date::text, '') = sent_lineups.match_date
  and lower(regexp_replace(coalesce(draft.opponent_team, ''), '[^a-z0-9]+', ' ', 'gi')) = sent_lineups.opponent_team
  and jsonb_path_query_array(draft.slots_json, '$[*].players[*].playerName') = sent_lineups.player_names;
