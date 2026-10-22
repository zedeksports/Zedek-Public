import { unstable_cache } from "next/cache";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { ExplorePage, ExploreHeader, EmptyState } from "../ExploreChrome";
export const dynamic="force-dynamic";
const getCachedCompetitions=unstable_cache(async()=>{
 const {data,error}=await createSupabaseServerClient().from("competitions").select("id,name,code,description,location,format,is_active,logo_url").eq("is_active",true).order("name");
 return {data:data||[],error:error?{message:error.message}:null};
},["zedek-public-active-competitions-v1"],{revalidate:30});
function CompetitionCard({c}){return <a className="explore-card" href={"/competitions/"+c.id}><div className="explore-logo">{c.logo_url?<img src={c.logo_url} alt="" loading="lazy" decoding="async"/>:<span>⚽</span>}</div><div className="explore-card-main"><strong>{c.name}</strong><span>{c.location||"Oti"} · {c.format||"Competition"} · Fixtures & results</span></div><span className="explore-arrow">›</span></a>}
export default async function CompetitionsPage(){const {data,error}=await getCachedCompetitions();return <ExplorePage><ExploreHeader title="Competitions" eyebrow="Football Hub" description="Local competitions, seasons, fixtures and official results."/><section className="explore-feed">{error?<EmptyState>{error.message}</EmptyState>:data?.length?data.map(c=><CompetitionCard c={c} key={c.id}/>):<EmptyState>No competitions published yet.</EmptyState>}</section></ExplorePage>}