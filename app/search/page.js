'use client';

import {useEffect,useState} from "react";
import {createSupabaseBrowserClient} from "../../lib/supabase/browser";

function initialQuery(){ if(typeof window==="undefined") return ""; return new URLSearchParams(window.location.search).get("q")||""; }

function Logo({url,label}) {
  return <div className="search-logo">{url ? <img src={url} alt="" /> : <span>{(label||"Z").slice(0,2).toUpperCase()}</span>}</div>;
}

export default function SearchPage() {
  const [q,setQ]=useState(initialQuery);
  const [results,setResults]=useState({teams:[],players:[],competitions:[],matches:[]});
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{
    const timer=setTimeout(()=>runSearch(q),250);
    return ()=>clearTimeout(timer);
  },[q]);

  async function runSearch(value) {
    const term=value.trim();
    if(!term){setResults({teams:[],players:[],competitions:[],matches:[]});setLoading(false);setError("");return;}
    setLoading(true);setError("");
    const s=createSupabaseBrowserClient();
    try {
      const [teams,players,competitions,matches]=await Promise.all([
        s.from("teams").select("id,name,short_name,area,logo_url").eq("is_active",true).or("name.ilike.%"+term+"%,short_name.ilike.%"+term+"%,area.ilike.%"+term+"%").limit(8),
        s.from("players").select("id,full_name,position,shirt_number,photo_url,team:teams!players_team_id_fkey(id,name,short_name,logo_url)").eq("is_active",true).or("full_name.ilike.%"+term+"%,position.ilike.%"+term+"%").limit(8),
        s.from("competitions").select("id,name,location,description").eq("is_active",true).or("name.ilike.%"+term+"%,location.ilike.%"+term+"%,description.ilike.%"+term+"%").limit(8),
        s.from("matches").select("id,scheduled_at,status,home_score,away_score,venue,home_team:teams!matches_home_team_id_fkey(id,name,short_name,logo_url),away_team:teams!matches_away_team_id_fkey(id,name,short_name,logo_url),season:seasons(id,name,competition:competitions(id,name))").order("scheduled_at",{ascending:false}).limit(100)
      ]);
      const firstError=[teams,players,competitions,matches].find(x=>x.error);
      if(firstError) throw firstError.error;
      const official=await s.from("match_verifications").select("match_id").eq("official_result",true);
      if(official.error) throw official.error;
      const officialIds=new Set((official.data||[]).map(x=>x.match_id));
      const matchData=(matches.data||[]).filter(m=>{
        const text=[m.home_team?.name,m.home_team?.short_name,m.away_team?.name,m.away_team?.short_name,m.season?.competition?.name,m.venue].filter(Boolean).join(" ").toLowerCase();
        return text.includes(term.toLowerCase()) || officialIds.has(m.id) && [m.home_score,m.away_score].join(" ").includes(term);
      });
      setResults({teams:(teams.data||[]).slice(0,8),players:(players.data||[]).slice(0,8),competitions:(competitions.data||[]).slice(0,8),matches:matchData.slice(0,8)});
    } catch(e) {
      setError(e.message||"Search could not be completed.");
    } finally { setLoading(false); }
  }

  const total=Object.values(results).reduce((n,x)=>n+x.length,0);
  return <main>
    <section className="container page-hero search-page-hero">
      <span className="section-kicker">Zedek Sports</span>
      <h1>Search football.</h1>
      <p>Find teams, players, competitions and published matches across local football.</p>
      <div className="search-field-wrap">
        <span>⌕</span>
        <input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Search a team, player, competition or match…" aria-label="Search Zedek Sports" />
        {q && <button onClick={()=>setQ("")} aria-label="Clear search">×</button>}
      </div>
    </section>
    <section className="container search-results">
      {!q.trim()?<div className="search-intro"><strong>Start with a name.</strong><span>Try “Dmk Ac Milan”, a player, competition or venue.</span></div>:loading?<div className="empty-state">Searching Zedek Sports…</div>:error?<div className="data-note">{error}</div>:!total?<div className="empty-state"><strong>No published matches found.</strong><span>Try a shorter name or another football term.</span></div>:<>
        {results.teams.length>0&&<ResultGroup title="Teams">{results.teams.map(x=><a className="search-result" href={"/teams/"+x.id} key={x.id}><Logo url={x.logo_url} label={x.short_name||x.name}/><div><span className="section-kicker">Team • {x.area||"Oti"}</span><h2>{x.name}</h2><p>{x.short_name||"Team profile"}</p></div><b>↗</b></a>)}</ResultGroup>}
        {results.players.length>0&&<ResultGroup title="Players">{results.players.map(x=><a className="search-result" href={"/players/"+x.id} key={x.id}><Logo url={x.photo_url} label={x.full_name}/><div><span className="section-kicker">Player • {x.team?.short_name||x.team?.name||"Team"}</span><h2>{x.full_name}</h2><p>{x.position||"Player"}{x.shirt_number!=null?" • #"+x.shirt_number:""}</p></div><b>↗</b></a>)}</ResultGroup>}
        {results.competitions.length>0&&<ResultGroup title="Competitions">{results.competitions.map(x=><a className="search-result" href={"/competitions/"+x.id} key={x.id}><Logo label={x.name}/><div><span className="section-kicker">Competition</span><h2>{x.name}</h2><p>{x.location||"Oti"}{x.description?" • "+x.description:""}</p></div><b>↗</b></a>)}</ResultGroup>}
        {results.matches.length>0&&<ResultGroup title="Matches">{results.matches.map(x=><a className="search-result" href={"/matches/"+x.id} key={x.id}><Logo url={x.home_team?.logo_url} label={x.home_team?.short_name||x.home_team?.name}/><div><span className="section-kicker">{x.season?.competition?.name||"Match"} • {new Intl.DateTimeFormat("en-GH",{day:"numeric",month:"short",year:"numeric"}).format(new Date(x.scheduled_at))}</span><h2>{x.home_team?.short_name||x.home_team?.name||"Home"} {x.status==="finished"||x.status==="verified"?x.home_score+" — "+x.away_score:"vs"} {x.away_team?.short_name||x.away_team?.name||"Away"}</h2><p>{x.venue||"Venue TBC"}</p></div><b>↗</b></a>)}</ResultGroup>}
      </>}
    </section>
  </main>;
}

function ResultGroup({title,children}) {
 return <section className="search-group"><div className="section-heading"><div><span className="section-kicker">Explore</span><h2>{title}</h2></div></div>{children}</section>;
}
