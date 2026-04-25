alter table rating_snapshots
  add column if not exists delta float,
  add column if not exists opponent_rating float,
  add column if not exists win_probability smallint,
  add column if not exists multiplier float;
