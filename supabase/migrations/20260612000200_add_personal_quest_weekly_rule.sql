alter table public.personal_quest_profiles
  add column if not exists weekly_rule text not null default 'No chips. Water before coffee refill. Kitchen closed at 8.';

update public.personal_quest_profiles
set weekly_rule = 'No chips. Water before coffee refill. Kitchen closed at 8.'
where trim(weekly_rule) = '';
