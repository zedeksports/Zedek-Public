'use client';

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";

function MatchRow({m,official}){
 const live=["live","in_progress","halftime"].includes(m.status);
 const finished=official && ["finished","verified"].includes(m.status);
 const score=live||finished ? String(m.home_score??0)+" — "+String(m.away_score??0) : "vs";
 return <a className="competition-match" href={"/matches/"+m.id}><div><small>{new Intl.DateTimeFormat("en-GH",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(m.scheduled_at))}</small><strong>{m.home_team?.short_name||m.home_team?.name} <span>{score}</span> {m.away_team?.short_name||m.away_team?.name}</strong><small>{m.venue||m.round_name||"Venue TBC"}</small></div><b>{live?"LIVE":finished?"OFFICIAL":"View →"}</b></a>;
}

export default function CompetitionPage(){
 const {id}=useParams();
 const [data,setData]=useState({competition:null,seasons:[],matches:[],official:new Set(),loading:true,error:""});
 useEffect(()=>{if(!id)return;const supabase=createSupabaseBrowserClient();
  async function load(){
   const [c,s,m,v]=await Promise.all([
    supabase.from("competitions").select("id,name,code,description,location,format,is_active").eq("id",id).single(),
    supabase.from("seasons").select("id,name,year,start_date,end_date,is_active").eq("competition_id",id).order("year",{ascending:false}),
    supabase.from("matches").select("id,season_id,scheduled_at,status,home_score,away_score,venue,round_name,home_team:teams!matches_home_team_id_fkey(id,name,short_name,logo_url),away_team:teams!matches_away_team_id_fkey(id,name,short_name,logo_url),season:seasons!inner(id,name,competition_id)").eq("season.competition_id",id).order("scheduled_at",{ascending:true}).limit(200),
    supabase.from("match_verifications").select("match_id").eq("official_result",true)
   ]);
   if(c.error){setData(x=>({...x,loading:false,error:c.error.message}));return}
   setData({competition:c.data,seasons:s.data||[],matches:m.data||[],official:new Set((v.data||[]).map(x=>x.match_id)),loading:false,error:m.error?"Some fixtures could not be loaded.":""});
  } load();
 },[id]);
 if(data.loading)return <main><div className="container empty-state">Loading competition…</div></main>;
 if(data.error||!data.competition)return <main><div className="container data-note">{data.error||"Competition not found."}</div></main>;
 const bySeason=data.seasons.map(s=>({...s,matches:data.matches.filter(m=>m.season_id===s.id)}));
 return <main><section className="container page-hero"><span className="section-kicker">{data.competition.location||"Oti"} • Competition</span><h1>{data.competition.name}</h1><p>{data.competition.description||"Official fixtures, results and competition information from Zedek Sports."}</p></section><section className="container competition-detail"><div className="stats-strip"><div><b>{data.seasons.length}</b><span>Seasons</span></div><div><b>{data.matches.length}</b><span>Published matches</span></div><div><b>{data.competition.format||"Local"}</b><span>Format</span></div></div>{bySeason.length?bySeason.map(s=><section className="detail-section" key={s.id}><div className="section-heading"><div><span className="section-kicker">{s.year||"Season"}</span><h2>{s.name}</h2></div><a className="quiet-link" href={"/statistics?season="+s.id}>View statistics →</a></div>{s.matches.length?<div className="competition-match-list">{s.matches.map(m=><MatchRow key={m.id} m={m} official={data.official.has(m.id)}/>)}</div>:<div className="empty-state">No matches published for this season yet.</div>}</section>):<div className="empty-state">No seasons published for this competition yet.</div>}</section></main>;
}