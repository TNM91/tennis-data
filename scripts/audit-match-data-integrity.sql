-- Read-only production audit. Counts cover the whole active match cohort;
-- example arrays are bounded. A review finding is NOT authority to change data.
begin transaction isolation level repeatable read read only;
set local statement_timeout='90s';
with active as materialized (
 select id,match_date,match_type,source,winner_side,score,created_at,updated_at,rating_eligible,public_history_eligible
 from public.matches where status='completed' and match_type in ('singles','doubles')
 and (rating_eligible or public_history_eligible)
), rosters as materialized (
 select m.id,count(mp.player_id) as players,count(distinct mp.player_id) as distinct_players,
 count(distinct (mp.side,mp.seat)) filter(where mp.player_id is not null) as distinct_seats,
 count(*) filter(where mp.side='A') as side_a,count(*) filter(where mp.side='B') as side_b,
 bool_and(mp.seat between 1 and case when m.match_type='singles' then 1 else 2 end) as valid_seats,
 string_agg(mp.player_id::text,',' order by mp.player_id) as player_set,
 string_agg(mp.player_id::text,',' order by mp.player_id) filter(where mp.side='A') as team_a,
 string_agg(mp.player_id::text,',' order by mp.player_id) filter(where mp.side='B') as team_b
 from active m left join public.match_players mp on mp.match_id=m.id group by m.id
), malformed as materialized (
 select m.*,r.players,r.distinct_players,r.distinct_seats,r.side_a,r.side_b from active m join rosters r using(id)
 where (r.players>0 or m.rating_eligible) and (r.players<>case when m.match_type='singles' then 2 else 4 end
 or r.distinct_players<>r.players or r.distinct_seats<>r.players or not r.valid_seats
 or r.side_a<>case when m.match_type='singles' then 1 else 2 end
 or r.side_b<>case when m.match_type='singles' then 1 else 2 end)
), duplicate_candidates as materialized (
 -- Same date and actual opposing sides, independent of A/B orientation or
 -- doubles seat order. Doubleheaders/replays may be legitimate: review only.
 select m.match_date,m.match_type,r.player_set,least(r.team_a,r.team_b) as first_team,
 greatest(r.team_a,r.team_b) as second_team,count(*) as copies,
 array_agg(m.id order by m.id) as match_ids,array_agg(distinct m.source) as sources,
 count(distinct case when m.winner_side='A' then r.team_a when m.winner_side='B' then r.team_b end)>1 as winner_disagreement
 from active m join rosters r using(id) where r.players>0 and not exists(select 1 from malformed bad where bad.id=m.id)
 group by m.match_date,m.match_type,r.player_set,least(r.team_a,r.team_b),greatest(r.team_a,r.team_b) having count(*)>1
), source_evidence as materialized (
 select distinct on(s.fingerprint) s.fingerprint,s.winner_side,s.participants,s.last_seen_at,s.parser_revision
 from public.tennisrecord_staged_matches s where s.parse_status='valid' and s.winner_side in ('A','B')
 order by s.fingerprint,s.parser_revision desc,s.last_seen_at desc
), compared as materialized (
 select distinct m.id,m.winner_side,s.winner_side as source_winner,c.winning_source,c.fingerprint,s.parser_revision
 from public.tennisrecord_canonical_matches c join active m on m.id=c.canonical_match_id join source_evidence s using(fingerprint)
 where m.source='tennisrecord'
), winner_disagreements as materialized (
 select * from compared where winning_source='tennisrecord' and winner_side is distinct from source_winner
), independent_overrides as materialized (
 select * from compared where winning_source<>'tennisrecord' and winner_side is distinct from source_winner
), identity_reviews as materialized (
 select s.id as staged_player_id,s.name as source_name,p.id as player_id,p.name as canonical_name,i.confidence,i.reviewed_at
 from public.tennisrecord_player_identities i join public.tennisrecord_staged_players s on s.id=i.staged_player_id join public.players p on p.id=i.canonical_player_id
 where i.status='matched' and regexp_replace(lower(s.normalized_name),'[^a-z0-9]','','g')<>regexp_replace(lower(p.normalized_name),'[^a-z0-9]','','g')
), source_keys as materialized (
 select p->>'sourcePlayerKey' as source_key,array_agg(distinct p->>'name') as names,count(distinct lower(regexp_replace(p->>'name','[^a-zA-Z0-9]','','g'))) as distinct_names
 from source_evidence s,jsonb_array_elements(s.participants) p group by p->>'sourcePlayerKey'
 having count(distinct lower(regexp_replace(p->>'name','[^a-zA-Z0-9]','','g')))>1
), pending as materialized (
 select fingerprint,reconciled_at from public.tennisrecord_canonical_matches where canonical_match_id is not null and rating_processed_at is null
), synthetic as materialized (
 select o.id,o.fingerprint,m.id as match_id from public.tennisrecord_match_observations o join public.matches m on m.id::text=o.source_record_id
 where o.source='tenaceiq' and o.raw->>'source'='tennisrecord' and m.source='tennisrecord'
)
select jsonb_build_object(
 'scanned_at',now(),'read_only',true,'examples_limit',25,
 'coverage',jsonb_build_object('active_played_matches',(select count(*) from active),'source_comparisons',(select count(*) from compared),'created_last_24h',(select count(*) from active where created_at>=now()-interval '24 hours')),
 'source_winner_disagreements',jsonb_build_object('count',(select count(*) from winner_disagreements),'examples',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(select * from winner_disagreements order by id limit 25)x)),
 'independently_overridden_source_results',jsonb_build_object('count',(select count(*) from independent_overrides),'examples',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(select * from independent_overrides order by id limit 25)x)),
 'synthetic_authority',jsonb_build_object('count',(select count(*) from synthetic),'examples',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(select * from synthetic order by id limit 25)x)),
 'invalid_court_rosters',jsonb_build_object('count',(select count(*) from malformed),'examples',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(select * from malformed order by id limit 25)x)),
 'legacy_unlinked_nonrating_rows',(select count(*) from active m join rosters r using(id) where r.players=0 and not m.rating_eligible),
 'missing_winners',jsonb_build_object('count',(select count(*) from active where winner_side is null),'examples',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(select * from active where winner_side is null order by id limit 25)x)),
 'duplicate_candidates_review_only',jsonb_build_object('count',(select count(*) from duplicate_candidates),'conflicting_winners',(select count(*) from duplicate_candidates where winner_disagreement),'examples',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(select * from duplicate_candidates order by winner_disagreement desc,match_date desc,player_set limit 25)x)),
 'identity_name_reviews',jsonb_build_object('count',(select count(*) from identity_reviews),'examples',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(select * from identity_reviews order by staged_player_id limit 25)x)),
 'source_key_name_collisions_review_only',jsonb_build_object('count',(select count(*) from source_keys),'examples',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(select * from source_keys order by source_key limit 25)x)),
 'import_guard_reviews',jsonb_build_object('missing_or_conflicting_winner',(select count(*) from public.tennisrecord_staged_matches where parse_status='quarantined' and parse_failure_reason like 'Winner indicator is missing or conflicting.%'),'possible_duplicate',(select count(*) from public.tennisrecord_staged_matches where parse_status='quarantined' and parse_failure_reason like 'Possible existing match%')),
 'rating_queue',jsonb_build_object('pending',(select count(*) from pending),'older_than_2h',(select count(*) from pending where reconciled_at<now()-interval '2 hours'),'oldest',(select min(reconciled_at) from pending)),
 'collector',(select jsonb_build_object('enabled',enabled,'automation_state',automation_state,'rating_requested_at',rating_recalculation_requested_at,'last_rating_refresh',rating_recalculated_at) from public.tennisrecord_collector_settings where id=true),
 'stalled_import_runs',(select count(*) from public.tennisrecord_sync_runs where status='running' and started_at<now()-interval '6 minutes'),
 'recent_runs',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(select status,started_at,completed_at,pages_processed,parser_failures,conflicts_found,error_message from public.tennisrecord_sync_runs order by started_at desc limit 5)x)
) as integrity_audit;
commit;
