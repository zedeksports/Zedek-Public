create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  theme text not null default 'system' check (theme in ('system','light','dark')),
  language text not null default 'en' check (language in ('en')),
  timezone text not null default 'Africa/Accra',
  match_sort text not null default 'time' check (match_sort in ('time','competition')),
  default_filter text not null default 'all' check (default_filter in ('all','live','upcoming','results','my_teams')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  kickoff boolean not null default true,
  lineup boolean not null default true,
  goal boolean not null default true,
  substitution boolean not null default true,
  yellow_card boolean not null default false,
  red_card boolean not null default true,
  halftime boolean not null default true,
  fulltime boolean not null default true,
  news boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_favorite_teams (
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, team_id)
);

create table if not exists public.user_favorite_matches (
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, match_id)
);

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text not null,
  match_id uuid references public.matches(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists idx_user_notifications_user_created on public.user_notifications(user_id, created_at desc);
create index if not exists idx_user_notifications_unread on public.user_notifications(user_id, read_at) where read_at is null;
create index if not exists idx_user_favorite_teams_team on public.user_favorite_teams(team_id);
create index if not exists idx_user_favorite_matches_match on public.user_favorite_matches(match_id);

alter table public.user_settings enable row level security;
alter table public.user_notification_preferences enable row level security;
alter table public.user_favorite_teams enable row level security;
alter table public.user_favorite_matches enable row level security;
alter table public.user_notifications enable row level security;

drop policy if exists "Users manage own settings" on public.user_settings;
create policy "Users manage own settings" on public.user_settings for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users manage own notification preferences" on public.user_notification_preferences;
create policy "Users manage own notification preferences" on public.user_notification_preferences for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users manage own favorite teams" on public.user_favorite_teams;
create policy "Users manage own favorite teams" on public.user_favorite_teams for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users manage own favorite matches" on public.user_favorite_matches;
create policy "Users manage own favorite matches" on public.user_favorite_matches for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users read own notifications" on public.user_notifications;
create policy "Users read own notifications" on public.user_notifications for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Users update own notifications" on public.user_notifications;
create policy "Users update own notifications" on public.user_notifications for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.ensure_public_user_rows()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, full_name, role, is_active)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'public_user', true)
  on conflict (id) do update set
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    updated_at = now();

  insert into public.user_settings (user_id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (user_id) do nothing;

  insert into public.user_notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_zedek_public on auth.users;
create trigger on_auth_user_created_zedek_public
after insert on auth.users
for each row execute function public.ensure_public_user_rows();

insert into public.user_settings (user_id, full_name)
select id, full_name from public.profiles
on conflict (user_id) do update set
  full_name = coalesce(public.user_settings.full_name, excluded.full_name);

insert into public.user_notification_preferences (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

create or replace function public.notify_match_followers(
  p_match_id uuid,
  p_notification_type text,
  p_title text,
  p_body text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  home_id uuid;
  away_id uuid;
begin
  select home_team_id, away_team_id into home_id, away_id
  from public.matches where id = p_match_id;

  insert into public.user_notifications(user_id, notification_type, title, body, match_id, team_id)
  select distinct u.user_id, p_notification_type, p_title, p_body, p_match_id,
         case when ft.team_id is not null then ft.team_id else home_id end
  from (
    select user_id from public.user_favorite_matches where match_id = p_match_id
    union
    select user_id from public.user_favorite_teams where team_id in (home_id, away_id)
  ) u
  left join public.user_notification_preferences pref on pref.user_id = u.user_id
  left join public.user_favorite_teams ft on ft.user_id = u.user_id and ft.team_id in (home_id, away_id)
  where case p_notification_type
    when 'kickoff' then coalesce(pref.kickoff,true)
    when 'lineup' then coalesce(pref.lineup,true)
    when 'goal' then coalesce(pref.goal,true)
    when 'substitution' then coalesce(pref.substitution,true)
    when 'yellow_card' then coalesce(pref.yellow_card,false)
    when 'red_card' then coalesce(pref.red_card,true)
    when 'halftime' then coalesce(pref.halftime,true)
    when 'fulltime' then coalesce(pref.fulltime,true)
    else false
  end;
end;
$$;

create or replace function public.notify_match_event_followers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  home_name text;
  away_name text;
  scorer_name text;
  title text;
  body text;
  kind text;
begin
  select ht.name, at.name into home_name, away_name
  from public.matches m
  join public.teams ht on ht.id=m.home_team_id
  join public.teams at on at.id=m.away_team_id
  where m.id=new.match_id;

  select full_name into scorer_name from public.players where id=new.player_id;
  kind := lower(coalesce(new.event_type,''));

  if kind in ('goal','own_goal') then
    title := 'Goal: ' || coalesce(scorer_name,'Match event');
    body := coalesce(home_name,'Home') || ' vs ' || coalesce(away_name,'Away') ||
      ' • ' || coalesce(new.minute::text,'?') || '''';
    perform public.notify_match_followers(new.match_id,'goal',title,body);
  elsif kind in ('substitution','sub') then
    perform public.notify_match_followers(new.match_id,'substitution','Substitution',
      coalesce(home_name,'Home') || ' vs ' || coalesce(away_name,'Away'));
  elsif kind in ('yellow_card','yellow') then
    perform public.notify_match_followers(new.match_id,'yellow_card','Yellow card',
      coalesce(scorer_name,'Player') || ' • ' || coalesce(home_name,'Home') || ' vs ' || coalesce(away_name,'Away'));
  elsif kind in ('red_card','red') then
    perform public.notify_match_followers(new.match_id,'red_card','Red card',
      coalesce(scorer_name,'Player') || ' • ' || coalesce(home_name,'Home') || ' vs ' || coalesce(away_name,'Away'));
  end if;

  return new;
end;
$$;

drop trigger if exists on_match_event_zedek_notifications on public.match_events;
create trigger on_match_event_zedek_notifications
after insert on public.match_events
for each row execute function public.notify_match_event_followers();

create or replace function public.notify_lineup_followers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  home_name text;
  away_name text;
begin
  select ht.name, at.name into home_name, away_name
  from public.matches m
  join public.teams ht on ht.id=m.home_team_id
  join public.teams at on at.id=m.away_team_id
  where m.id=new.match_id;

  perform public.notify_match_followers(
    new.match_id,'lineup','Lineups available',
    coalesce(home_name,'Home') || ' vs ' || coalesce(away_name,'Away') || ' • official lineup posted'
  );
  return new;
end;
$$;

drop trigger if exists on_match_lineup_zedek_notifications on public.match_lineups;
create trigger on_match_lineup_zedek_notifications
after insert on public.match_lineups
for each row execute function public.notify_lineup_followers();

create or replace function public.notify_match_status_followers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  home_name text;
  away_name text;
  title text;
  body text;
begin
  select ht.name, at.name into home_name, away_name
  from public.teams ht, public.teams at
  where ht.id=new.home_team_id and at.id=new.away_team_id;

  if new.status in ('live','in_progress') and coalesce(old.status::text,'') not in ('live','in_progress') then
    perform public.notify_match_followers(new.id,'kickoff','Match started',
      coalesce(home_name,'Home') || ' vs ' || coalesce(away_name,'Away') || ' • live now');
  elsif new.status='halftime' and old.status is distinct from new.status then
    perform public.notify_match_followers(new.id,'halftime','Half-time',
      coalesce(home_name,'Home') || ' ' || coalesce(new.home_score,0)::text || ':' || coalesce(new.away_score,0)::text || ' ' || coalesce(away_name,'Away'));
  elsif new.status in ('finished','verified') and old.status is distinct from new.status then
    title := 'Full-time';
    body := coalesce(home_name,'Home') || ' ' || coalesce(new.home_score,0)::text || ':' || coalesce(new.away_score,0)::text || ' ' || coalesce(away_name,'Away');
    perform public.notify_match_followers(new.id,'fulltime',title,body);
  end if;
  return new;
end;
$$;

drop trigger if exists on_match_status_zedek_notifications on public.matches;
create trigger on_match_status_zedek_notifications
after update of status, home_score, away_score on public.matches
for each row execute function public.notify_match_status_followers();
