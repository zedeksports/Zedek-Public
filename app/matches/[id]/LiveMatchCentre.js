'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";

const LIVE_STATUSES = new Set(["live","in_progress","halftime","paused"]);
const OFFICIAL_STATUSES = new Set(["finished","verified"]);
const SCORE_KEYS = ["home_score","away_score","status","kickoff_at","halftime_at","second_half_at"];

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

export default function LiveMatchCentre({ initialMatch, initialEvents, initialStats }) {
  const [match, setMatch] = useState(initialMatch);
  const [events, setEvents] = useState(initialEvents || []);
  const [stats, setStats] = useState(initialStats || null);
  const [now, setNow] = useState(Date.now());
  const matchRef = useRef(initialMatch);
  const eventsRef = useRef(initialEvents || []);
  matchRef.current = match;
  eventsRef.current = events;
  const pendingMatchRef = useRef(null);
  const pendingEventsRef = useRef(new Map());
  const initialCutoffRef = useRef(Date.now() - 5000);
  const previousScoreRef = useRef({ home: initialMatch?.home_score ?? 0, away: initialMatch?.away_score ?? 0 });
  const [goalAnimation, setGoalAnimation] = useState(null);

  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(clock);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const supabase = createSupabaseBrowserClient();
      const [m, e, s] = await Promise.all([
        supabase.from("matches").select("id,scheduled_at,kickoff_at,halftime_at,second_half_at,status,home_score,away_score,home_team:teams!matches_home_team_id_fkey(id,name,short_name,logo_url),away_team:teams!matches_away_team_id_fkey(id,name,short_name,logo_url),season:seasons(id,name,competition:competitions(id,name))").eq("id", initialMatch.id).maybeSingle(),
        supabase.from("match_events").select("id,event_type,minute,extra_minute,details,created_at,player:players!match_events_player_id_fkey(full_name,shirt_number),secondary_player:players!match_events_secondary_player_id_fkey(full_name,shirt_number),team:teams(id,name,short_name)").eq("match_id", initialMatch.id).order("minute",{ascending:true}).order("created_at",{ascending:true}),
        supabase.from("match_statistics").select("*").eq("match_id", initialMatch.id).maybeSingle()
      ]);
      if (cancelled) return;
      const detectedAt = Date.now();

      if (!m.error && m.data) {
        const next = m.data;
        const differs = SCORE_KEYS.some((key) => (next?.[key] ?? null) !== (matchRef.current?.[key] ?? null));
        if (!differs) {
          pendingMatchRef.current = null;
        } else if (!pendingMatchRef.current || pendingMatchRef.current.signature !== JSON.stringify(SCORE_KEYS.map((key) => next?.[key] ?? null))) {
          pendingMatchRef.current = { data: next, detectedAt, signature: JSON.stringify(SCORE_KEYS.map((key) => next?.[key] ?? null)) };
        } else if (detectedAt - pendingMatchRef.current.detectedAt >= 5000) {
          const previous = { home: matchRef.current?.home_score ?? 0, away: matchRef.current?.away_score ?? 0 };
          setMatch(pendingMatchRef.current.data);
          const updated = pendingMatchRef.current.data;
          const newHome = updated.home_score ?? 0, newAway = updated.away_score ?? 0;
          if (newHome !== previous.home || newAway !== previous.away) {
            setGoalAnimation({ side: newHome > previous.home ? "home" : "away", score: newHome + ":" + newAway });
            window.setTimeout(() => setGoalAnimation(null), 5000);
          }
          pendingMatchRef.current = null;
        }
      }

      if (!e.error) {
        const fetchedEvents = e.data || [];
        fetchedEvents.forEach((event) => {
          const created = event.created_at ? new Date(event.created_at).getTime() : detectedAt;
          if (created <= initialCutoffRef.current || eventsRef.current.some((x) => x.id === event.id)) return;
          const pending = pendingEventsRef.current.get(event.id);
          if (!pending) pendingEventsRef.current.set(event.id, detectedAt);
          else if (detectedAt - pending >= 5000) pendingEventsRef.current.delete(event.id);
        });
        const visible = fetchedEvents.filter((event) => {
          const created = event.created_at ? new Date(event.created_at).getTime() : 0;
          return created <= initialCutoffRef.current || events.some((x) => x.id === event.id) || !pendingEventsRef.current.has(event.id);
        });
        setEvents(visible);
      }
      if (!s.error) setStats(s.data || null);
    }
    refresh();
    const timer = setInterval(refresh, 2000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [initialMatch.id]);

  const live = LIVE_STATUSES.has(match?.status);
  const official = OFFICIAL_STATUSES.has(match?.status);
  const minute = minuteLabel(match, now);
  const status = live ? (match.status === "halftime" ? "HALF-TIME" : "LIVE") : official ? "FULL-TIME" : String(match.status || "").toUpperCase();
  const hasStats = Boolean(stats) && [
    "home_possession","away_possession","home_shots","away_shots","home_shots_on_target","away_shots_on_target","home_corners","away_corners","home_fouls","away_fouls","home_offsides","away_offsides","home_saves","away_saves","home_passes","away_passes","home_pass_accuracy","away_pass_accuracy","home_crosses","away_crosses","home_free_kicks","away_free_kicks","home_goal_kicks","away_goal_kicks","home_throw_ins","away_throw_ins","home_xg","away_xg"
  ].some((key) => stats?.[key] !== null && stats?.[key] !== undefined);

  const statRows = useMemo(() => [
    ["Possession", stats?.home_possession, stats?.away_possession, "%"], ["Shots", stats?.home_shots, stats?.away_shots], ["Shots on target", stats?.home_shots_on_target, stats?.away_shots_on_target], ["Corners", stats?.home_corners, stats?.away_corners], ["Fouls", stats?.home_fouls, stats?.away_fouls], ["Offsides", stats?.home_offsides, stats?.away_offsides], ["Saves", stats?.home_saves, stats?.away_saves], ["Passes", stats?.home_passes, stats?.away_passes], ["Pass accuracy", stats?.home_pass_accuracy, stats?.away_pass_accuracy, "%"], ["Crosses", stats?.home_crosses, stats?.away_crosses], ["Free kicks", stats?.home_free_kicks, stats?.away_free_kicks], ["Goal kicks", stats?.home_goal_kicks, stats?.away_goal_kicks], ["Throw-ins", stats?.home_throw_ins, stats?.away_throw_ins], ["xG", stats?.home_xg, stats?.away_xg]
  ], [stats]);

  return <section className="live-centre-layer">
    <div className="live-centre-hero">
      <div className="live-centre-status"><span className={live ? "live-pulse" : ""} />{status}{minute ? <b>{minute}</b> : null}</div>
      <div className="live-centre-meta">{match?.season?.competition?.name || "Competition"} • {match?.season?.name || "Season"}</div>
      <div className="live-centre-score">
        <TeamBlock team={match?.home_team} score={match?.home_score} />
        <div className="live-centre-middle"><strong>{live || official ? (match?.home_score ?? 0) + ":" + (match?.away_score ?? 0) : "vs"}</strong><span>{live ? (minute || "LIVE") : official ? "FINAL" : "KICK-OFF"}</span></div>
        <TeamBlock team={match?.away_team} score={match?.away_score} />
      </div>
      {live ? <div className="live-clock-card"><span>MATCH CLOCK</span><strong>{minute || "LIVE"}</strong><small>Live clock • public feed is 5s behind the desk</small></div> : null}
      {goalAnimation ? <div className="live-goal-animation" role="status"><span>⚽</span><strong>GOAL</strong><b>{goalAnimation.score}</b></div> : null}
    </div>

    <div className="live-centre-grid">
      <section className="live-centre-panel">
        <div className="live-centre-panel-head"><span>LIVE FEED</span><h2>Match events</h2></div>
        {events.length ? <div className="live-event-list">{events.map(e => <div className="live-event" key={e.id}><b>{e.minute}'{e.extra_minute ? "+"+e.extra_minute : ""}</b><span className={"live-event-icon " + e.event_type}>{e.event_type === "goal" ? "⚽" : e.event_type === "yellow_card" ? "🟨" : e.event_type === "red_card" ? "🟥" : "•"}</span><div><strong>{e.event_type === "goal" ? "Goal: " + (e.player?.full_name || "Unknown scorer") : e.event_type === "substitution" ? "Substitution" : eventLabel(e.event_type)}</strong><small>{e.event_type === "goal" && e.secondary_player?.full_name ? "Assist: " + e.secondary_player.full_name : e.event_type === "substitution" ? "Outgoing: " + (e.player?.full_name || "Unknown player") + (e.secondary_player?.full_name ? " · Incoming: " + e.secondary_player.full_name : " · Incoming player not recorded") : e.player?.full_name || e.team?.name || ""}{e.details ? " — " + e.details : ""}</small></div></div>)}</div> : <div className="live-empty">No events recorded yet.</div>}
      </section>

      <section className="live-centre-panel live-stats-panel" id="stats">
        <div className="live-centre-panel-head"><span>MATCH INTELLIGENCE</span><h2>Live match statistics</h2></div>
        <div className="live-stat-team-head"><span>{match?.home_team?.short_name || match?.home_team?.name || "Home"}</span><span>{match?.away_team?.short_name || match?.away_team?.name || "Away"}</span></div>
        {hasStats ? <div className="live-stat-list">{statRows.map(([label,h,a,suffix]) => <StatRow key={label} label={label} home={h} away={a} suffix={suffix} />)}</div> : <div className="live-empty"><strong>Statistics are not available yet.</strong><span>Reporter statistics appear here automatically as they are recorded.</span></div>}
      </section>
    </div>
  </section>;
}
