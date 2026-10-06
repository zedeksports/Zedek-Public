import { createSupabaseServerClient } from "../lib/supabase/server";
import HomeScoreClient from "./HomeScoreClient";

const getHomeData = async () => {
  const supabase = createSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: matches, error: matchesError },
    { count: teamCount, error: teamsError },
    { count: competitionCount, error: competitionsError },
    { data: competitions, error: competitionListError },
    { data: news, error: newsError },
    { data: ads, error: adsError },
  ] = await Promise.all([
    supabase
      .from("matches")
      .select("id,scheduled_at,kickoff_at,halftime_at,second_half_at,status,home_score,away_score,venue,referee,home_team:teams!matches_home_team_id_fkey(id,name,short_name,logo_url,home_venue),away_team:teams!matches_away_team_id_fkey(id,name,short_name,logo_url,home_venue),season:seasons(id,name,competition:competitions(id,name))")
      .order("scheduled_at", { ascending: true })
      .limit(100),
    supabase.from("teams").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("competitions").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("competitions").select("id,name").eq("is_active", true).order("name", { ascending: true }).limit(20),
    supabase
      .from("content_posts")
      .select("id,title,slug,excerpt,cover_image_url,category,published_at")
      .eq("content_type", "news")
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(6),
    supabase
      .from("ad_slots")
      .select("id,name,placement,format,image_url,target_url")
      .eq("active", true)
      .or("start_date.is.null,start_date.lte." + today)
      .or("end_date.is.null,end_date.gte." + today)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const error = matchesError || teamsError || competitionsError || competitionListError || newsError || adsError;
  if (error) throw error;

  return {
    matches: matches || [],
    officialIds: [],
    teams: teamCount || 0,
    competitions: competitionCount || 0,
    competitionList: competitions || [],
    news: news || [],
    ads: ads || [],
    loading: false,
    error: "",
  };
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  let initialData = {
    matches: [],
    officialIds: [],
    teams: 0,
    competitions: 0,
    competitionList: [],
    news: [],
    ads: [],
    loading: false,
    error: "",
  };

  try {
    initialData = await getHomeData();
  } catch (error) {
    initialData.error = error?.message || "Football data could not be loaded.";
  }

  return (
    <main className="oti-home">
      <HomeScoreClient initialData={initialData} />
    </main>
  );
}
