'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";

const LIVE_STATUSES = new Set(["live","in_progress","halftime","paused"]);
const OFFICIAL_STATUSES = new Set(["finished","verified"]);

function minuteLabel(match, now) {
  if (!match || !LIVE_STATUSES.has(match.status)) return null;
  if (match.status === "halftime") return "HT";
  const start = new Date(match.second_half_at || match.kickoff_at || match.scheduled_at).getTime();
  if (!Number.isFinite(start)) return "LIVE";
  const elapsed = Math.max(1, Math.floor((now - start) / 60000) + (match.second_half_at ? 45 : 0));
  return Math.min(elapsed, 120) + "'";
}

function TeamBlock({ team, score }) {
  return <div className="live-centre-team">
    <div className="live-centre-crest">{team?.logo_url ? <img src={team.logo_url} alt="" /> : <span>{(team?.short_name || team?.name || "?").slice(0,2).toUpperCase()}</span>}</div>
    <strong>{team?.name || "Team TBC"}</strong>
    <b>{score ?? 0}</b>
  </div>;
}

function StatRow({ label, home, away, suffix = "" }) {
  const h = Number(home ?? 0), a = Number(away ?? 0);
  const total = h + a;
  const hp = total ? Math.round((h / total) * 100) : 50;
  const format = (value) => value == null ? "—" : label === "xG" ? Number(value).toFixed(2) : value + suffix;
  return <div className="live-stat-row">
    <div className="live-stat-values"><strong>{format(home)}</strong><span>{label}</span><strong>{format(away)}</strong></div>
    <div className="live-stat-bars"><i style={{width: hp + "%"}} /><i style={{width: (100-hp) + "%"}} /></div>
  </div>;
}

function eventLabel(type) {
  return String(type || "event").replaceAll("_"," ");
}

