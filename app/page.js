import { unstable_cache } from "next/cache";
import { createSupabaseServerClient } from "../lib/supabase/server";
import HomeScoreClient from "./HomeScoreClient";

const getHomeData = unstable_cache(
  async () => {
    const supabase = createSupabaseServerClient();
    const [{ data: matches, error: matchesError }, { count: teamCount, error: teamsError }, { count: competitionCount, error: competitionsError }, { data: ads, error: adsError }] = await Promise.all([
      supabase.from("matches")
        .select("id,scheduled_at,status,home_score,away_score,home_team:teams!matches_home_team_id_fkey(id,name,short_name,logo_url),away_team:teams!matches_away_team_id_fkey(id,name,short_name,logo_url),season:seasons(id,name,competition:competitions(id,name))")
        .order("scheduled_at", { ascending: true }).limit(100),
      supabase.from("teams").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("competitions").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("ad_slots").select("id,name,placement,format,image_url,target_url").eq("active", true).or("start_date.is.null,start_date.lte."+new Date().toISOString().slice(0,10)).or("end_date.is.null,end_date.gte."+new Date().toISOString().slice(0,10)).order("created_at",{ascending:false}).limit(6),
    ]);

    const error = matchesError || teamsError || competitionsError || adsError;
    if (error) throw error;

    return {
      matches: matches || [],
      officialIds: [],
      teams: teamCount || 0,
      competitions: competitionCount || 0,
      ads: ads || [],
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
    ads: [],
    loading: false,
    error: "",
  };

  try {
    initialData = await getHomeData();
  } catch (error) {
    initialData.error = error?.message || "Football data could not be loaded.";
  }

  return <main>
    {initialData.ads?.length ? <section className="container section" aria-label="Sponsors and advertising"><div className="home-dashboard"><div className="dashboard-card dashboard-card-wide"><div className="card-heading"><div><span className="section-kicker">Partners</span><h3>Supporting local football</h3></div></div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}}>{initialData.ads.map(ad=><a key={ad.id} href={ad.target_url||"#"} target={ad.target_url?"_blank":undefined} rel={ad.target_url?"noreferrer":undefined} className="news-card" style={{textDecoration:"none"}}><div className="news-cover">{ad.image_url?<img src={ad.image_url} alt="" loading="lazy" decoding="async"/>:<span>{ad.name}</span>}</div><div className="news-card-body"><span className="section-kicker">{ad.placement||"Partner"}</span><h2>{ad.name}</h2></div></a>)}</div></div></div></section> : null}
    <HomeScoreClient initialData={initialData} />
  </main>;
}
