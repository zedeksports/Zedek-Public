drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create index if not exists idx_user_notifications_match on public.user_notifications(match_id);
create index if not exists idx_user_notifications_team on public.user_notifications(team_id);