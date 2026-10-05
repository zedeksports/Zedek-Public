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
  const href = team?.id ? "/teams/" + team.id : null;
  const content = <div className="live-centre-team">
    <div className="live-centre-crest">{team?.logo_url ? <img src={team.logo_url} alt="" /> : <span>{(team?.short_name || team?.name || "?").slice(0,2).toUpperCase()}</span>}</div>
    <strong>{team?.name || "Team TBC"}</strong>
  </div>;
  return href ? <a className="live-centre-team-link" href={href} aria-label={"Open " + (team?.name || "team") + " profile"}>{content}</a> : content;
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
    const groupFor=p=>{
      const v=String(p.position||p.player?.position||p.role||"").toLowerCase();
      if(/goal|keeper/.test(v)||v==="gk")return "GK";
      if(/def|back|cb|lb|rb|wing.?back/.test(v))return "DEF";
      if(/mid|dm|cm|am/.test(v))return "MID";
      if(/forward|striker|attack|wing|fw/.test(v))return "FWD";
      return "OTHER";
    };
    return lineups.map(l=>{
      const raw=l.lineup_players||[];
      const star=raw.filter(p=>/starter|starting|xi/i.test(p.role||""));
      const starters=(star.length?star:raw.slice(0,11)).slice(0,11);
      const groups={GK:[],DEF:[],MID:[],FWD:[],OTHER:[]};
      starters.forEach(p=>groups[groupFor(p)].push(p));
      Object.values(groups).forEach(list=>list.sort((a,b)=>Number(a.shirt_number??a.player?.shirt_number??999)-Number(b.shirt_number??b.player?.shirt_number??999)));
      return {...l,starters,groups,bench:raw.filter(p=>!starters.some(s=>s.id===p.id))};
    });
  },[lineups]);

  const homeLineup=lineupByTeam.find(l=>l.team_id===match?.home_team?.id)||lineupByTeam[0];
  const awayLineup=lineupByTeam.find(l=>l.team_id===match?.away_team?.id)||lineupByTeam[1];
  const positionGroups=["GK","DEF","MID","FWD","OTHER"];
  const positionLabels={GK:"GOALKEEPER",DEF:"DEFENDERS",MID:"MIDFIELDERS",FWD:"FORWARDS",OTHER:"OTHER"};
  const lineupRows=positionGroups.flatMap(group=>{
    const h=homeLineup?.groups?.[group]||[], a=awayLineup?.groups?.[group]||[];
    return Array.from({length:Math.max(h.length,a.length)},(_,i)=>({group,h:h[i],a:a[i]}));
  });

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
    <div className="head-to-head-rows">{lineupRows.map(({group,h,a},i)=><div className="head-to-head-row-wrap" key={group+"-"+i}>{(i===0||lineupRows[i-1].group!==group)?<div className="head-to-head-position-label">{positionLabels[group]}</div>:null}<div className="head-to-head-row"><PlayerCell item={h} lineup={homeLineup}/><span className="head-to-head-vs">VS</span><PlayerCell item={a} lineup={awayLineup} away/></div></div>)}</div>
    <div className="head-to-head-bench"><div><b>SUBSTITUTES</b>{(homeLineup?.bench||[]).map(p=><span key={p.id}>{p.player?.full_name||"Player"}{p.shirt_number?" #"+p.shirt_number:""}</span>)}</div><div><b>SUBSTITUTES</b>{(awayLineup?.bench||[]).map(p=><span key={p.id}>{p.player?.full_name||"Player"}{p.shirt_number?" #"+p.shirt_number:""}</span>)}</div></div>
  </div>:<div className="live-empty"><strong>Lineups not available yet.</strong><span>Confirmed lineups will appear here when submitted.</span></div>;

  return <section className="live-centre-layer">
    <div className="live-centre-hero">
      <div className="live-centre-status"><span className={live?"live-pulse":""}/>{status}{minute?<b>{minute}</b>:null}</div>
      <div className="live-centre-meta">{match?.season?.competition?.name||"Competition"} • {match?.season?.name||"Season"}</div>
      <div className="live-centre-score"><TeamBlock team={match?.home_team} score={match?.home_score}/><div className="live-centre-middle"><strong>{live||official?(match?.home_score??0)+":"+(match?.away_score??0):"vs"}</strong><span>{live?"LIVE":official?"FINAL":"KICK-OFF"}</span></div><TeamBlock team={match?.away_team} score={match?.away_score}/></div>
    </div>
    <div className="live-centre-switcher" role="tablist" aria-label="Match centre sections">
      {[["events","Events"],["lineups","Lineups"],["stats","Stats"],["h2h","H2H"]].map(([key,label])=><button key={key} type="button" role="tab" aria-selected={tab===key} className={tab===key?"active":""} onClick={()=>setTab(key)}><span>{key==="events"?"◆":key==="lineups"?"XI":key==="stats"?"≋":"↔"}</span>{label}</button>)}
    </div>
    <div className="live-centre-content">
      {tab==="events"?<section className="live-centre-panel"><div className="live-centre-panel-head"><span>LIVE FEED</span><h2>Events</h2></div>{renderEvents()}</section>:null}
      {tab==="lineups"?<section className="live-centre-panel"><div className="live-centre-panel-head"><span>TEAM SHEETS</span><h2>Lineups</h2></div>{renderLineups()}</section>:null}
      {tab==="stats"?<section className="live-centre-panel live-stats-panel"><div className="live-centre-panel-head"><span>MATCH INTELLIGENCE</span><h2>Stats</h2></div>{renderStats()}</section>:null}
      {tab==="h2h"?<section className="live-centre-panel"><div className="live-centre-panel-head"><span>HEAD TO HEAD</span><h2>Head to Head</h2></div>{h2h.length?(()=>{const homeId=match?.home_team?.id,awayId=match?.away_team?.id;const homeWins=h2h.filter(x=>(x.home_team?.id===homeId&&Number(x.home_score)>Number(x.away_score))||(x.away_team?.id===homeId&&Number(x.away_score)>Number(x.home_score))).length;const awayWins=h2h.filter(x=>(x.home_team?.id===awayId&&Number(x.home_score)>Number(x.away_score))||(x.away_team?.id===awayId&&Number(x.away_score)>Number(x.home_score))).length;const draws=h2h.filter(x=>Number(x.home_score)===Number(x.away_score)).length;const homeName=match?.home_team?.name||match?.home_team?.short_name||"Home";const awayName=match?.away_team?.name||match?.away_team?.short_name||"Away";return <div className="h2h-content"><div className="h2h-summary"><div className="h2h-summary-team"><span>{homeName}</span><strong>{homeWins}</strong><small>WINS</small></div><div className="h2h-summary-middle"><span>HEAD TO HEAD</span><b>{draws}</b><small>DRAWS</small></div><div className="h2h-summary-team"><span>{awayName}</span><strong>{awayWins}</strong><small>WINS</small></div></div><div className="h2h-legend"><span><i className="h2h-dot win"/>Win</span><span><i className="h2h-dot draw"/>Draw</span><span><i className="h2h-dot loss"/>Loss</span></div><div className="h2h-section-title">PREVIOUS MEETINGS</div><div className="h2h-list">{h2h.map((x)=>{const homeScore=Number(x.home_score??0),awayScore=Number(x.away_score??0),draw=homeScore===awayScore;const homeWon=homeScore>awayScore,awayWon=awayScore>homeScore;const homeMark=draw?"D":((x.home_team?.id===homeId&&homeWon)||(x.away_team?.id===homeId&&awayWon))?"W":"L";const awayMark=draw?"D":homeMark==="W"?"L":"W";const result=draw?"DRAW":homeMark==="W"?homeName.toUpperCase()+" WIN":awayName.toUpperCase()+" WIN";return <a className="h2h-row" href={"/matches/"+x.id} key={x.id}><span className="h2h-date">{new Intl.DateTimeFormat("en-GH",{day:"numeric",month:"short",year:"numeric"}).format(new Date(x.scheduled_at))}</span><div className="h2h-team-side"><strong>{x.home_team?.name||x.home_team?.short_name||"Home"}</strong><b className={"h2h-result "+homeMark.toLowerCase()}>{homeMark}</b></div><div className="h2h-score"><b>{homeScore}</b><span>–</span><b>{awayScore}</b></div><div className="h2h-team-side away"><b className={"h2h-result "+awayMark.toLowerCase()}>{awayMark}</b><strong>{x.away_team?.name||x.away_team?.short_name||"Away"}</strong></div><em className={"h2h-outcome "+(draw?"draw":homeMark==="W"?"win":"loss")}>{result}</em></a>})}</div></div>})():<div className="live-empty"><strong>No previous meetings found.</strong><span>Head-to-head results will appear here when available.</span></div>}</section>:null}
    </div>
  </section>;
}