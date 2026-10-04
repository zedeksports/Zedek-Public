import { createSupabaseServerClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

function formForTeam(teamId, matches) {
  return matches.filter(m => m.home_team_id === teamId || m.away_team_id === teamId).slice(0,5).map(m => {
    const home = m.home_team_id === teamId;
    const gf = home ? m.home_score : m.away_score;
    const ga = home ? m.away_score : m.home_score;
    return gf > ga ? "W" : gf < ga ? "L" : "D";
  });
}

export default async function IntelligencePage() {
  const s = createSupabaseServerClient();
  const [{data:stats,error:statsError},{data:matches,error:matchesError},{data:teams,error:teamsError},{data:matchStats,error:matchStatsError}] = await Promise.all([
    s.from("official_player_statistics").select("id,player_id,team_id,season_id,matches_played,goals,assists,yellow_cards,red_cards,minutes_played,player:players(id,full_name,position,photo_url),team:teams(id,name,short_name,logo_url)").order("goals",{ascending:false}).order("assists",{ascending:false}).limit(500),
    s.from("matches").select("id,scheduled_at,status,home_score,away_score,home_team_id,away_team_id,home_team:teams!matches_home_team_id_fkey(id,name,short_name),away_team:teams!matches_away_team_id_fkey(id,name,short_name)").in("status",["finished","verified"]).order("scheduled_at",{ascending:false}).limit(300),
    s.from("teams").select("id,name,short_name,logo_url").eq("is_active",true).order("name"),
    s.from("match_statistics").select("home_possession,away_possession,home_shots,away_shots,home_corners,away_corners,home_xg,away_xg")
  ]);
  const error=statsError||matchesError||teamsError||matchStatsError;
  const scorers=[...(stats||[])].sort((a,b)=>(b.goals||0)-(a.goals||0)||(b.assists||0)-(a.assists||0)).slice(0,10);
  const assists=[...(stats||[])].sort((a,b)=>(b.assists||0)-(a.assists||0)||(b.goals||0)-(a.goals||0)).slice(0,10);
  const officialMatches=matches||[];
  const goals=officialMatches.reduce((n,m)=>n+(m.home_score||0)+(m.away_score||0),0);
  const totalShots=(matchStats||[]).reduce((n,m)=>n+(m.home_shots||0)+(m.away_shots||0),0);
  const totalCorners=(matchStats||[]).reduce((n,m)=>n+(m.home_corners||0)+(m.away_corners||0),0);
  const totalXg=(matchStats||[]).reduce((n,m)=>n+Number(m.home_xg||0)+Number(m.away_xg||0),0);
  const formTeams=(teams||[]).map(t=>({...t,form:formForTeam(t.id,officialMatches)})).filter(t=>t.form.length);
  return <main>
    <section className="container page-hero"><span className="section-kicker">Zedek Sports • Intelligence</span><h1>Football intelligence.</h1><p>Official results, player output, team form and match-performance data connected to the verified football record.</p></section>
    <section className="container intelligence-page">
      {error ? <div className="data-note">{error.message}</div> : null}
      <div className="intelligence-metrics">
        <div><b>{officialMatches.length}</b><span>Official matches</span></div>
        <div><b>{goals}</b><span>Goals</span></div>
        <div><b>{totalShots}</b><span>Shots tracked</span></div>
        <div><b>{totalCorners}</b><span>Corners tracked</span></div>
        <div><b>{totalXg.toFixed(1)}</b><span>Combined xG</span></div>
      </div>
      <div className="intelligence-grid">
        <section className="team-panel"><span className="section-kicker">GOALS</span><h2>Top scorers</h2>{scorers.length?<div className="intelligence-list">{scorers.map((x,i)=><a href={"/players/"+x.player_id} key={x.id}><b>{i+1}</b><div><strong>{x.player?.full_name||"Player"}</strong><span>{x.team?.short_name||x.team?.name||"Team"}</span></div><strong>{x.goals||0}</strong></a>)}</div>:<div className="empty-state compact">No official scorer data yet.</div>}<a className="button intelligence-link" href="/statistics?view=scorers">All scorers →</a></section>
        <section className="team-panel"><span className="section-kicker">CREATIVITY</span><h2>Assist leaders</h2>{assists.length?<div className="intelligence-list">{assists.map((x,i)=><a href={"/players/"+x.player_id} key={x.id}><b>{i+1}</b><div><strong>{x.player?.full_name||"Player"}</strong><span>{x.team?.short_name||x.team?.name||"Team"}</span></div><strong>{x.assists||0}</strong></a>)}</div>:<div className="empty-state compact">No official assist data yet.</div>}<a className="button intelligence-link" href="/statistics?view=players">Player statistics →</a></section>
        <section className="team-panel intelligence-wide"><span className="section-kicker">FORM</span><h2>Recent team form</h2>{formTeams.length?<div className="form-table">{formTeams.map(t=><div key={t.id}><a href={"/teams/"+t.id}><strong>{t.short_name||t.name}</strong></a><span>{t.form.map((v,i)=><i key={i} className={"form-"+v.toLowerCase()}>{v}</i>)}</span></div>)}</div>:<div className="empty-state compact">Team form will appear after verified results are recorded.</div>}<a className="button intelligence-link" href="/standings">Standings & full table →</a></section>
        <section className="team-panel intelligence-wide"><span className="section-kicker">MATCH PERFORMANCE</span><h2>Tracked match metrics</h2><div className="metric-list"><div><span>Shots</span><b>{totalShots}</b></div><div><span>Corners</span><b>{totalCorners}</b></div><div><span>xG</span><b>{totalXg.toFixed(1)}</b></div><div><span>Matches with stats</span><b>{(matchStats||[]).length}</b></div></div><a className="button intelligence-link" href="/matches">Open match centre →</a></section>
      </div>
    </section>
  </main>;
}