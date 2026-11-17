-- Relax submission metadata only. Invitation / per-record editing policies are preserved.
alter table public.culture_cases_v1
 alter column behavior set default '',
 alter column nominee set default '',
 alter column recommender set default '',
 alter column author set default '',
 alter column joined_on drop not null,
 alter column event_on drop not null,
 drop constraint culture_cases_v1_behavior_check,
 drop constraint culture_cases_v1_nominee_check,
 drop constraint culture_cases_v1_recommender_check,
 drop constraint culture_cases_v1_author_check,
 drop constraint culture_cases_v1_body_check,
 drop constraint culture_cases_v1_check,
 drop constraint culture_cases_v1_check1,
 add constraint culture_cases_v1_behavior_length check (char_length(behavior)<=500),
 add constraint culture_cases_v1_nominee_length check (char_length(nominee)<=100),
 add constraint culture_cases_v1_recommender_length check (char_length(recommender)<=100),
 add constraint culture_cases_v1_author_length check (char_length(author)<=100),
 add constraint culture_cases_v1_body_length check (char_length(regexp_replace(body,'[[:space:]]','','g')) between 1 and 100000);
drop index public.culture_cases_v1_duplicate;
notify pgrst,'reload schema';
