alter table matches
  add column if not exists match_source text check (match_source in ('usta', 'tiq_team', 'tiq_individual')) default 'usta';

-- Back-fill existing rows: all rows inserted before this column existed are USTA league matches.
update matches set match_source = 'usta' where match_source is null;

-- Make it non-nullable now that back-fill is done.
alter table matches alter column match_source set not null;
