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
  const nums=String(value||"").replace(/\s+/g,"").match(/\d+/g)||[];
  return nums.map(Number).filter(Boolean);
}

function roleGroup(value){
  const v=String(value||"").toLowerCase();
  if(/goal|keeper|\bgk\b/.test(v))return "GK";
  if(/def|back|\b(cb|lb|rb|lwb|rwb)\b/.test(v))return "DEF";
  if(/mid|\b(dm|cm|am|lm|rm)\b/.test(v))return "MID";
  if(/forward|striker|attack|wing|\b(fw|lw|rw|cf|st)\b/.test(v))return "FWD";
  return "OTHER";
}

function specificRole(value){
  const v=String(value||"").toLowerCase().trim();
  if(/goal|keeper|^gk$/.test(v))return "GK";
  if(/right wing.?back|^rwb$/.test(v))return "RWB";
  if(/left wing.?back|^lwb$/.test(v))return "LWB";
  if(/right back|^rb$/.test(v))return "RB";
  if(/left back|^lb$/.test(v))return "LB";
  if(/centre.?back|center.?back|^cb$/.test(v))return "CB";
  if(/defensive mid|^dm$/.test(v))return "DM";
  if(/central mid|^cm$/.test(v))return "CM";
  if(/attacking mid|^am$/.test(v))return "AM";
  if(/right mid|^rm$/.test(v))return "RM";
  if(/left mid|^lm$/.test(v))return "LM";
  if(/right wing|^rw$/.test(v))return "RW";
  if(/left wing|^lw$/.test(v))return "LW";
  if(/striker|centre forward|center forward|^st$|^cf$/.test(v))return "ST";
  if(/forward|^fw$/.test(v))return "FW";
  return null;
}

const FORMATION_ROLE_ROWS={
  "4-4-2":[["GK"],["RB","CB","CB","LB"],["RM","CM","CM","LM"],["ST","ST"]],
  "4-3-3":[["GK"],["RB","CB","CB","LB"],["CM","CM","CM"],["RW","ST","LW"]],
  "4-2-3-1":[["GK"],["RB","CB","CB","LB"],["DM","DM"],["RW","AM","LW"],["ST"]],
  "4-1-4-1":[["GK"],["RB","CB","CB","LB"],["DM"],["RM","CM","CM","LM"],["ST"]],
  "3-4-3":[["GK"],["CB","CB","CB"],["RM","CM","CM","LM"],["RW","ST","LW"]],
  "3-5-2":[["GK"],["CB","CB","CB"],["RM","CM","CM","CM","LM"],["ST","ST"]],
  "3-4-2-1":[["GK"],["CB","CB","CB"],["RM","CM","CM","LM"],["AM","AM"],["ST"]],
  "5-3-2":[["GK"],["RWB","CB","CB","CB","LWB"],["CM","CM","CM"],["ST","ST"]],
  "5-4-1":[["GK"],["RWB","CB","CB","CB","LWB"],["RM","CM","CM","LM"],["ST"]],
  "5-2-3":[["GK"],["RWB","CB","CB","CB","LWB"],["DM","DM"],["RW","ST","LW"]],
  "4-5-1":[["GK"],["RB","CB","CB","LB"],["RM","CM","DM","CM","LM"],["ST"]]
};

const ROLE_Y={
  GK:92,
  DEF:86,
  WIDE_DEF:84,
  DM:73,
  MID:68,
  WIDE_MID:66,
  AM:59,
  WIDE_FWD:56,
  ST:54
};

function roleX(slotRole,index,count){
  if(slotRole==="GK")return 50;
  if(slotRole==="RB")return 82;
  if(slotRole==="LB")return 18;
  if(slotRole==="RWB")return 90;
  if(slotRole==="LWB")return 10;
  if(slotRole==="CB"){
    if(count===1)return 50;
    if(count===2)return [42,58][Math.min(index,1)];
    if(count===3)return [33,50,67][Math.min(index,2)];
  }
  if(slotRole==="RW")return 84;
  if(slotRole==="LW")return 16;
  if(slotRole==="RM")return 84;
  if(slotRole==="LM")return 16;
  if(slotRole==="DM")return count===1?50:[42,58][Math.min(index,1)];
  if(slotRole==="CM")return count===1?50:[35,50,65][Math.min(index,2)];
  if(slotRole==="AM")return count===1?50:[40,60][Math.min(index,1)];
  if(slotRole==="ST")return count===1?50:[42,58][Math.min(index,1)];
  return count<=1?50:Number((50+((index-(count-1)/2)*18)).toFixed(2));
}

