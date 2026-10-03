import { createSupabaseServerClient } from "../../lib/supabase/server";

export const dynamic="force-dynamic";
function CompetitionCard({c}){return <a className="competition-card" href={"/competitions/"+c.id}><span className="section-kicker">{c.location||"Oti"}</span><h2>{c.name}</h2><p>{c.description||"Follow fixtures, results and competition football on Zedek Sports."}</p><span className="quiet-link">Explore competition →</span></a>;}

export default async function CompetitionsPage(){
 const {data:competitions,error}=await createSupabaseServerClient().from("competitions").select("id,name,code,description,location,format,is_active").eq("is_active",true).order("name");
 return <main><section className="container page-hero"><span className="section-kicker">Zedek Sports</span><h1>Competitions</h1><p>Explore local football competitions, their seasons, fixtures and official results.</p></section><section className="container competition-grid">{error?<div className="data-note">{error.message}</div>:competitions?.length?competitions.map(c=><CompetitionCard c={c} key={c.id}/>):<div className="empty-state"><strong>No competitions published yet.</strong><span>Active competitions will appear here when published.</span></div>}</section></main>;
}