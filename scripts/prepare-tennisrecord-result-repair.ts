/** Generate (never execute) a guarded SQL repair from a reviewed source replay. */
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { canonicalTennisRecordFingerprint } from '../lib/tennisrecord/reconcile'
import type { TennisRecordMatch } from '../lib/tennisrecord/types'

type Row = Record<string, unknown>
type Group = { fingerprint: string; source?: Row; parsed?: TennisRecordMatch; records: Row[]; canonical?: Row; observations: Row[]; staleObservationIds: string[]; protectedEvidenceIds: string[]; winnerMismatchIds: string[]; scoreMismatchIds: string[] }
const dir = 'artifacts/result-integrity-20260905'
async function main() {
  const input = process.argv.find(a => a.startsWith('--input='))?.slice(8) || `${dir}/complete-audit.json`
  const audit = JSON.parse(await readFile(input, 'utf8')) as { results: Group[] }
  const eligible = audit.results.filter(r => r.parsed?.winnerSide && canonicalTennisRecordFingerprint(r.parsed) === r.fingerprint &&
    r.source?.parse_status === 'valid' && r.protectedEvidenceIds.length === 0 && r.records.every(m => m.source === 'tennisrecord') &&
    r.records.some(m => m.id === r.canonical?.canonical_match_id) &&
    (r.winnerMismatchIds.length || r.staleObservationIds.length))
  const rows = eligible.flatMap(r => {
    const observation = r.observations.find(o => o.source === 'tennisrecord' && o.staged_match_id === r.source?.id)
    if (!observation) return []
    return [{ fingerprint: r.fingerprint, parsed: r.parsed, records: r.records, staged_id: r.source!.id, observation_id: observation.id, stale_ids: r.staleObservationIds, canonical_id: r.canonical!.canonical_match_id }]
  })
  const data = JSON.stringify(rows)
  const hash = createHash('sha256').update(data).digest('hex')
  const run = `result-integrity-20260905-${hash.slice(0,12)}`
  const setup = `begin;
set transaction isolation level serializable;
set local lock_timeout = '10s';
set local statement_timeout = '180s';
create temp table evidence on commit drop as select * from jsonb_to_recordset((select jsonb_agg(payload) from public.tennisrecord_result_repair_evidence where run_id='${run}'))
as e(fingerprint text, parsed jsonb, records jsonb, staged_id uuid, observation_id uuid, stale_ids jsonb, canonical_id uuid);
do $guard$ begin if (select count(*) from evidence) <> ${rows.length} then raise exception 'Incomplete reviewed evidence manifest'; end if; end $guard$;
-- Reject concurrent edits, changed authority, and mismatched court identities.
create temp table approved on commit drop as select e.* from evidence e
where exists(select 1 from public.tennisrecord_staged_matches s where s.id=e.staged_id and s.fingerprint=e.fingerprint and s.parse_status='valid')
and exists(select 1 from public.tennisrecord_canonical_matches c where c.fingerprint=e.fingerprint and c.canonical_match_id=e.canonical_id)
and exists(select 1 from public.tennisrecord_match_observations o where o.id=e.observation_id and o.fingerprint=e.fingerprint and o.source='tennisrecord')
and not exists(select 1 from public.tennisrecord_match_observations o where o.fingerprint=e.fingerprint and o.source<>'tennisrecord'
  and not(o.source='tenaceiq' and o.raw->>'source'='tennisrecord' and e.stale_ids ? o.id::text
    and exists(select 1 from public.matches m where m.id::text=o.source_record_id and m.source='tennisrecord')))
and not exists(select 1 from jsonb_array_elements(e.records) r left join public.matches m on m.id=(r->>'id')::uuid
  where m.id is null or m.source is distinct from 'tennisrecord' or m.score is distinct from r->>'score' or m.winner_side is distinct from r->>'winner_side'
  or m.external_match_id is distinct from r->>'external_match_id' or m.match_date::text is distinct from e.parsed->>'playedOn'
  or (m.match_type is not null and (m.match_type is distinct from e.parsed->>'discipline' or m.line_number::text is distinct from e.parsed->>'courtNumber')))
and not exists(select 1 from jsonb_array_elements(e.records) r join public.matches m on m.id=(r->>'id')::uuid
  where m.match_type is not null and (
    (select count(*) from public.match_players mp where mp.match_id=m.id) <> jsonb_array_length(e.parsed->'participants')
    or exists(select 1 from jsonb_array_elements(e.parsed->'participants') p where not exists(
      select 1 from public.match_players mp join public.players player on player.id=mp.player_id
      where mp.match_id=m.id and mp.side=p->>'side' and mp.seat=(p->>'seat')::integer
      and trim(regexp_replace(lower(player.name),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(p->>'name'),'[^a-z0-9]+',' ','g'))))));
`
  const result = `select jsonb_build_object('run_id','${run}','requested_groups',(select count(*) from evidence),'approved_groups',(select count(*) from approved),'deferred_groups',(select count(*) from evidence)-(select count(*) from approved),'winner_changes',(select count(*) from approved e,jsonb_array_elements(e.records) r where r->>'winner_side' is distinct from e.parsed->>'winnerSide'),'court_winner_changes',(select count(*) from approved e,jsonb_array_elements(e.records) r where r->>'match_type' is not null and r->>'winner_side' is distinct from e.parsed->>'winnerSide'),'affected_players',(select count(distinct mp.player_id) from approved e,jsonb_array_elements(e.records) r,public.match_players mp where mp.match_id=(r->>'id')::uuid)) as repair_summary;`
  await writeFile(`${dir}/repair-preview.sql`, setup + result + '\nrollback;\n')
  const mutation = `
-- Lock only reviewed matches while their source-backed results are corrected.
select m.id from approved e cross join lateral jsonb_array_elements(e.records) r join public.matches m on m.id=(r->>'id')::uuid for update of m;
insert into tiq_maintenance.result_repair_backups(run_id,record_kind,record_key,before_value)
select '${run}','matches',m.id::text,to_jsonb(m) from approved e cross join lateral jsonb_array_elements(e.records) r join public.matches m on m.id=(r->>'id')::uuid
on conflict do nothing;
insert into tiq_maintenance.result_repair_backups(run_id,record_kind,record_key,before_value)
select '${run}','staged',s.id::text,to_jsonb(s) from public.tennisrecord_staged_matches s join approved e on s.id=e.staged_id on conflict do nothing;
insert into tiq_maintenance.result_repair_backups(run_id,record_kind,record_key,before_value)
select '${run}','observations',o.id::text,to_jsonb(o) from public.tennisrecord_match_observations o join approved e on o.fingerprint=e.fingerprint on conflict do nothing;
insert into tiq_maintenance.result_repair_backups(run_id,record_kind,record_key,before_value)
select '${run}','canonical',c.fingerprint,to_jsonb(c) from public.tennisrecord_canonical_matches c join approved e using(fingerprint) on conflict do nothing;
-- Staged and retained source observations must agree with the replay as well.
update public.tennisrecord_staged_matches s set winner_side=e.parsed->>'winnerSide' from approved e where s.id=e.staged_id;
update public.tennisrecord_match_observations o set winner_side=e.parsed->>'winnerSide' from approved e where o.id=e.observation_id and o.source='tennisrecord';
delete from public.tennisrecord_match_observations o using approved e where o.fingerprint=e.fingerprint and e.stale_ids ? o.id::text and o.source='tenaceiq' and o.raw->>'source'='tennisrecord';
-- Preserve score text: source winner-first and reviewed A/B-oriented strings
-- can describe the same sets. This batch repairs explicit winner evidence.
update public.matches m set winner_side=e.parsed->>'winnerSide'
from approved e,jsonb_array_elements(e.records) r where m.id=(r->>'id')::uuid and m.source='tennisrecord'
and m.winner_side is distinct from e.parsed->>'winnerSide';
update public.tennisrecord_canonical_matches c set winning_observation_id=e.observation_id,winning_source='tennisrecord',reconciled_at=now(),rating_processed_at=null,
 conflict_count=(select count(*) from public.tennisrecord_match_observations o where o.fingerprint=e.fingerprint and o.id<>e.observation_id and (o.winner_side is distinct from e.parsed->>'winnerSide' or o.score_text is distinct from e.parsed->>'scoreText')),
 has_conflict=exists(select 1 from public.tennisrecord_match_observations o where o.fingerprint=e.fingerprint and o.id<>e.observation_id and (o.winner_side is distinct from e.parsed->>'winnerSide' or o.score_text is distinct from e.parsed->>'scoreText'))
from approved e where c.fingerprint=e.fingerprint;
update public.tennisrecord_collector_settings set rating_recalculation_requested_at=now(),rating_recalculation_reason='source_result_integrity_repair' where id=true;
${result}
commit;
`
  await writeFile(`${dir}/repair-apply.sql`, setup + mutation)
  await writeFile(`${dir}/repair-evidence.json`, JSON.stringify({ run, hash, rows }))
  await writeFile(`${dir}/repair-plan.json`, JSON.stringify({ run, hash, eligibleGroups: rows.length, unresolvedGroups: audit.results.length - rows.length, fingerprints: rows.map(r=>r.fingerprint) },null,2))
  console.log(JSON.stringify({run,eligibleGroups:rows.length,unresolvedGroups:audit.results.length-rows.length,files:['repair-preview.sql','repair-apply.sql']}))
}
main().catch(e => { console.error(e); process.exitCode = 1 })
