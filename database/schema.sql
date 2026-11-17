-- Every read/write requires a random 256-bit internal invitation, verified by SHA-256.
-- __ACCESS_HASH__ is replaced during provisioning. No plaintext invitation is in source.
-- Updating also requires a separate per-record edit secret. No anonymous deletion.
create table public.culture_cases_v1 (
 id uuid primary key default gen_random_uuid(),
 cycle text not null check (cycle ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
 title text not null check (char_length(title) between 1 and 160),
 theme text not null check (theme in ('感恩利他','诚信求真','顾客至上','尊重伙伴','协作共创','拥抱变化','专业卓越')),
 behavior text not null check (char_length(btrim(behavior)) between 1 and 500),
 store text not null check (store in ('仁恒河滨城店','碧云店','御翠园店','浦东别墅旗舰店','星河湾店','陆家嘴金融中心店','陆家嘴旗舰店','陆家嘴滨江店','顶级豪宅部','嘉御庭公馆店','尚海湾店','徐汇滨江店','徐汇一店','融创滨江壹号院店','长宁古北店','Hmall中心店','Hmall旗舰店','黄浦滨江店','新天地一店','新天地二店','复兴香园店')),
 team text not null default '' check (char_length(team)<=100),
 nominee text not null check (char_length(btrim(nominee)) between 1 and 100),
 joined_on date not null,
 recommender text not null check (char_length(btrim(recommender)) between 1 and 100),
 author text not null check (char_length(btrim(author)) between 1 and 100),
 event_on date not null,
 body text not null check (char_length(regexp_replace(body,'[[:space:]]','','g')) between 300 and 30000),
 reference_note text not null default '' check (char_length(reference_note)<=2000),
 edit_hash text not null check (edit_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (joined_on<=event_on),
 check (event_on between ((cycle||'-20')::date-interval '1 month')::date and (cycle||'-20')::date)
);
create index culture_cases_v1_cycle_theme on public.culture_cases_v1(cycle,theme);
create index culture_cases_v1_cycle_store on public.culture_cases_v1(cycle,store);
create unique index culture_cases_v1_duplicate on public.culture_cases_v1(cycle,store,nominee,event_on,md5(regexp_replace(body,'[[:space:]]','','g')));
alter table public.culture_cases_v1 enable row level security;
revoke all on public.culture_cases_v1 from public, anon, authenticated;
grant select(id,cycle,title,theme,behavior,store,team,nominee,joined_on,recommender,author,event_on,body,reference_note,created_at,updated_at) on public.culture_cases_v1 to anon,authenticated;
grant insert(id,cycle,title,theme,behavior,store,team,nominee,joined_on,recommender,author,event_on,body,reference_note,edit_hash) on public.culture_cases_v1 to anon,authenticated;
grant update(title,theme,behavior,store,team,nominee,joined_on,recommender,author,event_on,body,reference_note) on public.culture_cases_v1 to anon,authenticated;
create policy culture_cases_read on public.culture_cases_v1 for select to anon,authenticated using (encode(sha256(convert_to(split_part(coalesce(current_setting('request.headers',true)::jsonb->>'x-client-info',''),'.',1),'UTF8')),'hex')='__ACCESS_HASH__');
create policy culture_cases_submit on public.culture_cases_v1 for insert to anon,authenticated with check (
 encode(sha256(convert_to(split_part(coalesce(current_setting('request.headers',true)::jsonb->>'x-client-info',''),'.',1),'UTF8')),'hex')='__ACCESS_HASH__'
 and char_length(split_part(coalesce(current_setting('request.headers',true)::jsonb->>'x-client-info',''),'.',2))>=40
 and edit_hash=encode(sha256(convert_to(split_part(coalesce(current_setting('request.headers',true)::jsonb->>'x-client-info',''),'.',2),'UTF8')),'hex')
);
create policy culture_cases_edit on public.culture_cases_v1 for update to anon,authenticated using (
 encode(sha256(convert_to(split_part(coalesce(current_setting('request.headers',true)::jsonb->>'x-client-info',''),'.',1),'UTF8')),'hex')='__ACCESS_HASH__' and edit_hash=encode(sha256(convert_to(split_part(coalesce(current_setting('request.headers',true)::jsonb->>'x-client-info',''),'.',2),'UTF8')),'hex')
) with check (
 encode(sha256(convert_to(split_part(coalesce(current_setting('request.headers',true)::jsonb->>'x-client-info',''),'.',1),'UTF8')),'hex')='__ACCESS_HASH__' and edit_hash=encode(sha256(convert_to(split_part(coalesce(current_setting('request.headers',true)::jsonb->>'x-client-info',''),'.',2),'UTF8')),'hex')
);
create function public.culture_cases_touch_v1() returns trigger language plpgsql security invoker set search_path='' as $$
begin new.updated_at=now(); return new; end $$;
revoke all on function public.culture_cases_touch_v1() from public,anon,authenticated;
create trigger culture_cases_touch_v1 before update on public.culture_cases_v1 for each row execute function public.culture_cases_touch_v1();
notify pgrst,'reload schema';
create function public.culture_access_valid_v1() returns boolean language sql stable security invoker set search_path='' as $$ select encode(sha256(convert_to(split_part(coalesce(current_setting('request.headers',true)::jsonb->>'x-client-info',''),'.',1),'UTF8')),'hex')='__ACCESS_HASH__' $$;
grant execute on function public.culture_access_valid_v1() to anon,authenticated;