function roleY(slotRole){
  if(slotRole==="GK")return ROLE_Y.GK;
  if(["RB","LB","CB"].includes(slotRole))return ROLE_Y.DEF;
  if(["RWB","LWB"].includes(slotRole))return ROLE_Y.WIDE_DEF;
  if(slotRole==="DM")return ROLE_Y.DM;
  if(slotRole==="CM")return ROLE_Y.MID;
  if(["RM","LM"].includes(slotRole))return ROLE_Y.WIDE_MID;
  if(slotRole==="AM")return ROLE_Y.AM;
  if(["RW","LW"].includes(slotRole))return ROLE_Y.WIDE_FWD;
  if(slotRole==="ST")return ROLE_Y.ST;
  return 62;
}

function formationSlots(lineup,away=false){
  const starters=Array.isArray(lineup?.starters)?lineup.starters.slice(0,11):[];
  if(!starters.length)return [];

  const formation=String(lineup?.formation||"").replace(/\s+/g,"");
  let roleRows=FORMATION_ROLE_ROWS[formation];
  if(!roleRows){
    const nums=formationNumbers(formation);
    if(nums.length>=2&&nums.length<=5&&nums.reduce((a,b)=>a+b,0)===10){
      roleRows=[["GK"],...nums.map((count,index)=>Array.from({length:count},()=>index===nums.length-1?"FWD":"MID"))];
      roleRows[1]=Array.from({length:nums[0]},()=> "DEF");
    } else {
      roleRows=[["GK"],["DEF","DEF","DEF","DEF"],["MID","MID","MID"],["FWD","FWD","FWD"]];
    }
  }

  const remaining=[...starters];
  const assigned=new Set();
  const playerRole=p=>specificRole(p.position||p.player?.position||p.role)||roleGroup(p.position||p.player?.position||p.role);
  const broadRole=role=>{
    if(role==="GK")return "GK";
    if(["RB","LB","CB","RWB","LWB"].includes(role))return "DEF";
    if(["DM","CM","AM","RM","LM"].includes(role))return "MID";
    return "FWD";
  };
  const aliases={
    GK:["GK"],RB:["RB","RWB"],LB:["LB","LWB"],CB:["CB"],RWB:["RWB","RB"],LWB:["LWB","LB"],
    DM:["DM","CM"],CM:["CM","DM"],AM:["AM","CM"],RM:["RM","RW"],LM:["LM","LW"],
    RW:["RW","RM"],LW:["LW","LM"],ST:["ST","FW","CF"],FW:["FW","ST","CF"]
  };
  function pick(slotRole){
    const desired=aliases[slotRole]||[slotRole];
    let index=remaining.findIndex(p=>desired.includes(playerRole(p)));
    if(index<0){
      const broad=broadRole(slotRole);
      index=remaining.findIndex(p=>roleGroup(playerRole(p))===broad);
    }
    if(index<0)index=remaining.findIndex(p=>!assigned.has(p.id));
    if(index<0)return null;
    const player=remaining.splice(index,1)[0];
    assigned.add(player.id);
    return player;
  }

  const slots=[];
  roleRows.forEach(row=>{
    const counts={};
    row.forEach(role=>{counts[role]=(counts[role]||0)+1});
    const indexes={};
    row.forEach(slotRole=>{
      const index=indexes[slotRole]||0;
      indexes[slotRole]=index+1;
      const item=pick(slotRole);
      if(!item)return;
      const localY=roleY(slotRole);
      const y=away?100-localY:localY;
      slots.push({item,slotRole,group:roleGroup(item.position||item.player?.position||item.role),x:roleX(slotRole,index,counts[slotRole]),y});
    });
  });
  return slots;
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
        s.from("match_events").select("id,event_type,minute,extra_minute,details,created_at,player:players!match_events_player_id_fkey(id,full_name,shirt_number),secondary_player:players!match_events_secondary_player_id_fkey(id,full_name,shirt_number),coach:coaches!match_events_coach_id_fkey(id,full_name,role),team:teams(id,name,short_name)").eq("match_id",initialMatch.id).order("minute",{ascending:true}).order("created_at",{ascending:true}),
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

  // Never infer a lineup by array order. A team sheet belongs to a side only when
  // its team_id matches the match home/away team id; this prevents a reversed or
  // reordered Supabase response from putting players on the wrong half.
  const homeLineup=lineupByTeam.find(l=>l.team_id===match?.home_team?.id);
  const awayLineup=lineupByTeam.find(l=>l.team_id===match?.away_team?.id);
  const positionGroups=["GK","DEF","MID","FWD","OTHER"];
  const positionLabels={GK:"GOALKEEPER",DEF:"DEFENDERS",MID:"MIDFIELDERS",FWD:"FORWARDS",OTHER:"OTHER"};
  const lineupRows=positionGroups.flatMap(group=>{
    const h=homeLineup?.groups?.[group]||[], a=awayLineup?.groups?.[group]||[];
    return Array.from({length:Math.max(h.length,a.length)},(_,i)=>({group,h:h[i],a:a[i]}));
  });


  function PlayerNode({item,lineup,away,teamId,compact=false}){
    if(!item)return null;
    const player=item.player||{};
    const playerId=item.player_id||player.id;
    const playerName=player.full_name||"Player";
    const lineupPlayerName=(()=>{
      const parts=String(playerName).trim().split(/\s+/).filter(Boolean);
      if(parts.length<2)return playerName;
      const first=parts[0];
      const last=parts[parts.length-1];
      return first.slice(0,1).toUpperCase()+". "+last;
    })();
    const position=item.position||player.position||item.role||"Player";
    const shirtNumber=item.shirt_number??player.shirt_number??"—";
    const captain=item.player_id===lineup?.captain_player_id;
    const rating=ratingForPlayer(item,events,match,teamId,stats);

    const playerEvents=events.filter(e=>e.player_id===playerId||e.secondary_player_id===playerId);
    const goals=playerEvents.filter(e=>e.event_type==="goal"&&e.player_id===playerId).length;
    const assists=playerEvents.filter(e=>e.event_type==="goal"&&e.secondary_player_id===playerId).length;
    const cardEvents=playerEvents.filter(e=>e.player_id===playerId);
    const yellows=cardEvents.filter(e=>e.event_type==="yellow_card"||e.event_type==="second_yellow").length;
    const reds=cardEvents.filter(e=>e.event_type==="red_card"||e.event_type==="second_yellow").length;
    const sentOff=reds>0;
    const cautioned=yellows>0&&!sentOff;
    const subOut=events.find(e=>e.event_type==="substitution"&&e.player_id===playerId);
    const subIn=events.find(e=>e.event_type==="substitution"&&e.secondary_player_id===playerId);
    const subOutMinute=subOut?.minute;
    const subInMinute=subIn?.minute;
    const stateClass=sentOff?" sent-off":cautioned?" cautioned":"";

    return <article className={"zedek-player-node"+(away?" away":" home")+(compact?" compact":"")+stateClass} data-player-id={playerId}>
      <a className="zedek-player-node-link" href={playerId?"/players/"+playerId:"#"} aria-label={"Open "+playerName+" profile"}>
        <span className="zedek-player-avatar">
          <b className="zedek-player-number">{shirtNumber}</b>
          {player.photo_url?<img src={player.photo_url} alt={playerName}/>:<span aria-hidden="true">{playerName.slice(0,1).toUpperCase()}</span>}
          <b className="zedek-player-rating">{rating.toFixed(1)}</b>
          {captain?<b className="zedek-player-captain" title="Team captain">C</b>:null}
          {sentOff?<b className="zedek-player-card red" title="Sent off">RED</b>:null}
          {cautioned?<b className="zedek-player-card yellow" title="Yellow card">YC</b>:null}
        </span>
        <span className="zedek-player-identity"><strong>{lineupPlayerName}</strong><small>{position}</small></span>
        {(goals||assists||yellows||reds||subOut||subIn)?<span className="zedek-player-events" aria-label="Player match events">
          {goals>0?<i title="Goals">⚽{goals>1?goals:""}</i>:null}
          {assists>0?<i title="Assists">A{assists>1?assists:""}</i>:null}
          {yellows>0?<i title="Yellow cards">🟨{yellows>1?yellows:""}</i>:null}
          {reds>0?<i title="Red cards">🟥</i>:null}
          {subOut?<i className="substitution-out" title={"Substituted off"+(subOutMinute!=null?" · "+subOutMinute+"'":"")}>↓{subOutMinute!=null?<small>{subOutMinute}'</small>:null}</i>:null}
          {subIn?<i className="substitution-in" title={"Substituted on"+(subInMinute!=null?" · "+subInMinute+"'":"")}>↑{subInMinute!=null?<small>{subInMinute}'</small>:null}</i>:null}
        </span>:null}
      </a>
    </article>;
  }

  const [eventsExpanded,setEventsExpanded]=useState(false);
  const [statsExpanded,setStatsExpanded]=useState(false);

  const renderEvents=()=>{
    if(!events.length)return <div className="live-empty">No events recorded yet.</div>;
    const ordered=[...events].sort((a,b)=>{
      const minuteA=Number(a.minute)||0,minuteB=Number(b.minute)||0;
      if(minuteA!==minuteB)return minuteB-minuteA;
      const extraA=Number(a.extra_minute)||0,extraB=Number(b.extra_minute)||0;
      if(extraA!==extraB)return extraB-extraA;
      return new Date(b.created_at||0).getTime()-new Date(a.created_at||0).getTime();
    });
    const visible=eventsExpanded?ordered:ordered.slice(0,5);
    return <div className="live-event-feed">
      <div className="live-event-list">{visible.map(e=><div className="live-event" key={e.id}><b>{e.minute}'{e.extra_minute?"+"+e.extra_minute:""}</b><span className={"live-event-icon "+e.event_type}>{e.event_type==="goal"?"⚽":e.event_type==="yellow_card"?"🟨":e.event_type==="red_card"?"🟥":"•"}</span><div><strong>{e.event_type==="goal"?"Goal: "+(e.player?.full_name||"Unknown scorer"):e.event_type==="substitution"?"Substitution":eventLabel(e.event_type)}</strong><small>{e.event_type==="goal"&&e.secondary_player?.full_name?"Assist: "+e.secondary_player.full_name:e.event_type==="substitution"?"Outgoing: "+(e.player?.full_name||"Unknown player")+(e.secondary_player?.full_name?" · Incoming: "+e.secondary_player.full_name:" · Incoming player not recorded"):e.coach?.full_name?e.coach.full_name+" · "+(e.coach.role||"Coach"):e.player?.full_name||e.team?.name||""}{e.details?" — "+e.details:""}</small></div></div>)}</div>
      {events.length>5?<button type="button" className="live-events-toggle" onClick={()=>setEventsExpanded(value=>!value)} aria-expanded={eventsExpanded}>
        <span>{eventsExpanded?"Show latest updates":"Show all updates"}</span><b>{eventsExpanded?"↑":"↓"}</b>
      </button>:null}
    </div>;
  };

  const renderStats=()=> <div className="live-stats-content"><div className="live-stat-team-head"><span>{match?.home_team?.short_name||match?.home_team?.name||"Home"}</span><span>{match?.away_team?.short_name||match?.away_team?.name||"Away"}</span></div>{hasStats?<div className="live-stat-feed"><div className="live-stat-list">{(statsExpanded?statRows:statRows.slice(0,5)).map(([label,h,a,suffix])=><StatRow key={label} label={label} home={h} away={a} suffix={suffix}/>)}</div>{statRows.length>5?<button type="button" className="live-stats-toggle" onClick={()=>setStatsExpanded(value=>!value)} aria-expanded={statsExpanded}><span>{statsExpanded?"Show key stats":"Show all stats"}</span><b>{statsExpanded?"↑":"↓"}</b></button>:null}</div>:<div className="live-empty"><strong>Statistics are not available yet.</strong><span>Reporter statistics appear here automatically as they are recorded.</span></div>}</div>;

  const renderLineups=()=>lineups.length?<div className="zedek-lineup-layer">
    <div className="zedek-lineup-head">
      <div><span>HOME</span><strong>{homeLineup?.formation||"Formation TBC"}</strong><small>{homeLineup?.team?.name||"Home"}</small></div>
      <div className="zedek-lineup-head-score"><b>{match?.home_score??0} — {match?.away_score??0}</b><span>{live?status:official?"FULL-TIME":"PRE-MATCH"}</span></div>
      <div><span>AWAY</span><strong>{awayLineup?.formation||"Formation TBC"}</strong><small>{awayLineup?.team?.name||"Away"}</small></div>
    </div>

    <div className="zedek-formation-board" aria-label="Match lineups">
      <div className="zedek-pitch-markings" aria-hidden="true">
        <span className="zedek-pitch-half-label away">AWAY</span>
        <span className="zedek-pitch-half-label home">HOME</span>
        <span className="zedek-pitch-centre-line"/>
        <span className="zedek-pitch-centre-circle"/>
        <span className="zedek-pitch-centre-dot"/>
        <span className="zedek-pitch-box top"/>
        <span className="zedek-pitch-box bottom"/>
        <span className="zedek-pitch-goal top"/>
        <span className="zedek-pitch-goal bottom"/>
      </div>

      {[{lineup:awayLineup,away:true},{lineup:homeLineup,away:false}].map(({lineup,away})=>(
        lineup?<div className={"zedek-formation-team "+(away?"away":"home")} key={lineup.team_id}>
          {formationSlots(lineup,away).map(({item,x,y,slotRole})=>(
            <div className="zedek-formation-slot" key={item.id} style={{left:x+"%",top:y+"%"}} data-role={slotRole}>
              <PlayerNode item={item} lineup={lineup} away={away} teamId={lineup.team_id}/>
            </div>
          ))}
        </div>:null
      ))}
    </div>

    <div className="zedek-pitch-team-label">
      <span>{homeLineup?.team?.short_name||homeLineup?.team?.name||"Home"} <b>{homeLineup?.formation||"—"}</b></span>
      <span><b>{awayLineup?.formation||"—"}</b> {awayLineup?.team?.short_name||awayLineup?.team?.name||"Away"}</span>
    </div>

    <div className="zedek-lineup-legend">
      <span><b>0.0</b> pre-match</span><span><b>Live</b> calculated rating</span><span><b>Final</b> calculated rating</span>
    </div>

    {(() => {
      const awayBench=awayLineup?.bench||[];
      const homeBench=homeLineup?.bench||[];
      const substituteRows=Array.from({length:Math.max(awayBench.length,homeBench.length)},(_,i)=>({away:awayBench[i]||null,home:homeBench[i]||null}));
      return <div className="head-to-head-bench">
        <div className="head-to-head-bench-head">
          <span>{(awayLineup?.team?.short_name||awayLineup?.team?.name||"AWAY")+" · AWAY"}</span>
          <b>SUBSTITUTES</b>
          <span>{"HOME · "+(homeLineup?.team?.short_name||homeLineup?.team?.name||"HOME")}</span>
        </div>
        <div className="head-to-head-bench-rows">
          {substituteRows.map((row,i)=><div className="head-to-head-bench-row" key={(row.away?.id||"away-empty")+"-"+(row.home?.id||"home-empty")+"-"+i}>
            <div className="head-to-head-sub-side away">
              {row.away?<PlayerNode item={row.away} lineup={awayLineup} away={true} teamId={awayLineup?.team_id} compact />:<span className="head-to-head-sub-empty">—</span>}
            </div>
            <span className="head-to-head-sub-vs">VS</span>
            <div className="head-to-head-sub-side home">
              {row.home?<PlayerNode item={row.home} lineup={homeLineup} away={false} teamId={homeLineup?.team_id} compact />:<span className="head-to-head-sub-empty">—</span>}
            </div>
          </div>)}
        </div>
      </div>;
    })()}
  </div>:<div className="live-empty"><strong>Lineups not available yet.</strong><span>Confirmed lineups will appear here when submitted.</span></div>;

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