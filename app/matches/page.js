'use client';

import {useEffect,useMemo,useState} from "react";
import {createSupabaseBrowserClient} from "../../lib/supabase/browser";

const LIVE=["live","in_progress","halftime","paused"];
const FINISHED=["finished","verified"];

function dateKey(v){
  return new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Accra",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(v));
}
function fmt(v){
  return v?new Intl.DateTimeFormat("en-GH",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",timeZone:"Africa/Accra"}).format(new Date(v)):"Date TBC";
}
function dayLabel(v){
  return new Intl.DateTimeFormat("en-GH",{weekday:"short",day:"numeric",month:"short",timeZone:"Africa/Accra"}).format(new Date(v));
}
function Team({team}){
  return <div className="mc-team"><div className="mc-logo">{team?.logo_url?<img src={team.logo_url} alt=""/>:<span>{(team?.short_name||team?.name||"?").slice(0,2).toUpperCase()}</span>}</div><strong>{team?.short_name||team?.name||"Team TBC"}</strong></div>;
}

export default function MatchesPage(){
  const [matches,setMatches]=useState([]);
  const [official,setOfficial]=useState(new Set());
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [selectedDate,setSelectedDate]=useState(dateKey(new Date()));
  const [filter,setFilter]=useState("all");
  useEffect(()=>{const requested=new URLSearchParams(window.location.search).get("filter");if(["all","upcoming","live","results"].includes(requested))setFilter(requested);},[]);

  useEffect(()=>{
    async function load(){
      try{
        const s=createSupabaseBrowserClient();
        const [{data:ms,error:me},{data:vs,error:ve}]=await Promise.all([
          s.from("matches").select("id,scheduled_at,status,home_score,away_score,home_team:teams!matches_home_team_id_fkey(id,name,short_name,logo_url),away_team:teams!matches_away_team_id_fkey(id,name,short_name,logo_url),season:seasons(id,name,competition:competitions(id,name))").order("scheduled_at",{ascending:true}).limit(500),
          s.from("match_verifications").select("match_id").eq("official_result",true)
        ]);
        if(me||ve) throw me||ve;
        setMatches(ms||[]);
        setOfficial(new Set((vs||[]).map(x=>x.match_id)));
      }catch(e){setError(e?.message||"Matches could not be loaded.");}
      finally{setLoading(false);}
    }
    load();
  },[]);

  const days=useMemo(()=>{
    const out=[];
    const start=new Date();
    for(let i=0;i<8;i++){
      const d=new Date(start);
      d.setDate(start.getDate()+i);
      out.push({key:dateKey(d),date:d});
    }
    return out;
  },[]);

  const visible=useMemo(()=>{
    const now=Date.now();
    const byDate=(m)=>m.scheduled_at && dateKey(m.scheduled_at)===selectedDate;
    return matches.filter(m=>{
      const live=LIVE.includes(m.status);
      const finished=FINISHED.includes(m.status);
      if(filter==="live") return live;
      if(filter==="results") return finished;
      if(filter==="upcoming") return !finished&&!live&&m.scheduled_at&&new Date(m.scheduled_at).getTime()>=now;
      return live || (byDate(m)&&!finished&&!live) || (byDate(m)&&finished);
    }).filter(m=>filter==="results"||filter==="live"||byDate(m));
  },[matches,selectedDate,filter]);

  return <main>
    <section className="container page-hero"><span className="section-kicker">Zedek Sports</span><h1>Match Centre</h1><p>Fixtures, live football and verified results from local football across Oti.</p></section>
    <section className="container match-centre">
      <div className="mc-date-strip">
        {days.map((d,i)=><button type="button" key={d.key} className={"mc-day "+(selectedDate===d.key?"active":"")} onClick={()=>{setSelectedDate(d.key);setFilter("all");}}>
          <b>{i===0?"Today":i===1?"Tomorrow":new Intl.DateTimeFormat("en-GH",{weekday:"short",timeZone:"Africa/Accra"}).format(d.date)}</b><span>{dayLabel(d.date)}</span>
        </button>)}
        <label className="mc-calendar"><span>Calendar</span><input type="date" value={selectedDate} onChange={e=>{setSelectedDate(e.target.value);setFilter("all");}}/></label>
      </div>
      <div className="mc-tabs">
        {[["all","All football"],["upcoming","Upcoming"],["live","Live"],["results","Results"]].map(([key,label])=><button type="button" key={key} className={"mc-tab "+(filter===key?"active":"")} onClick={()=>setFilter(key)}>{label}</button>)}
      </div>
      {loading?<div className="empty-state">Loading match centre…</div>:error?<div className="data-note">{error}</div>:!visible.length?<div className="empty-state"><strong>No published matches for this selection.</strong><span>Fixtures and finished results will appear automatically from the Control Room.</span></div>:<div className="match-list">{visible.map(m=>{const live=LIVE.includes(m.status),off=FINISHED.includes(m.status);return <a className="mc-match" href={"/matches/"+m.id} key={m.id}><div className="mc-meta"><span>{m.season?.competition?.name||"Competition TBC"}</span><span className={live?"live-dot":""}>{live?"LIVE":off?"OFFICIAL":fmt(m.scheduled_at)}</span></div><div className="mc-teams"><Team team={m.home_team}/><div className="mc-score">{live||off?<><b>{m.home_score??0}</b><span>:</span><b>{m.away_score??0}</b></>:<span>{m.scheduled_at?new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"Africa/Accra"}).format(new Date(m.scheduled_at)):"TBC"}</span>}</div><Team team={m.away_team}/></div><div className="mc-footer"><span>{fmt(m.scheduled_at)}</span><span>View match →</span></div></a>})}</div>}
    </section>
  </main>;
}
