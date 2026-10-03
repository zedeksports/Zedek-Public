'use client';

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";

function MatchRow({m,official}) {
  const live=["live","in_progress","halftime","paused"].includes(m.status);
  const finished=official && ["finished","verified"].includes(m.status);
  const score=live||finished ? `${m.home_score??0} — ${m.away_score??0}` : "vs";
  return <a className="competition-match" href={"/matches/"+m.id}>
    <div><small>{new Intl.DateTimeFormat("en-GH",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(m.scheduled_at))}</small>
      <strong>{m.home_team?.short_name||m.home_team?.name} <span>{score}</span> {m.away_team?.short_name||m.away_team?.name}</strong>
      <small>{m.venue||m.round_name||"Venue TBC"}</small>
    </div><b>{live?"LIVE":finished?"OFFICIAL":"View →"}</b>
  </a>;
}

export default function CompetitionPage() {
 const {id}=useParams();
 const [data,setData]=useState({competition:null,seasons:[],matches:[],stats:[],official:new Set(),loading:true,error:""});
 const [seasonId,setSeasonId]=useState("");
 const [tab,setTab]=useState("overview");

 useEffect(()=>{if(!id)return;const supabase=createSupabaseBrowserClient();
  async function load(){
   const [c,s,m,v,st]=await Promise.all([
    supabase.from("competitions").select("id,name,code,description,location,format,is_active,logo_url").eq("id",id).single(),
    supabase.from("seasons").select("id,name,year,start_date,end_date,is_active").eq("competition_id",id).order("year",{ascending:false}),
    supabase.from("matches").select("id,season_id,scheduled_at,status,home_score,away_score,venue,round_name,home_team:teams!matches_home_team_id_fkey(id,name,short_name,logo_url),away_team:teams!matches_away_team_id_fkey(id,name,short_name,logo_url),season:seasons!inner(id,name,competition_id)").eq("season.competition_id",id).order("scheduled_at",{ascending:true}).limit(200),
    supabase.from("match_verifications").select("match_id").eq("official_result",true),
    supabase.from("official_player_statistics").select("id,season_id,player_id,team_id,matches_played,starts,goals,assists,yellow_cards,red_cards,minutes_played,player:players(id,full_name,shirt_number,position,photo_url),team:teams(id,name,short_name,logo_url)").order("goals",{ascending:false}).order("assists",{ascending:false})
   ]);
   if(c.error){setData(x=>({...x,loading:false,error:c.error.message}));return}
   const seasons=s.data||[];
   setSeasonId(seasons[0]?.id||"");
   setData({competition:c.data,seasons,matches:m.data||[],stats:st.data||[],official:new Set((v.data||[]).map(x=>x.match_id)),loading:false,error:m.error||st.error?"Some competition data could not be loaded.":""});
  } load();
 },[id]);

 const currentSeason=useMemo(()=>data.seasons.find(s=>s.id===seasonId)||data.seasons[0],[data.seasons,seasonId]);
 const seasonMatches=useMemo(()=>data.matches.filter(m=>m.season_id===currentSeason?.id),[data.matches,currentSeason]);
 const seasonStats=useMemo(()=>data.stats.filter(x=>x.season_id===currentSeason?.id).sort((a,b)=>(b.goals||0)-(a.goals||0)||(b.assists||0)-(a.assists||0)),[data.stats,currentSeason]);

 if(data.loading)return <main><div className="container empty-state">Loading competition…</div></main>;
 if(data.error||!data.competition)return <main><div className="container data-note">{data.error||"Competition not found."}</div></main>;

 return <main>
  <section className="container competition-hero">
    <div className="competition-brand-mark">{data.competition.logo_url?<img src={data.competition.logo_url} alt=""/>:<span>{data.competition.name.slice(0,2).toUpperCase()}</span>}</div>
    <div><span className="section-kicker">{data.competition.location||"Oti"} • Competition</span><h1>{data.competition.name}</h1><p>{data.competition.description||"Official football competition hub."}</p></div>
  </section>
  <section className="container competition-detail">
    <div className="competition-season-bar">
      <div><span className="section-kicker">SEASON</span><select value={currentSeason?.id||""} onChange={e=>setSeasonId(e.target.value)}>{data.seasons.map(s=><option key={s.id} value={s.id}>{s.name}{s.year?" • "+s.year:""}</option>)}</select></div>
      <div className="competition-season-meta"><b>{seasonMatches.length}</b><span>Matches</span><b>{seasonStats.length}</b><span>Players</span></div>
    </div>

    <nav className="competition-hub-tabs" aria-label="Competition sections">
      {[["overview","Overview"],["matches","Matches"],["standings","Standings"],["scorers","Top scorers"],["players","Player stats"]].map(([key,label])=><button key={key} className={tab===key?"active":""} onClick={()=>setTab(key)}>{label}</button>)}
    </nav>

    {tab==="overview"&&<div className="competition-hub-grid">
      <section className="team-panel"><span className="section-kicker">SEASON HUB</span><h2>{currentSeason?.name||"Current season"}</h2><div className="competition-overview-stats"><div><b>{seasonMatches.length}</b><span>Published matches</span></div><div><b>{seasonStats.reduce((n,x)=>n+(x.goals||0),0)}</b><span>Recorded goals</span></div><div><b>{seasonStats.length}</b><span>Players tracked</span></div></div></section>
      <section className="team-panel"><span className="section-kicker">QUICK ACCESS</span><h2>Competition intelligence</h2><div className="competition-quick-links"><button onClick={()=>setTab("standings")}>Standings <span>→</span></button><button onClick={()=>setTab("scorers")}>Top scorers <span>→</span></button><button onClick={()=>setTab("players")}>Player statistics <span>→</span></button></div></section>
    </div>}

    {tab==="matches"&&<section className="detail-section"><div className="section-heading"><div><span className="section-kicker">FIXTURES & RESULTS</span><h2>{currentSeason?.name}</h2></div><a className="quiet-link" href="/matches">Match Centre →</a></div>{seasonMatches.length?<div className="competition-match-list">{seasonMatches.map(m=><MatchRow key={m.id} m={m} official={data.official.has(m.id)}/>)}</div>:<div className="empty-state">No matches published for this season yet.</div>}</section>}

    {tab==="standings"&&<section className="detail-section"><div className="section-heading"><div><span className="section-kicker">TABLE</span><h2>Season standings</h2></div><a className="quiet-link" href={"/standings?season="+(currentSeason?.id||"")}>Full standings →</a></div><div className="embedded-note">The season table is linked directly to the official standings engine. Open the full view for the complete ranking, form and tie-break details.</div></section>}

    {tab==="scorers"&&<section className="detail-section"><div className="section-heading"><div><span className="section-kicker">GOALS</span><h2>Top scorers</h2></div><a className="quiet-link" href={"/statistics?season="+(currentSeason?.id||"")+"&view=scorers"}>All statistics →</a></div>{seasonStats.length?<div className="embedded-stat-list">{seasonStats.slice(0,10).map((x,i)=><a href={"/players/"+x.player_id} className="embedded-stat-row" key={x.id}><b>{String(i+1).padStart(2,"0")}</b><div><strong>{x.player?.full_name||"Player"}</strong><span>{x.player?.position||"Player"} • {x.team?.short_name||x.team?.name||"Team"}</span></div><strong>{x.goals||0}<small> GOALS</small></strong></a>)}</div>:<div className="empty-state">No official player statistics have been published for this season yet.</div>}</section>}

    {tab==="players"&&<section className="detail-section"><div className="section-heading"><div><span className="section-kicker">PLAYER INTELLIGENCE</span><h2>Season player statistics</h2></div><a className="quiet-link" href={"/statistics?season="+(currentSeason?.id||"")+"&view=players"}>Full player stats →</a></div>{seasonStats.length?<div className="embedded-player-table">{seasonStats.slice(0,15).map(x=><a href={"/players/"+x.player_id} key={x.id}><div><strong>{x.player?.full_name||"Player"}</strong><span>{x.team?.short_name||x.team?.name||"Team"}</span></div><b>{x.matches_played||0}<small> APP</small></b><b>{x.goals||0}<small> G</small></b><b>{x.assists||0}<small> A</small></b><b>{x.minutes_played||0}<small> MIN</small></b></a>)}</div>:<div className="empty-state">Player statistics will appear after official results are recorded.</div>}</section>}
  </section>
 </main>;
}