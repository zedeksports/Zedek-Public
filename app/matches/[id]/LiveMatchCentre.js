'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { CollapsibleSection, FormSection, H2HPreview, MatchSummaryCard } from "./MatchCentreSections";

const LIVE_STATUSES = new Set(["live","in_progress","halftime","paused"]);
const OFFICIAL_STATUSES = new Set(["finished","verified"]);
const INTERRUPTION_STATUSES = new Set(["suspended","postponed","abandoned","cancelled"]);

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

function formationNumbers(value){
  const nums=String(value||"").match(/\d+/g)||[];
  return nums.map(Number).filter(Boolean);
}
function roleGroup(value){
  const v=String(value||"").toLowerCase().replace(/[._-]+/g," ");
  if(/goalkeeper|goal keeper|\bgk\b|keeper/.test(v))return "GK";
  if(/defender|defence|defense|\b(cb|lb|rb|lwb|rwb)\b|back/.test(v))return "DEF";
  if(/midfielder|midfield|\b(dm|cm|am|lm|rm)\b/.test(v))return "MID";
  if(/forward|striker|attacker|attack|\bfw\b|\bst\b|winger|\blw\b|\brw\b/.test(v))return "FWD";
  return "OTHER";
}
function lineupRole(item){return item?.position||item?.player?.position||item?.role||""}
function formationRows(lineup){
  const starters=Array.isArray(lineup?.starters)?lineup.starters.slice(0,11):[];
  if(!starters.length)return [];
  const gk=starters.find(p=>roleGroup(lineupRole(p))==="GK")||starters[0];
  const outfield=starters.filter(p=>p!==gk);
  const nums=formationNumbers(lineup?.formation);
  const valid=nums.length>=2&&nums.length<=5&&nums.reduce((a,b)=>a+b,0)===10;
  const counts=valid?nums:[
    outfield.filter(p=>roleGroup(lineupRole(p))==="DEF").length,
    outfield.filter(p=>roleGroup(lineupRole(p))==="MID").length,
    outfield.filter(p=>roleGroup(lineupRole(p))==="FWD").length
  ].filter(Boolean);
  const used=new Set(gk?.id?[gk.id]:[]);
  const rows=[{items:[gk],type:"GK",index:0,count:1}];
  counts.forEach((count,rowIndex)=>{
    const expected=rowIndex===0?"DEF":rowIndex===counts.length-1?"FWD":"MID";
    const preferred=outfield.filter(p=>!used.has(p.id)&&roleGroup(lineupRole(p))===expected);
    const fallback=outfield.filter(p=>!used.has(p.id));
    const pool=[...preferred,...fallback];
    const items=pool.slice(0,count);
    items.forEach(p=>used.add(p.id));
    rows.push({items,type:expected,index:rowIndex+1,count:items.length});
  });
  return rows.filter(row=>row.items.length);
}
function lineupPosition(lineup,item,away){
  const rows=formationRows(lineup);
  const row=rows.find(r=>r.items.some(p=>p.id===item.id));
  if(!row)return {left:50,top:away?50:50};
  const rowCount=rows.length;
  const outfieldRows=Math.max(1,rowCount-1);
  const rowTop=row.index===0?(away?9:91):(away?26+(row.index-1)*(20/outfieldRows):74-(row.index-1)*(20/outfieldRows));
  const margin=18;
  const left=row.count===1?50:margin+(100-margin*2)*(row.items.findIndex(p=>p.id===item.id)/Math.max(1,row.count-1));
  return {left,top:Math.max(8,Math.min(92,rowTop))};
}
function ratingForPlayer(item,events,match,teamId,stats){
 if(!item)return 0;
 if(!match||(!LIVE_STATUSES.has(match.status)&&!OFFICIAL_STATUSES.has(match.status)))return 0;
 let rating=6.0; const pid=item.player_id||item.player?.id;
 const own=events.filter(e=>e.player_id===pid), secondary=events.filter(e=>e.secondary_player_id===pid);
 own.forEach(e=>{const t=String(e.event_type||"").toLowerCase();if(t==="goal")rating+=1.0;else if(t==="yellow_card")rating-=.4;else if(t==="red_card")rating-=1.2;else if(t==="penalty_missed")rating-=.7;else if(t==="own_goal")rating-=1.0;});
 secondary.forEach(e=>{if(String(e.event_type||"").toLowerCase()==="goal")rating+=.5});
 const group=roleGroup(item.position||item.player?.position||item.role);
 if(group==="GK"&&stats){const saves=teamId===match.home_team_id?Number(stats.home_saves??0):Number(stats.away_saves??0);rating+=Math.min(saves*.12,1.2)}
 return Math.max(0,Math.min(10,Number(rating.toFixed(1))));
}
function eventLabel(type) {
  return String(type || "event").replaceAll("_"," ");
}

