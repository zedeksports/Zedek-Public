-- notify_match_followers is an internal SECURITY DEFINER function invoked by database triggers.
-- Prevent direct execution through the exposed Supabase RPC surface.
revoke execute on function public.notify_match_followers(uuid, text, text, text) from authenticated;
revoke execute on function public.notify_match_followers(uuid, text, text, text) from anon;
