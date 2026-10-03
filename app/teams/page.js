import { createSupabaseServerClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

function Logo({team}){return <div className="team-logo">{team?.logo_url?<img src={team.logo_url} alt=""/>:<span>{(team?.short_name||team?.name||"T").slice(0,3).toUpperCase()}</span>}</div>;}

export default async function TeamsPage(){
 const {data:teams,error}=await createSupabaseServerClient().from("teams").select("id,name,short_name,area,home_venue,logo_url").eq("is_active",true).order("name",{ascending:true});
 return <main><section className="container page-hero"><span className="section-kicker">Zedek Sports • Local football</span><h1>Teams</h1><p>Discover the clubs, identities and football communities across Oti.</p></section><section className="container teams-page">{error?<div className="data-note"><strong>Public football feed unavailable.</strong><span>{error.message}</span></div>:teams?.length?<div className="team-directory">{teams.map(t=><a className="team-directory-card" href={"/teams/"+t.id} key={t.id}><Logo team={t}/><div><span className="section-kicker">{t.area||"Oti"}</span><h2>{t.name}</h2><p>{t.short_name||"Team profile"}{t.home_venue?" • "+t.home_venue:""}</p></div><span className="team-arrow">↗</span></a>)}</div>:<div className="empty-state"><strong>No active teams published yet.</strong><span>Teams registered in the Control Room will appear here automatically.</span></div>}</section></main>;
}