export default function LiveMatchCentre({ initialMatch, initialEvents, initialStats, initialLineups, initialH2H, initialForm, initialPreview, initialChannels, initialStreamAds }) {
  const [match,setMatch]=useState(initialMatch),[events,setEvents]=useState(initialEvents||[]),[stats,setStats]=useState(initialStats||null),[lineups,setLineups]=useState(initialLineups||[]),[h2h]=useState(initialH2H||[]),[preview,setPreview]=useState(initialPreview||null),[channels,setChannels]=useState(initialChannels||[]),[streamAds,setStreamAds]=useState(initialStreamAds||[]),[tab,setTab]=useState("events"),[now,setNow]=useState(Date.now());
  const matchRef=useRef(initialMatch),eventsRef=useRef(initialEvents||[]);
  matchRef.current=match; eventsRef.current=events;
  const pendingMatchRef=useRef(null),pendingEventsRef=useRef(new Map()),initialCutoffRef=useRef(Date.now()-5000),goalTimerRef=useRef(null);
  const [goalAnimation,setGoalAnimation]=useState(null);

  useEffect(()=>{const clock=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(clock)},[]);

  useEffect(()=>{
    let cancelled=false;
    async function refresh(){
      const s=createSupabaseBrowserClient();
      const [m,e,st,l,pv,ch,sa]=await Promise.all([
        s.from("matches").select("id,scheduled_at,rescheduled_at,kickoff_at,halftime_at,second_half_at,status,home_score,away_score,venue,referee,match_preview,media_channel,streaming_url,streaming_ad_text,interruption_reason,interruption_minute,outcome_note,home_team:teams!matches_home_team_id_fkey(id,name,short_name,logo_url,home_venue),away_team:teams!matches_away_team_id_fkey(id,name,short_name,logo_url,home_venue),season:seasons(id,name,competition:competitions(id,name))").eq("id",initialMatch.id).maybeSingle(),
        s.from("match_events").select("id,event_type,minute,extra_minute,details,created_at,player:players!match_events_player_id_fkey(id,full_name,shirt_number),secondary_player:players!match_events_secondary_player_id_fkey(id,full_name,shirt_number),team:teams(id,name,short_name)").eq("match_id",initialMatch.id).order("minute",{ascending:true}).order("created_at",{ascending:true}),
        s.from("match_statistics").select("*").eq("match_id",initialMatch.id).maybeSingle(),
        s.from("match_lineups").select("id,team_id,formation,captain_player_id,submitted_at,team:teams(id,name,short_name,logo_url),lineup_players:match_lineup_players(id,player_id,role,shirt_number,position,player:players(id,full_name,shirt_number,position,photo_url))").eq("match_id",initialMatch.id),
        s.from("match_previews").select("id,match_id,headline,summary,key_storylines,form_note,h2h_note,venue_note,status,published_at,updated_at").eq("match_id",initialMatch.id).eq("status","published").maybeSingle(),
        s.from("match_channels").select("id,match_id,channel_type,name,provider,url,is_primary,active,starts_at,ends_at,updated_at").eq("match_id",initialMatch.id).eq("active",true).order("is_primary",{ascending:false}).order("updated_at",{ascending:false}),
        s.from("match_stream_ads").select("id,match_id,ad_slot_id,position,active,ad_slot:ad_slots(id,name,placement,format,image_url,target_url,active,sponsor:sponsors(id,name,logo_url,website_url))").eq("match_id",initialMatch.id).eq("active",true).order("priority").order("created_at",{ascending:false})
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
            const side=nh>previous.home?"home":na>previous.away?"away":null;
            const scoringTeam=side==="home"?(u.home_team?.name||"Home team"):side==="away"?(u.away_team?.name||"Away team"):"Match score";
            setGoalAnimation({side,team:scoringTeam,score:nh+":"+na});
            if(goalTimerRef.current)window.clearTimeout(goalTimerRef.current);
            goalTimerRef.current=window.setTimeout(()=>setGoalAnimation(null),2600);
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
      if(!pv.error)setPreview(pv.data||null);
      if(!ch.error)setChannels(ch.data||[]);
      if(!sa.error)setStreamAds(sa.data||[]);
    }
    refresh();
    const timer=setInterval(refresh,2000);
    return()=>{cancelled=true;clearInterval(timer);if(goalTimerRef.current)window.clearTimeout(goalTimerRef.current)};
  },[initialMatch.id]);

  const live=LIVE_STATUSES.has(match?.status);
  const official=OFFICIAL_STATUSES.has(match?.status);
  const interrupted=INTERRUPTION_STATUSES.has(match?.status);
  const prematch=!live&&!official&&!interrupted;
  const resolvedVenue=match?.venue||match?.home_team?.home_venue||match?.away_team?.home_venue||"Venue TBC";
  const referee=match?.referee||"Referee TBC";
  const primaryChannel=channels.find(x=>x.is_primary)||channels[0]||null;
  const primaryAdRow=streamAds.find(x=>x.ad_slot?.active!==false)||streamAds[0]||null;
  const primaryAd=primaryAdRow?.ad_slot||null;
  const streamingUrl=primaryChannel?.url||match?.streaming_url||"";
  const mediaChannel=primaryChannel ? [primaryChannel.name,primaryChannel.provider].filter(Boolean).join(" · ") : (match?.media_channel||"Channel TBC");
  const streamingAd=primaryAd ? [primaryAd.name,primaryAd.sponsor?.name].filter(Boolean).join(" · ") : (match?.streaming_ad_text||"Live streaming information will appear here when officially available.");
  const formData=(initialForm||[]).map((x,i)=>({...x,rank:x.rank||i+1,team:x.team||([match?.home_team,match?.away_team][i]),results:x.results||[]}));
  const minute=minuteLabel(match,now);
  const status=live?(match.status==="halftime"?"HALF-TIME":"LIVE"):official?"FULL-TIME":match.status==="suspended"?"SUSPENDED":match.status==="postponed"?"POSTPONED":match.status==="abandoned"?"ABANDONED":match.status==="cancelled"?"CANCELLED":String(match.status||"").toUpperCase();

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
    return lineups.map(l=>{
      const raw=Array.isArray(l.lineup_players)?l.lineup_players:[];
      const explicitStarters=raw.filter(p=>/^(starter|starting|starting_xi|xi)$/i.test(String(p.role||"").trim()));
      const explicitBench=raw.filter(p=>/^(substitute|sub|bench|replacement)$/i.test(String(p.role||"").trim()));
      const starters=(explicitStarters.length?explicitStarters:raw.filter(p=>!explicitBench.includes(p))).slice(0,11);
      const starterIds=new Set(starters.map(p=>p.id));
      const bench=raw.filter(p=>!starterIds.has(p.id));
      return {...l,starters,bench};
    });
  },[lineups]);

  const homeLineup=lineupByTeam.find(l=>l.team_id===match?.home_team?.id)||lineupByTeam[0];
  const awayLineup=lineupByTeam.find(l=>l.team_id===match?.away_team?.id)||lineupByTeam[1];

  function PlayerCell({item,lineup,away,teamId}){
    if(!item)return null;
    const playerId=item.player_id||item.player?.id;
    const cap=item.player_id===lineup?.captain_player_id;
    const rating=ratingForPlayer(item,events,match,teamId,stats);
    const playerEvents=events.filter(e=>e.player_id===playerId||e.secondary_player_id===playerId);
    const goals=playerEvents.filter(e=>e.event_type==="goal"&&e.player_id===playerId).length;
    const assists=playerEvents.filter(e=>e.event_type==="goal"&&e.secondary_player_id===playerId).length;
    const yellows=playerEvents.filter(e=>e.event_type==="yellow_card"&&e.player_id===playerId).length;
    const reds=playerEvents.filter(e=>e.event_type==="red_card"&&e.player_id===playerId).length;
    const subOut=playerEvents.find(e=>e.event_type==="substitution"&&e.player_id===playerId);
    const href=playerId?"/players/"+playerId:null;
    const node=<div className={"zedek-player-node"+(away?" is-away":" is-home")}>
      <div className="zedek-player-top">
        <span className="zedek-player-number">{item.shirt_number??item.player?.shirt_number??"—"}</span>
        <span className="zedek-player-rating">{rating.toFixed(1)}</span>
      </div>
      <div className="zedek-player-photo">{item.player?.photo_url?<img src={item.player.photo_url} alt="" loading="lazy"/>:<span>{(item.player?.full_name||"P").slice(0,1).toUpperCase()}</span>}</div>
      <div className="zedek-player-name" title={item.player?.full_name||"Player"}>{item.player?.full_name||"Player"}</div>
      <div className="zedek-player-position">{item.position||item.player?.position||"Player"}{cap?" · C":""}</div>
      <div className="zedek-player-events">{goals>0&&<i title="Goals">⚽{goals>1?goals:""}</i>}{assists>0&&<i title="Assists">A{assists>1?assists:""}</i>}{yellows>0&&<i title="Yellow card">🟨</i>}{reds>0&&<i title="Red card">🟥</i>}{subOut&&<i title="Substituted">↕</i>}</div>
    </div>;
    return href?<a className="zedek-player-node-link" href={href} aria-label={"Open "+(item.player?.full_name||"player")+" profile"}>{node}</a>:node;
  }

  const renderEvents=()=>events.length?<div className="live-event-list">{events.map(e=><div className="live-event" key={e.id}><b>{e.minute}'{e.extra_minute?"+"+e.extra_minute:""}</b><span className={"live-event-icon "+e.event_type}>{e.event_type==="goal"?"⚽":e.event_type==="yellow_card"?"🟨":e.event_type==="red_card"?"🟥":"•"}</span><div><strong>{e.event_type==="goal"?"Goal: "+(e.player?.full_name||"Unknown scorer"):e.event_type==="substitution"?"Substitution":eventLabel(e.event_type)}</strong><small>{e.event_type==="goal"&&e.secondary_player?.full_name?"Assist: "+e.secondary_player.full_name:e.event_type==="substitution"?"Outgoing: "+(e.player?.full_name||"Unknown player")+(e.secondary_player?.full_name?" · Incoming: "+e.secondary_player.full_name:" · Incoming player not recorded"):e.player?.full_name||e.team?.name||""}{e.details?" — "+e.details:""}</small></div></div>)}</div>:<div className="live-empty">No events recorded yet.</div>;

  const renderStats=()=> <div className="live-stats-content"><div className="live-stat-team-head"><span>{match?.home_team?.short_name||match?.home_team?.name||"Home"}</span><span>{match?.away_team?.short_name||match?.away_team?.name||"Away"}</span></div>{hasStats?<div className="live-stat-list">{statRows.map(([label,h,a,suffix])=><StatRow key={label} label={label} home={h} away={a} suffix={suffix}/>)}</div>:<div className="live-empty"><strong>Statistics are not available yet.</strong><span>Reporter statistics appear here automatically as they are recorded.</span></div>}</div>;

  const renderLineups=()=>lineups.length?<div className="zedek-lineup-layer">
    <div className="zedek-lineup-head">
      <div><span>HOME</span><strong>{homeLineup?.formation||"Formation TBC"}</strong><small>{homeLineup?.team?.name||"Home"}</small></div>
      <div className="zedek-lineup-head-score"><b>{match?.home_score??0} — {match?.away_score??0}</b><span>{live?status:official?"FULL-TIME":"PRE-MATCH"}</span></div>
      <div><span>AWAY</span><strong>{awayLineup?.formation||"Formation TBC"}</strong><small>{awayLineup?.team?.name||"Away"}</small></div>
    </div>
    <div className="zedek-formation-pitch" aria-label="Formation lineup pitch">
      <div className="zedek-pitch-half away-half"><span>AWAY</span></div>
      <div className="zedek-pitch-half home-half"><span>HOME</span></div>
      <div className="zedek-pitch-line centre-line"/>
      <div className="zedek-pitch-circle"/>
      <div className="zedek-pitch-dot"/>
      <div className="zedek-pitch-box top-box"/><div className="zedek-pitch-box bottom-box"/>
      <div className="zedek-pitch-goal top-goal"/><div className="zedek-pitch-goal bottom-goal"/>
      {[{lineup:awayLineup,away:true},{lineup:homeLineup,away:false}].map(({lineup,away})=>lineup?formationRows(lineup).flatMap(row=>row.items.map(item=>{
        const pos=lineupPosition(lineup,item,away);
        return <div className={"zedek-player-slot "+(away?"away":"home")} style={{left:pos.left+"%",top:pos.top+"%"}} key={item.id}><PlayerCell item={item} lineup={lineup} away={away} teamId={lineup.team_id}/></div>;
      })):null)}
    </div>
    <div className="zedek-lineup-team-label"><span>{homeLineup?.team?.short_name||homeLineup?.team?.name||"Home"} <b>{homeLineup?.formation||"—"}</b></span><span><b>{awayLineup?.formation||"—"}</b> {awayLineup?.team?.short_name||awayLineup?.team?.name||"Away"}</span></div>
    <div className="zedek-lineup-legend"><span><b>0.0</b> pre-match</span><span><b>6.0+</b> live calculated</span><span><b>Final</b> calculated</span></div>
    <div className="zedek-lineup-bench">
      <div><b>HOME SUBSTITUTES</b>{(homeLineup?.bench||[]).map(p=>{const id=p.player_id||p.player?.id;return id?<a href={"/players/"+id} key={p.id}>{p.player?.full_name||"Player"}{p.shirt_number?" #"+p.shirt_number:""}</a>:null})}</div>
      <div><b>AWAY SUBSTITUTES</b>{(awayLineup?.bench||[]).map(p=>{const id=p.player_id||p.player?.id;return id?<a href={"/players/"+id} key={p.id}>{p.player?.full_name||"Player"}{p.shirt_number?" #"+p.shirt_number:""}</a>:null})}</div>
    </div>
  </div>:<div className="live-empty"><strong>Lineups not available yet.</strong><span>Confirmed lineups will appear here when submitted.</span></div>
  return <section className="live-centre-layer">
    <div className="live-centre-hero">
      <div className="live-centre-meta">{match?.season?.competition?.name||"Competition"} • {match?.season?.name||"Season"}</div>
      <div className="live-centre-status"><span className={live?"live-pulse":""}/>{status}{minute?<b>{minute}</b>:null}</div>
      <div className="live-centre-score"><TeamBlock team={match?.home_team} score={match?.home_score}/><div className="live-centre-middle"><strong>{(live||official||(interrupted&&(match?.kickoff_at||match?.interruption_minute!=null||Number(match?.home_score||0)>0||Number(match?.away_score||0)>0)))?(match?.home_score??0)+":"+(match?.away_score??0):"vs"}</strong></div><TeamBlock team={match?.away_team} score={match?.away_score}/></div>
      {goalAnimation?<div className="live-goal-alert" role="status" aria-live="polite"><span>⚽</span><strong>GOAL!</strong><small>{goalAnimation.team} • {goalAnimation.score}</small></div>:null}
      {interrupted?<div className="match-interruption-banner" role="status"><div><strong>{status}</strong>{match?.interruption_reason?<span>{match.interruption_reason}</span>:null}{match?.interruption_minute!=null?<small>{"Recorded at "+match.interruption_minute+"'"}</small>:null}</div>{match?.outcome_note?<p>{match.outcome_note}</p>:null}{match?.rescheduled_at?<div className="match-reschedule-note"><span>{match.status==="suspended"||match.status==="abandoned"?"CONFIRMED RESTART":"CONFIRMED RESCHEDULE"}</span><strong>{new Date(match.rescheduled_at).toLocaleString(undefined,{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false})}</strong></div>:<div className="match-reschedule-note"><span>RESCHEDULE</span><strong>No date confirmed yet</strong></div>}</div>:null}
      {primaryAd ? <a className="live-stream-ad" href={primaryAd.target_url||streamingUrl||"#"} target={primaryAd.target_url||streamingUrl?"_blank":undefined} rel={primaryAd.target_url||streamingUrl?"noreferrer":undefined} aria-label={primaryAd.name||"Live stream sponsor"}>{primaryAd.image_url?<img src={primaryAd.image_url} alt={primaryAd.name||"Live stream sponsor"} />:<span><strong>{primaryAd.name||"Live stream"}</strong>{primaryAd.sponsor?.name?<small>{primaryAd.sponsor.name}</small>:null}</span>}</a>:null}
    </div>
    {prematch?<div className="prematch-accordion-stack">
      <MatchSummaryCard match={match} venue={resolvedVenue} referee={referee} preview={preview} />
      <FormSection teams={formData} defaultOpen={true} />
      <CollapsibleSection title="HEAD TO HEAD" eyebrow="PREVIOUS MEETINGS">
        <H2HPreview matches={h2h} match={match} />
      </CollapsibleSection>
      <CollapsibleSection title="MATCH INFORMATION" eyebrow="OFFICIAL DETAILS">
        <div className="mc-match-information">
          <div><span>VENUE</span><strong>{resolvedVenue}</strong></div>
          <div><span>REFEREE</span><strong>{referee}</strong></div>
          <div><span>CHANNEL</span><strong>{mediaChannel}</strong>{primaryChannel?.url?<a href={primaryChannel.url} target="_blank" rel="noreferrer">Open channel</a>:null}</div>
          <div><span>STREAMING</span><strong>{streamingAd}</strong>{streamingUrl?<a href={streamingUrl} target="_blank" rel="noreferrer">View streaming information</a>:null}</div>
        </div>
      </CollapsibleSection>
      <CollapsibleSection title="LINEUPS" eyebrow="TEAM SHEETS">
        {renderLineups()}
      </CollapsibleSection>
      <CollapsibleSection title="MATCH STATISTICS" eyebrow="MATCH INTELLIGENCE">
        {renderStats()}
      </CollapsibleSection>
      <CollapsibleSection title="LIVE EVENTS" eyebrow="MATCH FEED">
        {renderEvents()}
      </CollapsibleSection>
    </div>:null}
    {!prematch?<div className="live-centre-switcher" role="tablist" aria-label="Match centre sections">
      {[["events","Events"],["lineups","Lineups"],["stats","Stats"],["h2h","H2H"]].map(([key,label])=><button key={key} type="button" role="tab" aria-selected={tab===key} className={tab===key?"active":""} onClick={()=>setTab(key)}><span>{key==="events"?"◆":key==="lineups"?"XI":key==="stats"?"≋":"↔"}</span>{label}</button>)}
    </div>:null}
    {!prematch?<div className="live-centre-content">
      {tab==="events"?<section className="live-centre-panel"><div className="live-centre-panel-head"><span>LIVE FEED</span><h2>Events</h2></div>{renderEvents()}</section>:null}
      {tab==="lineups"?<section className="live-centre-panel"><div className="live-centre-panel-head"><span>TEAM SHEETS</span><h2>Lineups</h2></div>{renderLineups()}</section>:null}
      {tab==="stats"?<section className="live-centre-panel live-stats-panel"><div className="live-centre-panel-head"><span>MATCH INTELLIGENCE</span><h2>Stats</h2></div>{renderStats()}</section>:null}
      {tab==="h2h"?<section className="live-centre-panel"><div className="live-centre-panel-head"><span>HEAD TO HEAD</span><h2>Head to Head</h2></div>{h2h.length?(()=>{const homeId=match?.home_team?.id,awayId=match?.away_team?.id;const homeWins=h2h.filter(x=>(x.home_team?.id===homeId&&Number(x.home_score)>Number(x.away_score))||(x.away_team?.id===homeId&&Number(x.away_score)>Number(x.home_score))).length;const awayWins=h2h.filter(x=>(x.home_team?.id===awayId&&Number(x.home_score)>Number(x.away_score))||(x.away_team?.id===awayId&&Number(x.away_score)>Number(x.home_score))).length;const draws=h2h.filter(x=>Number(x.home_score)===Number(x.away_score)).length;const homeName=match?.home_team?.name||match?.home_team?.short_name||"Home";const awayName=match?.away_team?.name||match?.away_team?.short_name||"Away";return <div className="h2h-content"><div className="h2h-summary"><div className="h2h-summary-team"><span>{homeName}</span><strong>{homeWins}</strong><small>WINS</small></div><div className="h2h-summary-middle"><span>HEAD TO HEAD</span><b>{draws}</b><small>DRAWS</small></div><div className="h2h-summary-team"><span>{awayName}</span><strong>{awayWins}</strong><small>WINS</small></div></div><div className="h2h-legend"><span><i className="h2h-dot win"/>Win</span><span><i className="h2h-dot draw"/>Draw</span><span><i className="h2h-dot loss"/>Loss</span></div><div className="h2h-section-title">PREVIOUS MEETINGS</div><div className="h2h-list">{h2h.map((x)=>{const homeScore=Number(x.home_score??0),awayScore=Number(x.away_score??0),draw=homeScore===awayScore;const homeWon=homeScore>awayScore,awayWon=awayScore>homeScore;const homeMark=draw?"D":((x.home_team?.id===homeId&&homeWon)||(x.away_team?.id===homeId&&awayWon))?"W":"L";const awayMark=draw?"D":homeMark==="W"?"L":"W";const result=draw?"DRAW":homeMark==="W"?homeName.toUpperCase()+" WIN":awayName.toUpperCase()+" WIN";return <a className="h2h-row" href={"/matches/"+x.id} key={x.id}><span className="h2h-date">{new Intl.DateTimeFormat("en-GH",{day:"numeric",month:"short",year:"numeric"}).format(new Date(x.scheduled_at))}</span><div className="h2h-team-side"><strong>{x.home_team?.name||x.home_team?.short_name||"Home"}</strong><b className={"h2h-result "+homeMark.toLowerCase()}>{homeMark}</b></div><div className="h2h-score"><b>{homeScore}</b><span>–</span><b>{awayScore}</b></div><div className="h2h-team-side away"><b className={"h2h-result "+awayMark.toLowerCase()}>{awayMark}</b><strong>{x.away_team?.name||x.away_team?.short_name||"Away"}</strong></div><em className={"h2h-outcome "+(draw?"draw":homeMark==="W"?"win":"loss")}>{result}</em></a>})}</div></div>})():<div className="live-empty"><strong>No previous meetings found.</strong><span>Head-to-head results will appear here when available.</span></div>}</section>:null}
    </div>:null}

  </section>;
}