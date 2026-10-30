begin;
do $guard$ begin
 if not public.account_erasure_catalog_ready() then raise exception 'Account erasure catalog requires review before registration migration'; end if;
 if not exists(select 1 from pg_catalog.pg_proc where oid='public.account_erasure_catalog_ready()'::regprocedure and prosecdef and md5(regexp_replace(prosrc,'\s','','g'))='8dc602e6c621cb6f0e74b501af9048bc')
 or not exists(select 1 from pg_catalog.pg_proc where oid='public.automated_account_erasure(text,uuid,uuid,text)'::regprocedure and prosecdef and md5(regexp_replace(prosrc,'\s','','g'))='401d51a7799257b1927b838be7d759e5') then raise exception 'Existing erasure functions differ; review before migration'; end if;
end $guard$;
alter table public.tiq_tournament_entries add column native_registration jsonb not null default '{}'::jsonb
 check (jsonb_typeof(native_registration)='object' and octet_length(native_registration::text)<=12000);
comment on column public.tiq_tournament_entries.native_registration is 'Self-attested native player/partner details and player-visible decision note. No email, phone or additional account identifiers.';
do $patch$
declare source text; marker text := '31de6ea163c8a5eab415cf59492abddf'; cleanup text := 'update public.clubs set contact_email='''' where lower(contact_email)=lower(j.verified_email);';
begin
 source := pg_catalog.pg_get_functiondef('public.account_erasure_catalog_ready()'::regprocedure);
 if (length(source)-length(replace(source,marker,'')))/length(marker)<>1 then raise exception 'Erasure column marker changed'; end if;
 execute replace(source,marker,'92283363651da61e44479259f3208041');
 source := pg_catalog.pg_get_functiondef('public.automated_account_erasure(text,uuid,uuid,text)'::regprocedure);
 if (length(source)-length(replace(source,cleanup,'')))/length(cleanup)<>1 then raise exception 'Erasure cleanup marker changed'; end if;
 execute replace(source,cleanup,$insert$
  delete from public.api_rate_limits where scope='native-tournament-entry' and key_hash=encode(sha256(convert_to(j.account_id::text||':native-tournament-entry','UTF8')),'hex');
  delete from public.tiq_tournament_entries where submitted_by_user_id=j.account_id and native_registration->>'version'='1' and status<>'approved';
  update public.tiq_tournament_entries set native_registration='{}'::jsonb,self_rating=0,eligibility_rating=null,eligibility_rating_source='unknown',eligibility_review_note='',eligibility_reviewed_by=null,eligibility_reviewed_at=null where submitted_by_user_id=j.account_id and native_registration->>'version'='1';
  $insert$||cleanup);
 if not public.account_erasure_catalog_ready() then raise exception 'Updated erasure catalog did not validate'; end if;
end $patch$;

create function public.native_tournament_entry_context(p_parent text,p_division text) returns jsonb
language plpgsql security definer set search_path='' as $body$
declare t public.tiq_tournaments; root public.tiq_tournaments; zone text; cutoff date; today date; closed boolean; locked boolean; manager boolean; one_name text; linked text; value jsonb;
begin
 select * into t from public.tiq_tournaments where id=p_division and is_public and not is_event and status<>'draft' and entrant_type in ('players','teams');
 if not found or coalesce(t.event_id,'')<>p_parent then return null; end if;
 if p_parent<>'' then
  select * into root from public.tiq_tournaments where id=p_parent and is_public and is_event and event_id is null and status<>'draft';
  if not found then return null; end if;
 else root:=t; end if;
 select p.linked_player_id::text,btrim(regexp_replace(coalesce(pl.name,''),'[[:space:]]+',' ','g')) into linked,one_name
 from public.profiles p left join public.players pl on pl.id::text=p.linked_player_id::text where p.id=auth.uid();
 if linked is not null and coalesce(one_name,'')='' then return null; end if;
 zone:=coalesce(nullif(root.event_details->>'timeZone',''),'UTC');
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=zone) then zone:='UTC'; end if;
 today:=(clock_timestamp() at time zone zone)::date;
 begin
  if coalesce(root.event_details->>'registrationClosesOn','')~'^\d{4}-\d{2}-\d{2}$' then cutoff:=(root.event_details->>'registrationClosesOn')::date; end if;
 exception when datetime_field_overflow or invalid_datetime_format then cutoff:=null; end;
 if cutoff is null then begin
  if root.starts_on~'^\d{4}-\d{2}-\d{2}$' then cutoff:=root.starts_on::date; end if;
 exception when datetime_field_overflow or invalid_datetime_format then cutoff:=null; end; end if;
 closed:=t.status='completed' or root.status='completed' or (cutoff is not null and cutoff<today);
 locked:=t.results<>'{}'::jsonb or t.schedule<>'{}'::jsonb or t.status='completed' or root.status='completed';
 manager:=coalesce(public.can_manage_tiq_tournament(t.id) and public.can_manage_tiq_tournament(root.id),false);
 value:=jsonb_build_object('owner',auth.uid(),'parent',p_parent,'division',t.id,'name',t.name,'eventName',root.name,'paired',t.entrant_type='teams','playerName',coalesce(one_name,''),'playerLocked',linked is not null,'canManage',manager,
 'mode',case when root.registration_email<>'' then 'director' when t.format not in ('single_elimination','round_robin','group_playoffs') then 'unsupported' when closed or locked then 'closed' else 'native' end,
 'director',left(root.registration_email,254),'locked',locked,'canApprove',not locked and t.format in ('single_elimination','round_robin','group_playoffs'),
 'date',root.starts_on,'deadline',coalesce(cutoff::text,''),'zone',zone);
 return value||jsonb_build_object('revision',md5((value||jsonb_build_object('tournamentVersion',t.updated_at,'rootVersion',root.updated_at,'field',t.entrants,'draw',md5(t.results::text),'schedule',md5(t.schedule::text),'eventDetails',root.event_details,'rootPublic',root.is_public,'divisionPublic',t.is_public))::text));
end $body$;
revoke all on function public.native_tournament_entry_context(text,text) from public,anon,authenticated;

create function public.native_tournament_entry_receipt(item public.tiq_tournament_entries) returns jsonb
language sql stable security definer set search_path='' as $body$
 select jsonb_build_object('id',item.id,'name',item.player_name,'status',item.status,'updatedAt',item.updated_at,
 'one',case when item.native_registration->>'version'='1' then item.native_registration->>'one' else item.player_name end,
 'two',coalesce(item.native_registration->>'two',''),'rating',item.native_registration->'rating','partnerRating',item.native_registration->'partnerRating',
 'note',coalesce(item.native_registration->>'decisionNote',''),'legacy',coalesce(item.native_registration->>'version','')<>'1',
 'inDraw',exists(select 1 from public.tiq_tournaments t where t.id=item.tournament_id and item.player_name=any(t.entrants)));
$body$;
revoke all on function public.native_tournament_entry_receipt(public.tiq_tournament_entries) from public,anon,authenticated;

create function public.native_tournament_registration(p_action text,p_parent text,p_division text,p_data jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $body$
declare actor uuid:=auth.uid(); ctx jsonb; latest jsonb; t public.tiq_tournaments; root public.tiq_tournaments; item public.tiq_tournament_entries; existing public.tiq_tournament_entries;
 own_count integer; one_name text; two_name text; entrant text; rating numeric; partner_rating numeric; fee numeric; approved boolean; note text; desk jsonb; native jsonb; queue jsonb; total integer; recipient uuid; expected_time timestamptz; entry_id uuid;
begin
 if actor is null or not exists(select 1 from public.profiles where id=actor) or exists(select 1 from public.account_deletion_requests where account_id=actor and status<>'completed') then return jsonb_build_object('ok',false,'status',401,'message','Sign in with an active account.'); end if;
 if p_action is null or p_action not in ('review','queue','submit','decide') or p_parent is null or p_division is null or p_parent<>'' and p_parent!~'^[a-zA-Z0-9_-]{1,80}$' or p_division!~'^[a-zA-Z0-9_-]{1,80}$' or jsonb_typeof(p_data)<>'object' or p_data is null or octet_length(p_data::text)>12000 then return jsonb_build_object('ok',false,'status',400,'message','Check the registration details.'); end if;
 -- Reject inaccessible selections before taking any tournament lock.
 -- Recheck the same access after locks in case visibility or organizer rights changed.
 ctx:=public.native_tournament_entry_context(p_parent,p_division);
 if ctx is null then return jsonb_build_object('ok',false,'status',404,'message','This public division is unavailable.'); end if;
 if p_action in ('queue','decide') and ctx->'canManage' is distinct from 'true'::jsonb then return jsonb_build_object('ok',false,'status',403,'message','Tournament organizer access required.'); end if;
 if p_action in ('submit','decide') then
  perform 1 from public.profiles where id=actor for share;
  if p_parent<>'' then perform 1 from public.tiq_tournaments where id=p_parent for update; end if;
  perform 1 from public.tiq_tournaments where id=p_division for update;
  ctx:=public.native_tournament_entry_context(p_parent,p_division);
  if ctx is null then return jsonb_build_object('ok',false,'status',404,'message','This public division is unavailable.'); end if;
 end if;
 select * into t from public.tiq_tournaments where id=p_division;
 if p_parent<>'' then select * into root from public.tiq_tournaments where id=p_parent; else root:=t; end if;
 if p_action in ('queue','decide') and ctx->'canManage' is distinct from 'true'::jsonb then return jsonb_build_object('ok',false,'status',403,'message','Tournament organizer access required.'); end if;
 if p_action in ('review','queue') then
  if p_data<>'{}'::jsonb then return jsonb_build_object('ok',false,'status',400,'message','Check the registration selection.'); end if;
  if p_action='review' then
   select count(*) into own_count from public.tiq_tournament_entries where tournament_id=p_division and submitted_by_user_id=actor;
   if own_count>1 then return jsonb_build_object('ok',false,'status',409,'message','Ask the organizer to review your existing entries.'); end if;
   select * into item from public.tiq_tournament_entries where tournament_id=p_division and submitted_by_user_id=actor;
   latest:=public.native_tournament_entry_context(p_parent,p_division);
   if latest is distinct from ctx then return jsonb_build_object('ok',false,'status',409,'message','The division changed. Refresh registration.'); end if;
   return jsonb_build_object('ok',true,'context',ctx,'receipt',case when item.id is null then null else public.native_tournament_entry_receipt(item) end,'queue','[]'::jsonb,'more',false);
  end if;
  select count(*) into total from (select id from public.tiq_tournament_entries where tournament_id=p_division and status='pending' and native_registration->>'version'='1' limit 51) q;
  select coalesce(jsonb_agg(public.native_tournament_entry_receipt(q.item) order by (q.item).created_at,(q.item).id),'[]'::jsonb) into queue from (select e as item from public.tiq_tournament_entries e where tournament_id=p_division and status='pending' and native_registration->>'version'='1' order by created_at,id limit 50) q;
  latest:=public.native_tournament_entry_context(p_parent,p_division);
  if latest is distinct from ctx then return jsonb_build_object('ok',false,'status',409,'message','Organizer access or division details changed. Refresh registration.'); end if;
  return jsonb_build_object('ok',true,'context',ctx,'receipt',null,'queue',queue,'more',total>50);
 end if;
 if p_action='submit' then
  if exists(select 1 from jsonb_object_keys(p_data) k where k not in ('revision','one','two','rating','partnerRating','attested','partnerAttested')) then return jsonb_build_object('ok',false,'status',400,'message','Check your entry details.'); end if;
  select count(*) into own_count from public.tiq_tournament_entries where tournament_id=p_division and submitted_by_user_id=actor;
  if own_count>1 then return jsonb_build_object('ok',false,'status',409,'message','Ask the organizer to review your existing entries.'); end if;
  select * into existing from public.tiq_tournament_entries where tournament_id=p_division and submitted_by_user_id=actor;
  if existing.id is not null then return jsonb_build_object('ok',true,'context',ctx,'receipt',public.native_tournament_entry_receipt(existing),'queue','[]'::jsonb,'more',false,'alreadySubmitted',true); end if;
  if p_data->>'revision' is distinct from ctx->>'revision' then return jsonb_build_object('ok',false,'status',409,'message','The division changed. Refresh registration before entering.'); end if;
  if ctx->>'mode'<>'native' then return jsonb_build_object('ok',false,'status',409,'message','This division is not accepting in-app entry requests.'); end if;
  if jsonb_typeof(p_data->'one') is distinct from 'string' or jsonb_typeof(p_data->'two') is distinct from 'string' or jsonb_typeof(p_data->'rating') is distinct from 'number' or p_data->'attested' is distinct from 'true'::jsonb or jsonb_typeof(p_data->'partnerAttested') is distinct from 'boolean' then return jsonb_build_object('ok',false,'status',400,'message','Confirm your player details and eligibility.'); end if;
  one_name:=btrim(regexp_replace(p_data->>'one','[[:space:]]+',' ','g'));two_name:=btrim(regexp_replace(p_data->>'two','[[:space:]]+',' ','g'));rating:=(p_data->>'rating')::numeric;
  if length(one_name) not between 1 and 90 or length(two_name)>90 or one_name~'[[:cntrl:]/]' or two_name~'[[:cntrl:]/]' or rating<1 or rating>7 or rating*2<>trunc(rating*2) or ((ctx->>'playerLocked')::boolean and one_name<>ctx->>'playerName') then return jsonb_build_object('ok',false,'status',400,'message','Use your player name and a valid self-rated level.'); end if;
  if t.entrant_type='teams' then
   if two_name='' or lower(one_name)=lower(two_name) or p_data->'partnerAttested' is distinct from 'true'::jsonb or jsonb_typeof(p_data->'partnerRating') is distinct from 'number' then return jsonb_build_object('ok',false,'status',400,'message','Add a different partner and confirm their eligibility and permission.'); end if;
   partner_rating:=(p_data->>'partnerRating')::numeric;
   if partner_rating<1 or partner_rating>7 or partner_rating*2<>trunc(partner_rating*2) then return jsonb_build_object('ok',false,'status',400,'message','Choose your partner’s self-rated level.'); end if;
  elsif two_name<>'' or p_data->'partnerRating' is distinct from 'null'::jsonb or p_data->'partnerAttested' is distinct from 'false'::jsonb then return jsonb_build_object('ok',false,'status',400,'message','Singles entries have one player.'); end if;
  if exists(select 1 from unnest(t.entrants) n,regexp_split_to_table(n,'[[:space:]]*/[[:space:]]*') player where lower(btrim(player)) in (lower(one_name),nullif(lower(two_name),''))) then return jsonb_build_object('ok',false,'status',409,'message','A player is already in this draw. Ask the organizer to check your entry.'); end if;
  if not public.consume_api_rate_limit('native-tournament-entry',encode(sha256(convert_to(actor::text||':native-tournament-entry','UTF8')),'hex'),8,3600) then return jsonb_build_object('ok',false,'status',429,'message','Too many entry requests. Try again later.'); end if;
  entrant:=one_name||case when two_name<>'' then ' / '||two_name else '' end;
  native:=jsonb_build_object('version','1','one',one_name,'two',two_name,'rating',rating,'partnerRating',partner_rating,'attested',true,'partnerAttested',t.entrant_type='teams');
  insert into public.tiq_tournament_entries(tournament_id,player_name,email,phone,self_rating,status,submitted_by_user_id,eligibility_rating,eligibility_rating_source,eligibility_status,eligibility_review_note,native_registration)
   values(p_division,entrant,'','',rating,'pending',actor,rating,'self','needs_confirmation','Player and partner details are self-attested; organizer review required.',native) returning * into item;
  recipient:=t.created_by_user_id;
  begin
   if recipient is not null and recipient<>actor then insert into public.internal_notifications(recipient_profile_id,actor_user_id,notification_type,title,body,href) values(recipient,actor,'system','Tournament entry request',entrant||' requested entry to '||t.name,'/tournaments/'||p_division); end if;
  exception when others then null; end;
  return jsonb_build_object('ok',true,'context',ctx,'receipt',public.native_tournament_entry_receipt(item),'queue','[]'::jsonb,'more',false,'alreadySubmitted',false);
 end if;
 if exists(select 1 from jsonb_object_keys(p_data) k where k not in ('revision','entryId','updatedAt','decision','note','confirmed')) or p_data->>'decision' is null or p_data->>'decision' not in ('approve','decline') or jsonb_typeof(p_data->'note') is distinct from 'string' then return jsonb_build_object('ok',false,'status',400,'message','Check the decision details.'); end if;
 if p_data->>'revision' is distinct from ctx->>'revision' then return jsonb_build_object('ok',false,'status',409,'message','The division changed. Refresh requests.'); end if;
 begin entry_id:=(p_data->>'entryId')::uuid;expected_time:=(p_data->>'updatedAt')::timestamptz;
 exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then return jsonb_build_object('ok',false,'status',400,'message','Check the saved request.'); end;
 select * into item from public.tiq_tournament_entries where id=entry_id and tournament_id=p_division and status='pending' and native_registration->>'version'='1' for update;
 if not found or item.updated_at is distinct from expected_time then return jsonb_build_object('ok',false,'status',409,'message','This entry changed. Refresh requests.'); end if;
 note:=btrim(p_data->>'note');approved:=p_data->>'decision'='approve';
 if length(note) not between 1 and 600 or note~'[[:cntrl:]]' then return jsonb_build_object('ok',false,'status',400,'message','Add a short note to the player.'); end if;
 if approved then
  if p_data->'confirmed' is distinct from 'true'::jsonb or ctx->'canApprove' is distinct from 'true'::jsonb then return jsonb_build_object('ok',false,'status',409,'message','Check eligibility and confirm both players before approving an open draw.'); end if;
  native:=item.native_registration;one_name:=native->>'one';two_name:=coalesce(native->>'two','');
  if one_name is null or length(one_name) not between 1 and 90 or length(two_name)>90 or one_name~'[[:cntrl:]/]' or two_name~'[[:cntrl:]/]' or lower(one_name)=lower(nullif(two_name,'')) or native->'attested' is distinct from 'true'::jsonb or t.entrant_type='teams' and (two_name='' or native->'partnerAttested' is distinct from 'true'::jsonb) or t.entrant_type='players' and two_name<>'' or item.player_name is distinct from (one_name||case when two_name<>'' then ' / '||two_name else '' end) then return jsonb_build_object('ok',false,'status',409,'message','Player details changed. Review this request with the organizer.'); end if;
  if p_parent<>'' then
   if exists(select 1 from jsonb_each(root.event_details) x where x.key in ('feePerPlayer','feePerTeam') and jsonb_typeof(x.value)<>'number' and x.value<>'null'::jsonb) then return jsonb_build_object('ok',false,'status',409,'message','Review the event fees before approving.'); end if;
   fee:=round(coalesce(case when t.entrant_type='teams' then coalesce((root.event_details->>'feePerTeam')::numeric,2*(root.event_details->>'feePerPlayer')::numeric) else (root.event_details->>'feePerPlayer')::numeric end,0)*100);
   if fee<0 or fee>10000000 then return jsonb_build_object('ok',false,'status',409,'message','Review the event fees before approving.'); end if;
   desk:=public.save_tiq_event_registration(p_parent,jsonb_build_object('tournament_id',p_division,'player_one',one_name,'player_two',two_name,'status','confirmed','fee_cents',fee,'paid_cents',0,'note','Entry approved in TenAceIQ.'));
   native:=native||jsonb_build_object('registrationId',desk->>'id');
  else
   if exists(select 1 from unnest(t.entrants) n,regexp_split_to_table(n,'[[:space:]]*/[[:space:]]*') player where lower(btrim(player)) in (lower(one_name),nullif(lower(two_name),''))) then return jsonb_build_object('ok',false,'status',409,'message','A player is already in this draw. Refresh before deciding.'); end if;
   update public.tiq_tournaments set entrants=array_append(entrants,item.player_name),updated_by_user_id=actor,updated_at=clock_timestamp() where id=p_division;
  end if;
 else native:=item.native_registration; end if;
 update public.tiq_tournament_entries set status=case when approved then 'approved' else 'declined' end,native_registration=native||jsonb_build_object('decisionNote',note),eligibility_status=case when approved then 'verified' else 'needs_confirmation' end,eligibility_review_note=note,eligibility_reviewed_by=actor,eligibility_reviewed_at=clock_timestamp(),player_action_required=false,updated_at=clock_timestamp() where id=item.id returning * into item;
 recipient:=item.submitted_by_user_id;
 begin
  if recipient is not null and recipient<>actor then insert into public.internal_notifications(recipient_profile_id,actor_user_id,notification_type,title,body,href) values(recipient,actor,'system',case when approved then 'Tournament entry approved' else 'Tournament entry update' end,item.player_name||case when approved then ' is in the draw.' else ' was not approved. Open your entry for the organizer’s note.' end,'/tournaments/'||p_division); end if;
 exception when others then null; end;
 ctx:=public.native_tournament_entry_context(p_parent,p_division);
 return jsonb_build_object('ok',true,'context',ctx,'receipt',public.native_tournament_entry_receipt(item),'queue','[]'::jsonb,'more',false,'alreadySubmitted',false);
end $body$;
revoke all on function public.native_tournament_registration(text,text,text,jsonb) from public,anon;
grant execute on function public.native_tournament_registration(text,text,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
