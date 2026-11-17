-- Public read/submit at the user's request. A per-case secret still controls edits.
alter table public.culture_cases_v1 add column manager_review text not null default ''
  constraint culture_cases_v1_manager_review_length check (char_length(manager_review)<=5000);
grant select(manager_review),insert(manager_review),update(manager_review) on public.culture_cases_v1 to anon,authenticated;
alter policy culture_cases_read on public.culture_cases_v1 using (true);
alter policy culture_cases_submit on public.culture_cases_v1 with check (
 char_length(split_part(coalesce(current_setting('request.headers',true)::jsonb->>'x-client-info',''),'.',2))>=40
 and edit_hash=encode(sha256(convert_to(split_part(coalesce(current_setting('request.headers',true)::jsonb->>'x-client-info',''),'.',2),'UTF8')),'hex')
);
alter policy culture_cases_edit on public.culture_cases_v1 using (
 char_length(split_part(coalesce(current_setting('request.headers',true)::jsonb->>'x-client-info',''),'.',2))>=40
 and edit_hash=encode(sha256(convert_to(split_part(coalesce(current_setting('request.headers',true)::jsonb->>'x-client-info',''),'.',2),'UTF8')),'hex')
) with check (
 char_length(split_part(coalesce(current_setting('request.headers',true)::jsonb->>'x-client-info',''),'.',2))>=40
 and edit_hash=encode(sha256(convert_to(split_part(coalesce(current_setting('request.headers',true)::jsonb->>'x-client-info',''),'.',2),'UTF8')),'hex')
);
-- Compatibility for links opened by the previous static release. No access code required.
create or replace function public.culture_access_valid_v1() returns boolean language sql stable security invoker set search_path='' as $$ select true $$;
notify pgrst,'reload schema';
