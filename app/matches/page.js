'use client';

import {useEffect,useMemo,useState} from "react";
import {createSupabaseBrowserClient} from "../../lib/supabase/browser";
import {ExplorePage,ExploreHeader,EmptyState} from "../ExploreChrome";

const LIVE=["live","in_progress","halftime","paused"];
const FINISHED=["finished","verified"];
function dateKey(v){return new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Accra",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(v));}
function fmt(v){return v?new Intl.DateTimeFormat("en-GH",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",timeZone:"Africa/Accra"}).format(new Date(v)):"Date TBC";}
function dayLabel(v){return new Intl.DateTimeFormat("en-GH",{weekday:"short",day:"numeric",month:"short",timeZone:"Africa/Accra"}).format(new Date(v));}
function Team({team}){return <div className="hub-match-team"><div className="hub-team-logo">{team?.logo_url?<img src={team.logo_url} alt=""/>:<span>{(team?.short_name||team?.name||"?").slice(0,2).toUpperCase()}</span>}</div><strong>{team?.short_name||team?.name||"Team TBC"}</strong></div>;}

export default function MatchesPage(){
 const [matches,setMatches]=useState([]),[official,setOfficial]=useState(new Set()),[loading,setLoading]=useState(true),[error,setError]=useState(""),[selectedDate,setSelectedDate]=useState(dateKey(new Date())),[filter,setFilter]=useState("all");
 useEffect(()=>{const requested=new URLSearchParams(window.location.search).get("filter");if(["all","upcoming","live","results"].includes(requested))setFilter(requested);},[]);
 useEffect(()=>{async function load(){try{const s=createSupabaseBrowserClient();const [{data:ms,error:me},{data:vs,error:ve}]=await Promise.all([s.from("matches").select("id,scheduled_at,status,home_score,away_score,home_team:teams!matches_home_team_id_fkey(id,name,short_name,logo_url),away_team:teams!matches_away_team_id_fkey(id,name,short_name,logo_url),season:seasons(id,name,competition:competitions(id,name))").order("scheduled_at",{ascending:true}).limit(500),s.from("match_verifications").select("match_id").eq("official_result",true)]);if(me||ve)throw me||ve;setMatches(ms||[]);setOfficial(new Set((vs||[]).map(x=>x.match_id)));}catch(e){setError(e?.message||"Matches could not be loaded.");}finally{setLoading(false);}}load();},[]);
 const days=useMemo(()=>{const out=[];const start=new Date();for(let i=0;i<8;i++){const d=new Date(start);d.setDate(start.getDate()+i);out.push({key:dateKey(d),date:d});}return out;},[]);
 const visible=useMemo(()=>{const now=Date.now(),byDate=m=>m.scheduled_at&&dateKey(m.scheduled_at)===selectedDate;return matches.filter(m=>{const live=LIVE.includes(m.status),finished=FINISHED.includes(m.status),isOfficial=official.has(m.id);if(filter==="live")return live;if(filter==="results")return finished&&isOfficial;if(filter==="upcoming")return !finished&&!live&&m.scheduled_at&&new Date(m.scheduled_at).getTime()>=now;return live||(byDate(m)&&!finished&&!live)||(byDate(m)&&finished&&isOfficial);}).filter(m=>filter==="results"||filter==="live"||byDate(m));},[matches,official,selectedDate,filter]);

 return <ExplorePage>
  <ExploreHeader title={filter==="live"?"Live Football":"Matches"} eyebrow="Football Hub" description={filter==="live"?"Follow live local football, scores and match status in real time.":"Fixtures, live football and verified results from local football across Oti."}/>
  <div className="hub-page-actions">
   <div className="hub-date-strip">{days.map((d,i)=><button type="button" key={d.key} className={"hub-day "+(selectedDate===d.key?"active":"")} onClick={()=>{setSelectedDate(d.key);setFilter("all");}}><b>{i===0?"Today":i===1?"Tomorrow":new Intl.DateTimeFormat("en-GH",{weekday:"short",timeZone:"Africa/Accra"}).format(d.date)}</b><span>{dayLabel(d.date)}</span></button>)}<label className="hub-calendar"><span>Calendar</span><input type="date" value={selectedDate} onChange={e=>{setSelectedDate(e.target.value);setFilter("all");}}/></label></div>
   <div className="hub-filter-row">{[["all","All football"],["upcoming","Upcoming"],["live","Live"],["results","Results"]].map(([key,label])=><button type="button" key={key} className={"hub-filter "+(filter===key?"active":"")} onClick={()=>setFilter(key)}>{label}</button>)}</div>
  </div>
  {loading?<EmptyState>Loading football…</EmptyState>:error?<EmptyState>{error}</EmptyState>:!visible.length?<EmptyState><strong>No matches for this selection.</strong><span>Fixtures and verified results will appear automatically from the Control Room.</span></EmptyState>:<section className="hub-match-feed">{visible.map(m=>{const live=LIVE.includes(m.status),off=FINISHED.includes(m.status)&&official.has(m.id);return <a className="hub-match-card" href={"/matches/"+m.id} key={m.id}><div className="hub-match-top"><span>{m.season?.competition?.name||"Competition TBC"}</span><b className={live?"is-live":""}>{live?"LIVE":off?"OFFICIAL":fmt(m.scheduled_at)}</b></div><div className="hub-match-body"><Team team={m.home_team}/><div className="hub-match-score">{live||off?<><b>{m.home_score??0}</b><span>:</span><b>{m.away_score??0}</b></>:<strong>{m.scheduled_at?new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"Africa/Accra"}).format(new Date(m.scheduled_at)):"TBC"}</strong>}</div><Team team={m.away_team}/></div><div className="hub-match-bottom"><span>{fmt(m.scheduled_at)}</span><span>Match centre →</span></div></a>})}</section>}
 </ExplorePage>;
}