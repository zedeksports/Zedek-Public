import { unstable_cache } from "next/cache";
import { createSupabaseServerClient } from "../lib/supabase/server";
import HomeScoreClient from "./HomeScoreClient";

const getHomeData = unstable_cache(
  async () => {
    const supabase = createSupabaseServerClient();
    const [{ data: matches, error: matchesError }, { count: teamCount, error: teamsError }, { count: competitionCount, error: competitionsError }] = await Promise.all([
      supabase.from("matches")
        .select("id,scheduled_at,status,home_score,away_score,home_team:teams!matches_home_team_id_fkey(id,name,short_name,logo_url),away_team:teams!matches_away_team_id_fkey(id,name,short_name,logo_url),season:seasons(id,name,competition:competitions(id,name))")
        .order("scheduled_at", { ascending: true }).limit(100),
      supabase.from("teams").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("competitions").select("id", { count: "exact", head: true }).eq("is_active", true),
    ]);

    const error = matchesError || teamsError || competitionsError;
    if (error) throw error;

    return {
      matches: matches || [],
      officialIds: [],
      teams: teamCount || 0,
      competitions: competitionCount || 0,
      loading: false,
      error: "",
    };
  },
  ["zedek-public-home-data"],
  { revalidate: 15 }
);

export const revalidate = 15;

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
    initialData = await getHomeData();
  } catch (error) {
    initialData.error = error?.message || "Football data could not be loaded.";
  }

  return <HomeScoreClient initialData={initialData} />;
}