export default function LiveMatchCentre({ initialMatch, initialEvents, initialStats, initialLineups, initialH2H }) {
  const [match,setMatch]=useState(initialMatch),[events,setEvents]=useState(initialEvents||[]),[stats,setStats]=useState(initialStats||null),[lineups,setLineups]=useState(initialLineups||[]),[h2h]=useState(initialH2H||[]),[tab,setTab]=useState("events"),[now,setNow]=useState(Date.now());
  const matchRef=useRef(initialMatch),eventsRef=useRef(initialEvents||[]);
  matchRef.current=match; eventsRef.current=events;
  const pendingMatchRef=useRef(null),pendingEventsRef=useRef(new Map()),initialCutoffRef=useRef(Date.now()-5000);
  const [goalAnimation,setGoalAnimation]=useState(null);

  useEffect(()=>{const clock=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(clock)},[]);

  useEffect(()=>{
    let cancelled=false;
    async function refresh(){
      const s=createSupabaseBrowserClient();
      const [m,e,st,l]=await Promise.all([
        s.from("matches").select("id,scheduled_at,kickoff_at,halftime_at,second_half_at,status,home_score,away_score,home_team:teams!matches_home_team_id_fkey(id,name,short_name,logo_url),away_team:teams!matches_away_team_id_fkey(id,name,short_name,logo_url),season:seasons(id,name,competition:competitions(id,name))").eq("id",initialMatch.id).maybeSingle(),
        s.from("match_events").select("id,event_type,minute,extra_minute,details,created_at,player:players!match_events_player_id_fkey(full_name,shirt_number),secondary_player:players!match_events_secondary_player_id_fkey(full_name,shirt_number),team:teams(id,name,short_name)").eq("match_id",initialMatch.id).order("minute",{ascending:true}).order("created_at",{ascending:true}),
        s.from("match_statistics").select("*").eq("match_id",initialMatch.id).maybeSingle(),
        s.from("match_lineups").select("id,team_id,formation,captain_player_id,submitted_at,team:teams(id,name,short_name,logo_url),lineup_players:match_lineup_players(id,player_id,role,shirt_number,position,player:players(id,full_name,shirt_number,position,photo_url))").eq("match_id",initialMatch.id)
      ]);
      if(cancelled)return;
      const detectedAt=Date.now();

      if(!m.error&&m.data){
        const next=m.data;
        const keys=["home_score","away_score","status","kickoff_at","halftime_at","second_half_at"];
        const differs=keys.some(k=>(next?.[k]??null)!==(matchRef.current?.[k]??null));
        const signature=JSON.stringify(keys.map(k=>next?.[k]??null));
        if(!differs) pendingMatchRef.current=null;
        else if(!pendingMatchRef.current||pendingMatchRef.current.signature!==signature) pendingMatchRef.current={data:next,detectedAt,signature};
        else if(detectedAt-pendingMatchRef.current.detectedAt>=5000){
          const previous={home:matchRef.current?.home_score??0,away:matchRef.current?.away_score??0};
          setMatch(pendingMatchRef.current.data);
          const u=pendingMatchRef.current.data,nh=u.home_score??0,na=u.away_score??0;
          if(nh!==previous.home||na!==previous.away){
            setGoalAnimation({side:nh>previous.home?"home":"away",score:nh+":"+na});
            window.setTimeout(()=>setGoalAnimation(null),5000);
          }
          pendingMatchRef.current=null;
        }
      }

      if(!e.error){
        const fetched=e.data||[];
        fetched.forEach(event=>{
          const created=event.created_at?new Date(event.created_at).getTime():detectedAt;
          if(created<=initialCutoffRef.current||eventsRef.current.some(x=>x.id===event.id))return;
          const pending=pendingEventsRef.current.get(event.id);
          if(!pending)pendingEventsRef.current.set(event.id,detectedAt);
          else if(detectedAt-pending>=5000)pendingEventsRef.current.delete(event.id);
        });
        setEvents(fetched.filter(event=>{
          const created=event.created_at?new Date(event.created_at).getTime():0;
          return created<=initialCutoffRef.current||eventsRef.current.some(x=>x.id===event.id)||!pendingEventsRef.current.has(event.id);
        }));
      }
      if(!st.error)setStats(st.data||null);
      if(!l.error)setLineups(l.data||[]);
    }
    refresh();
    const timer=setInterval(refresh,2000);
    return()=>{cancelled=true;clearInterval(timer)};
  },[initialMatch.id]);

  const live=LIVE_STATUSES.has(match?.status);
  const official=OFFICIAL_STATUSES.has(match?.status);
  const minute=minuteLabel(match,now);
  const status=live?(match.status==="halftime"?"HALF-TIME":"LIVE"):official?"FULL-TIME":String(match.status||"").toUpperCase();

  const hasStats=Boolean(stats)&&["home_possession","away_possession","home_shots","away_shots","home_shots_on_target","away_shots_on_target","home_corners","away_corners","home_fouls","away_fouls","home_offsides","away_offsides","home_saves","away_saves","home_passes","away_passes","home_pass_accuracy","away_pass_accuracy","home_crosses","away_crosses","home_free_kicks","away_free_kicks","home_goal_kicks","away_goal_kicks","home_throw_ins","away_throw_ins","home_xg","away_xg"].some(k=>stats?.[k]!==null&&stats?.[k]!==undefined);

  const statRows=useMemo(()=>[
    ["Possession",stats?.home_possession,stats?.away_possession,"%"],
    ["Shots",stats?.home_shots,stats?.away_shots],
    ["Shots on target",stats?.home_shots_on_target,stats?.away_shots_on_target],
    ["Corners",stats?.home_corners,stats?.away_corners],
    ["Fouls",stats?.home_fouls,stats?.away_fouls],
    ["Offsides",stats?.home_offsides,stats?.away_offsides],
    ["Saves",stats?.home_saves,stats?.away_saves],
    ["Passes",stats?.home_passes,stats?.away_passes],
    ["Pass accuracy",stats?.home_pass_accuracy,stats?.away_pass_accuracy,"%"],
    ["Crosses",stats?.home_crosses,stats?.away_crosses],
    ["Free kicks",stats?.home_free_kicks,stats?.away_free_kicks],
    ["Goal kicks",stats?.home_goal_kicks,stats?.away_goal_kicks],
    ["Throw-ins",stats?.home_throw_ins,stats?.away_throw_ins],
    ["xG",stats?.home_xg,stats?.away_xg]
  ],[stats]);

  const lineupByTeam=useMemo(()=>{
    const rank=p=>{
      const v=String(p.position||p.player?.position||p.role||"").toLowerCase();
      if(/goal|keeper|\bgk\b/.test(v))return 0;
      if(/def|back|cb|lb|rb|wing.?back/.test(v))return 1;
      if(/mid|dm|cm|am/.test(v))return 2;
      if(/forward|striker|attack|wing|fw/.test(v))return 3;
      return 4;
    };
    return lineups.map(l=>{
      const raw=l.lineup_players||[];
      const star=raw.filter(p=>/starter|starting|xi/i.test(p.role||""));
      const starters=(star.length?star:raw.slice(0,11)).slice(0,11).sort((a,b)=>rank(a)-rank(b)||Number(a.shirt_number??a.player?.shirt_number??999)-Number(b.shirt_number??b.player?.shirt_number??999));
      return {...l,starters,bench:raw.filter(p=>!starters.some(s=>s.id===p.id))};
    });
  },[lineups]);

  const homeLineup=lineupByTeam.find(l=>l.team_id===match?.home_team?.id)||lineupByTeam[0];
  const awayLineup=lineupByTeam.find(l=>l.team_id===match?.away_team?.id)||lineupByTeam[1];
  const lineupRows=Array.from({length:Math.max(homeLineup?.starters?.length||0,awayLineup?.starters?.length||0)},(_,i)=>[homeLineup?.starters?.[i],awayLineup?.starters?.[i]]);

  function PlayerCell({item,lineup,away}){
    if(!item)return <div className="head-to-head-empty">—</div>;
    const cap=item.player_id===lineup?.captain_player_id;
    return <div className={"head-to-head-player"+(away?" away":"")}>
      <span className="head-to-head-number">{item.shirt_number??item.player?.shirt_number??"—"}</span>
      <div className="head-to-head-avatar">{item.player?.photo_url?<img src={item.player.photo_url} alt=""/>:<span>{(item.player?.full_name||"P").slice(0,1).toUpperCase()}</span>}</div>
      <a href={item.player?.id?"/players/"+item.player.id:"#"}><strong>{item.player?.full_name||"Player"}</strong><small>{item.position||item.player?.position||"Player"}{cap?" · C":""}</small></a>
    </div>;
  }

  const renderEvents=()=>events.length?<div className="live-event-list">{events.map(e=><div className="live-event" key={e.id}><b>{e.minute}'{e.extra_minute?"+"+e.extra_minute:""}</b><span className={"live-event-icon "+e.event_type}>{e.event_type==="goal"?"⚽":e.event_type==="yellow_card"?"🟨":e.event_type==="red_card"?"🟥":"•"}</span><div><strong>{e.event_type==="goal"?"Goal: "+(e.player?.full_name||"Unknown scorer"):e.event_type==="substitution"?"Substitution":eventLabel(e.event_type)}</strong><small>{e.event_type==="goal"&&e.secondary_player?.full_name?"Assist: "+e.secondary_player.full_name:e.event_type==="substitution"?"Outgoing: "+(e.player?.full_name||"Unknown player")+(e.secondary_player?.full_name?" · Incoming: "+e.secondary_player.full_name:" · Incoming player not recorded"):e.player?.full_name||e.team?.name||""}{e.details?" — "+e.details:""}</small></div></div>)}</div>:<div className="live-empty">No events recorded yet.</div>;

  const renderStats=()=> <div className="live-stats-content"><div className="live-stat-team-head"><span>{match?.home_team?.short_name||match?.home_team?.name||"Home"}</span><span>{match?.away_team?.short_name||match?.away_team?.name||"Away"}</span></div>{hasStats?<div className="live-stat-list">{statRows.map(([label,h,a,suffix])=><StatRow key={label} label={label} home={h} away={a} suffix={suffix}/>)}</div>:<div className="live-empty"><strong>Statistics are not available yet.</strong><span>Reporter statistics appear here automatically as they are recorded.</span></div>}</div>;

  const renderLineups=()=>lineups.length?<div className="head-to-head-lineups">
    <div className="head-to-head-team-head"><div>{homeLineup?.team?.logo_url?<img src={homeLineup.team.logo_url} alt=""/>:null}<strong>{homeLineup?.team?.short_name||homeLineup?.team?.name||"Home"}</strong></div><span>STARTING XI · HEAD TO HEAD</span><div><strong>{awayLineup?.team?.short_name||awayLineup?.team?.name||"Away"}</strong>{awayLineup?.team?.logo_url?<img src={awayLineup.team.logo_url} alt=""/>:null}</div></div>
    <div className="head-to-head-label"><span>GK FIRST</span><small>Players aligned by position group</small><span>GK FIRST</span></div>
    <div className="head-to-head-rows">{lineupRows.map(([h,a],i)=><div className="head-to-head-row" key={i}><PlayerCell item={h} lineup={homeLineup}/><span className="head-to-head-vs">VS</span><PlayerCell item={a} lineup={awayLineup} away/></div>)}</div>
    <div className="head-to-head-bench"><div><b>SUBSTITUTES</b>{(homeLineup?.bench||[]).map(p=><span key={p.id}>{p.player?.full_name||"Player"}{p.shirt_number?" #"+p.shirt_number:""}</span>)}</div><div><b>SUBSTITUTES</b>{(awayLineup?.bench||[]).map(p=><span key={p.id}>{p.player?.full_name||"Player"}{p.shirt_number?" #"+p.shirt_number:""}</span>)}</div></div>
  </div>:<div className="live-empty"><strong>Lineups not available yet.</strong><span>Confirmed lineups will appear here when submitted.</span></div>;

  return <section className="live-centre-layer">
    <div className="live-centre-hero">
      <div className="live-centre-status"><span className={live?"live-pulse":""}/>{status}{minute?<b>{minute}</b>:null}</div>
      <div className="live-centre-meta">{match?.season?.competition?.name||"Competition"} • {match?.season?.name||"Season"}</div>
      <div className="live-centre-score"><TeamBlock team={match?.home_team} score={match?.home_score}/><div className="live-centre-middle"><strong>{live||official?(match?.home_score??0)+":"+(match?.away_score??0):"vs"}</strong><span>{live?(minute||"LIVE"):official?"FINAL":"KICK-OFF"}</span></div><TeamBlock team={match?.away_team} score={match?.away_score}/></div>
      {live?<div className="live-clock-card"><span>MATCH CLOCK</span><strong>{minute||"LIVE"}</strong><small>Live clock • public feed is 5s behind the desk</small></div>:null}
      {goalAnimation?<div className="live-goal-animation" role="status"><span>⚽</span><strong>GOAL</strong><b>{goalAnimation.score}</b></div>:null}
    </div>
    <div className="live-centre-switcher" role="tablist" aria-label="Match centre sections">
      {[["events","Events"],["lineups","Lineups"],["stats","Stats"],["h2h","H2H"]].map(([key,label])=><button key={key} type="button" role="tab" aria-selected={tab===key} className={tab===key?"active":""} onClick={()=>setTab(key)}><span>{key==="events"?"◆":key==="lineups"?"XI":key==="stats"?"≋":"↔"}</span>{label}</button>)}
    </div>
    <div className="live-centre-content">
      {tab==="events"?<section className="live-centre-panel"><div className="live-centre-panel-head"><span>LIVE FEED</span><h2>Events</h2></div>{renderEvents()}</section>:null}
      {tab==="lineups"?<section className="live-centre-panel"><div className="live-centre-panel-head"><span>TEAM SHEETS</span><h2>Lineups</h2></div>{renderLineups()}</section>:null}
      {tab==="stats"?<section className="live-centre-panel live-stats-panel"><div className="live-centre-panel-head"><span>MATCH INTELLIGENCE</span><h2>Stats</h2></div>{renderStats()}</section>:null}
      {tab==="h2h"?<section className="live-centre-panel"><div className="live-centre-panel-head"><span>HEAD TO HEAD</span><h2>H2H</h2></div>{h2h.length?<div className="h2h-list">{h2h.map((x)=>{const homeWin=x.home_score!=null&&x.home_score>x.away_score;const awayWin=x.away_score!=null&&x.away_score>x.home_score;return <a className="h2h-row" href={"/matches/"+x.id} key={x.id}><span>{new Intl.DateTimeFormat("en-GH",{day:"numeric",month:"short",year:"numeric"}).format(new Date(x.scheduled_at))}</span><strong>{x.home_team?.short_name||x.home_team?.name||"Home"} <b>{x.home_score??0}:{x.away_score??0}</b> {x.away_team?.short_name||x.away_team?.name||"Away"}</strong><em>{homeWin?"HOME WIN":awayWin?"AWAY WIN":"DRAW"}</em></a>})}</div>:<div className="live-empty"><strong>No previous meetings found.</strong><span>Head-to-head results will appear here when available.</span></div>}</section>:null}
    </div>
  </section>;
}