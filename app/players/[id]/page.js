'use client';

import {useEffect,useMemo,useState} from "react";
import {useParams} from "next/navigation";
import {createSupabaseBrowserClient} from "../../../lib/supabase/browser";

function date(v){return v?new Intl.DateTimeFormat("en-GH",{day:"numeric",month:"short",year:"numeric"}).format(new Date(v)):"Date TBC"}

export default function PlayerDetail(){
  const {id}=useParams();
  const [player,setPlayer]=useState(null),[stats,setStats]=useState([]),[matches,setMatches]=useState([]),[official,setOfficial]=useState(new Set()),[loading,setLoading]=useState(true),[error,setError]=useState("");

  useEffect(()=>{if(!id)return;async function load(){
    const s=createSupabaseBrowserClient();
    const p=await s.from("players").select("id,team_id,full_name,shirt_number,position,is_captain,photo_url,date_of_birth,nationality,team:teams!players_team_id_fkey(id,name,short_name,area,logo_url)").eq("id",id).eq("is_active",true).maybeSingle();
    if(p.error){setError(p.error.message);setLoading(false);return;}
    if(!p.data){setPlayer(null);setLoading(false);return;}
    const [st,m,v]=await Promise.all([
      s.from("official_player_statistics").select("id,season_id,team_id,matches_played,starts,goals,assists,yellow_cards,red_cards,minutes_played,season:seasons(id,name,competition:competitions(id,name)),team:teams(id,name,short_name,logo_url)").eq("player_id",id).order("updated_at",{ascending:false}),
      s.from("matches").select("id,scheduled_at,status,home_score,away_score,home_team_id,away_team_id,home_team:teams!matches_home_team_id_fkey(id,name,short_name,logo_url),away_team:teams!matches_away_team_id_fkey(id,name,short_name,logo_url),season:seasons(id,name,competition:competitions(id,name))").or("home_team_id.eq."+p.data.team_id+",away_team_id.eq."+p.data.team_id).order("scheduled_at",{ascending:false}).limit(10),
      s.from("match_verifications").select("match_id").eq("official_result",true)
    ]);
    const e=st.error||m.error||v.error;
    if(e)setError(e.message);else{setPlayer(p.data);setStats(st.data||[]);setMatches(m.data||[]);setOfficial(new Set((v.data||[]).map(x=>x.match_id)));}
    setLoading(false);
  }load()},[id]);
  const totals=useMemo(()=>stats.reduce((a,x)=>{a.apps+=x.matches_played||0;a.starts+=x.starts||0;a.goals+=x.goals||0;a.assists+=x.assists||0;a.yc+=x.yellow_cards||0;a.rc+=x.red_cards||0;a.minutes+=x.minutes_played||0;return a},{apps:0,starts:0,goals:0,assists:0,yc:0,rc:0,minutes:0}),[stats]);

  if(loading)return <main><section className="container page-hero"><span className="section-kicker">Zedek Sports</span><h1>Player</h1><p>Loading official player profile…</p></section></main>;
  if(error||!player)return <main><section className="container page-hero"><span className="section-kicker">Zedek Sports</span><h1>Player not found</h1><p>{error||"This player is not currently published."}</p><a className="button" href="/teams">← Back to teams</a></section></main>;

  return <main>
    <section className="container player-profile-hero">
      <div className="player-profile-photo">{player.photo_url?<img src={player.photo_url} alt=""/>:<span>{(player.full_name||"P").slice(0,1)}</span>}</div>
      <div className="player-profile-identity">
        <span className="section-kicker">{player.team?.area||"Oti local football"}</span>
        <h1>{player.full_name}</h1>
        <p>{player.position||"Player"} {player.shirt_number!=null?" • #"+player.shirt_number:""}{player.is_captain?" • Captain":""}</p>
        {player.team&&<a href={"/teams/"+player.team.id} className="player-team-link">{player.team.short_name||player.team.name}</a>}
      </div>
    </section>
    <section className="container player-page">
      <div className="player-stat-strip">
        <div><b>{totals.apps}</b><span>Apps</span></div><div><b>{totals.starts}</b><span>Starts</span></div><div><b>{totals.goals}</b><span>Goals</span></div><div><b>{totals.assists}</b><span>Assists</span></div><div><b>{totals.minutes}</b><span>Minutes</span></div>
      </div>
      <div className="player-profile-grid">
        <section className="team-panel"><span className="section-kicker">Player</span><h2>Profile</h2><div className="info-list">{player.position&&<div><span>Position</span><b>{player.position}</b></div>}{player.shirt_number!=null&&<div><span>Shirt number</span><b>#{player.shirt_number}</b></div>}{player.date_of_birth&&<div><span>Date of birth</span><b>{date(player.date_of_birth)}</b></div>}{player.team&&<div><span>Team</span><b>{player.team.name}</b></div>}</div></section>
        <section className="team-panel player-stats-panel"><span className="section-kicker">Official statistics</span><h2>Season record</h2>{stats.length?<div className="player-season-list">{stats.map(x=><div className="player-season-row" key={x.id}><div><strong>{x.season?.competition?.name||"Competition"}</strong><span>{x.season?.name||"Season"} • {x.team?.name||player.team?.name||"Team"}</span></div><div className="player-season-numbers"><b>{x.matches_played}</b><span>Apps</span><b>{x.goals}</b><span>Goals</span><b>{x.assists}</b><span>Assists</span><b>{x.minutes_played}</b><span>Min</span></div></div>)}</div>:<div className="empty-state compact"><strong>No official statistics yet.</strong><span>Statistics appear after verified matches are recorded.</span></div>}</section>
      </div>
      <section className="team-panel player-match-panel"><span className="section-kicker">Match history</span><h2>Official appearances</h2>{matches.length?<div className="team-match-list">{matches.map(m=>{const home=m.home_team_id===player.team_id,officialResult=official.has(m.id)&&["finished","verified"].includes(m.status);return <a className="team-match-row" href={"/matches/"+m.id} key={m.id}><div className="team-match-date"><b>{date(m.scheduled_at)}</b><span>{m.season?.competition?.name||"Competition"}</span></div><div className="team-match-opponent"><span>{home?"vs":"at"}</span><strong>{home?(m.away_team?.short_name||m.away_team?.name):(m.home_team?.short_name||m.home_team?.name)||"Opponent"}</strong></div><div className="team-match-score">{officialResult?<strong>{m.home_score} — {m.away_score}</strong>:<span className="match-status">Official result pending</span>}</div></a>})}</div>:<div className="empty-state compact"><strong>No match history yet.</strong><span>Official appearances will appear here as verified matches are recorded.</span></div>}</section>
    </section>
  </main>;
}
