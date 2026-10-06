-- Prevent duplicate follower notifications when a user follows both teams.
-- Favorite match followers and favorite team followers are collapsed to one recipient per user.
create or replace function public.notify_match_followers(
  p_match_id uuid,
  p_notification_type text,
  p_title text,
  p_body text
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  home_id uuid;
  away_id uuid;
begin
  if auth.uid() is not null
     and not exists (
       select 1
       from public.profiles p
       where p.id = auth.uid()
         and p.is_active = true
         and p.role in ('super_admin','zedek_admin','reporter')
     ) then
    raise exception 'not authorized to notify match followers';
  end if;

  select home_team_id, away_team_id
    into home_id, away_id
  from public.matches
  where id = p_match_id;

  with recipients as (
    select user_id
    from public.user_favorite_matches
    where match_id = p_match_id
    union
    select user_id
    from public.user_favorite_teams
    where team_id in (home_id, away_id)
  )
  insert into public.user_notifications (
    user_id, notification_type, title, body, match_id, team_id
  )
  select
    r.user_id,
    p_notification_type,
    p_title,
    p_body,
    p_match_id,
    favorite_team.team_id
  from recipients r
  left join public.user_notification_preferences pref
    on pref.user_id = r.user_id
  left join lateral (
    select uft.team_id
    from public.user_favorite_teams uft
    where uft.user_id = r.user_id
      and uft.team_id in (home_id, away_id)
    order by
      case when uft.team_id = home_id then 0 else 1 end,
      uft.created_at desc,
      uft.team_id
    limit 1
  ) favorite_team on true
  where case p_notification_type
    when 'kickoff' then coalesce(pref.kickoff, true)
    when 'lineup' then coalesce(pref.lineup, true)
    when 'goal' then coalesce(pref.goal, true)
    when 'substitution' then coalesce(pref.substitution, true)
    when 'yellow_card' then coalesce(pref.yellow_card, false)
    when 'red_card' then coalesce(pref.red_card, true)
    when 'halftime' then coalesce(pref.halftime, true)
    when 'fulltime' then coalesce(pref.fulltime, true)
    else false
  end;
end;
$function$;
