import { createSupabaseServerClient } from "../lib/supabase/server";
import HomeScoreClient from "./HomeScoreClient";

const LIVE_STATUSES = new Set(["live", "in_progress", "halftime", "paused"]);
const FINISHED_STATUSES = new Set(["finished", "verified"]);

function dateKey(value) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Africa/Accra",
  }).format(new Date(value));
}

export default async function HomePage() {
  let initialData = {
    matches: [],
    officialIds: [],
    teams: 0,
    competitions: 0,
    loading: false,
    error: "",
  };

  try {
    const supabase = createSupabaseServerClient();
    const [{ data: matches, error: matchesError }, { data: verifications, error: verificationError }, { count: teamCount, error: teamsError }, { count: competitionCount, error: competitionsError }] = await Promise.all([
      supabase.from("matches")
        .select("id,scheduled_at,status,home_score,away_score,home_team:teams!matches_home_team_id_fkey(id,name,short_name,logo_url),away_team:teams!matches_away_team_id_fkey(id,name,short_name,logo_url),season:seasons(id,name,competition:competitions(id,name))")
        .order("scheduled_at", { ascending: true }).limit(100),
      supabase.from("match_verifications").select("match_id").eq("official_result", true),
      supabase.from("teams").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("competitions").select("id", { count: "exact", head: true }).eq("is_active", true),
    ]);

    const error = matchesError || verificationError || teamsError || competitionsError;
    if (error) throw error;

    const officialIds = (verifications || []).map((x) => x.match_id);
    initialData = {
      matches: matches || [],
      officialIds,
      teams: teamCount || 0,
      competitions: competitionCount || 0,
      loading: false,
      error: "",
    };
  } catch (error) {
    initialData.error = error?.message || "Football data could not be loaded.";
  }

  return <HomeScoreClient initialData={initialData} />;
}
