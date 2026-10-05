'use client';

import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";
import FollowButton from "../components/FollowButton";

function kickOffTime(value) {
  if (!value) return "TBC";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Accra",
  }).format(new Date(value));
}

function dateLabel(value) {
  if (!value) return "Date TBC";
  return new Intl.DateTimeFormat("en-GH", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Accra",
  }).format(new Date(value));
}

function dateKey(value) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Africa/Accra",
  }).format(new Date(value));
}

const LIVE_STATUSES = new Set(["live", "in_progress", "halftime", "paused"]);
const FINISHED_STATUSES = new Set(["finished", "verified"]);
const EXCLUDED_STATUSES = new Set(["postponed", "cancelled", "canceled"]);

function deriveVisible(all, officialIds, selectedDay, filter, favoriteMatchIds = new Set()) {
  const official = new Set(officialIds || []);
  const now = Date.now();
  const dayMatches = selectedDay
    ? all.filter((x) => x.scheduled_at && dateKey(x.scheduled_at) === selectedDay)
    : all;
  const live = all.filter((x) => LIVE_STATUSES.has(x.status));
  const dayUpcoming = dayMatches.filter((x) =>
    !LIVE_STATUSES.has(x.status) &&
    !FINISHED_STATUSES.has(x.status) &&
    !EXCLUDED_STATUSES.has(x.status) &&
    x.scheduled_at &&
    new Date(x.scheduled_at).getTime() >= now
  );
  const dayResults = dayMatches
    .filter((x) => FINISHED_STATUSES.has(x.status))
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());

  if (filter === "FAVOURITES") return all.filter((x) => favoriteMatchIds.has(x.id));
  if (filter === "LIVE") return live;
  if (filter === "UPCOMING") return dayUpcoming;
  if (filter === "RESULTS") return dayResults;
  if (filter === "MY TEAMS") return dayMatches;
  return [...live, ...dayUpcoming, ...dayResults].sort((a, b) => {
    if (LIVE_STATUSES.has(a.status) !== LIVE_STATUSES.has(b.status)) {
      return LIVE_STATUSES.has(a.status) ? -1 : 1;
    }
    return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
  });
}

function teamName(team, fallback) {
  return team?.short_name || team?.name || fallback;
}

function initials(team, fallback) {
  const value = teamName(team, fallback);
  return value.split(/\s+/).map((x) => x[0]).join("").slice(0, 3).toUpperCase();
}

function liveMinute(match, now = Date.now()) {
  if (!match?.scheduled_at) return null;
  if (match.status === "halftime") return "HT";
  
  if (!LIVE_STATUSES.has(match.status)) return null;
  const started = new Date(match.second_half_at || match.kickoff_at || match.scheduled_at).getTime();
  if (!Number.isFinite(started)) return "LIVE";
  const elapsed = Math.max(1, Math.floor((now - started) / 60000) + (match.second_half_at ? 45 : 0));
  return Math.min(elapsed, 120) + "'";
}

function TeamCrest({ team, fallback }) {
  const [broken, setBroken] = useState(false);
  const hasLogo = Boolean(team?.logo_url) && !broken;
  return (
    <span className="score-team-crest" aria-hidden="true">
      {hasLogo ? (
        <img src={team.logo_url} alt="" loading="eager" decoding="async" fetchPriority="high" onError={() => setBroken(true)} />
      ) : (
        <span>{initials(team, fallback)}</span>
      )}
    </span>
  );
}

function ScoreMatchCard({ match, goalFlash, favoriteTeams, favoriteMatches, onToggleFavorite, onToggleMatchFavorite, clockNow }) {
  const isLive = LIVE_STATUSES.has(match.status);
  const isFinished = FINISHED_STATUSES.has(match.status);
  const home = teamName(match.home_team, "Home team");
  const away = teamName(match.away_team, "Away team");
  const homeScore = isLive || isFinished ? (match.home_score ?? 0) : null;
  const awayScore = isLive || isFinished ? (match.away_score ?? 0) : null;
  const statusLabel = isLive ? (match.status === "halftime" ? "HALF-TIME" : "LIVE") : isFinished ? "FT" : "KICK-OFF";
  const minute = liveMinute(match, clockNow);
  const homeFavorite = favoriteTeams.has(match.home_team?.id);
  const awayFavorite = favoriteTeams.has(match.away_team?.id);
  const matchFavorite = favoriteMatches.has(match.id);

  return (
    <article
      className={`score-match-card ${isLive ? "is-live" : ""}`}
      role="link"
      tabIndex={0}
      onClick={() => { window.location.href = "/matches/" + match.id; }}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); window.location.href = "/matches/" + match.id; } }}
      aria-label={`Open match centre for ${home} versus ${away}`}
    >
      <button
        type="button"
        className={matchFavorite ? "match-favorite active" : "match-favorite"}
        aria-label={matchFavorite ? "Remove match from Favourites" : "Add match to Favourites"}
        title={matchFavorite ? "Remove from Favourites" : "Add to Favourites"}
        onClick={(event) => {
          event.stopPropagation();
          onToggleMatchFavorite(match.id);
        }}
      >★</button>
      <div className="score-match-head">
        <div className="score-match-status">
          <span className={isLive ? "score-status live" : isFinished ? "score-status finished" : "score-status"}>
            {isLive ? <i /> : null}{statusLabel}
          </span>
          {isLive ? <span className="live-minute">{minute || "LIVE"}</span> : null}
        </div>
        <div className="score-match-context">
          <strong>{match.season?.competition?.name || "Competition TBC"}</strong>
          <span>{match.venue || "Oti football"}</span>
        </div>
        <span className="score-match-time">{isLive ? (minute || "LIVE") : isFinished ? "FINAL" : dateLabel(match.scheduled_at)}</span>
      </div>

      <div className="score-match-body">
        <div className="score-side">
          <TeamCrest team={match.home_team} fallback="Home" />
          <strong>{home}</strong>
        </div>
        <div className="score-centre">
          {isLive || isFinished ? (
            <div className={`score-numbers ${goalFlash ? "goal-flash" : ""}`}>
              <b className={goalFlash?.side === "home" ? "goal-scoring" : ""}>{homeScore ?? 0}</b>
              <span>:</span>
              <b className={goalFlash?.side === "away" ? "goal-scoring" : ""}>{awayScore ?? 0}</b>
            </div>
          ) : (
            <div className="score-kickoff" aria-label={match.scheduled_at ? `Kick-off at ${dateLabel(match.scheduled_at)}` : "Kick-off time to be confirmed"}>
              {kickOffTime(match.scheduled_at)}
            </div>
          )}
          <small>{isLive ? (minute || "LIVE") : isFinished ? "FULL TIME" : "KICK-OFF"}</small>
          {goalFlash ? <div className="goal-alert" role="status"><span>⚽</span><strong>GOAL!</strong><small>{goalFlash.team} • {goalFlash.score}</small></div> : null}
        </div>
        <div className="score-side away">
          <strong>{away}</strong>
          <TeamCrest team={match.away_team} fallback="Away" />
        </div>
      </div>

      <div className="score-match-foot">
        <span>{isLive ? (minute ? "Live • " + minute : "Live score updates") : isFinished ? "Final result" : "Fixture"}</span>
        <a href={"/matches/" + match.id}>Open match centre <em>→</em></a>
      </div>
    </article>
  );
}

export default function HomeLiveData({ selectedDay, filter = "ALL", initialData }) {
  const initialMatches = initialData?.matches || [];
  const currentMatchesRef = useRef(initialMatches);
  const pendingGoalsRef = useRef(new Map());
  const [goalFlashes, setGoalFlashes] = useState({});
  const [favoriteTeams, setFavoriteTeams] = useState(() => new Set());
  const [favoriteMatches, setFavoriteMatches] = useState(() => new Set());
  const [clockNow, setClockNow] = useState(Date.now());
  const [state, setState] = useState(() => ({
    matches: deriveVisible(initialMatches, initialData?.officialIds, selectedDay, filter).slice(0, 12),
    teams: initialData?.teams || 0,
    competitions: initialData?.competitions || 0,
    loading: false,
    error: initialData?.error || "",
  }));

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("zedek-favorite-teams") || "[]");
      const savedMatches = JSON.parse(localStorage.getItem("zedek-favorite-matches") || "[]");
      if (Array.isArray(saved)) setFavoriteTeams(new Set(saved));
      if (Array.isArray(savedMatches)) {
        const nextFavorites = new Set(savedMatches);
        setFavoriteMatches(nextFavorites);
        if (filter === "FAVOURITES") {
          setState((current) => ({
            ...current,
            matches: initialMatches.filter((match) => nextFavorites.has(match.id)).slice(0, 12),
          }));
        }
      }
    } catch {}
  }, [filter]);

  function toggleMatchFavorite(matchId) {
    if (!matchId) return;
    setFavoriteMatches((current) => {
      const next = new Set(current);
      if (next.has(matchId)) next.delete(matchId); else next.add(matchId);
      localStorage.setItem("zedek-favorite-matches", JSON.stringify([...next]));
      return next;
    });
  }

  function toggleFavorite(teamId) {
    if (!teamId) return;
    setFavoriteTeams((current) => {
      const next = new Set(current);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      localStorage.setItem("zedek-favorite-teams", JSON.stringify([...next]));
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: incoming, error: matchesError } = await supabase
          .from("matches")
          .select("id,scheduled_at,kickoff_at,halftime_at,second_half_at,status,home_score,away_score,home_team:teams!matches_home_team_id_fkey(id,name,short_name,logo_url),away_team:teams!matches_away_team_id_fkey(id,name,short_name,logo_url),season:seasons(id,name,competition:competitions(id,name))")
          .order("scheduled_at", { ascending: true })
          .limit(100);
        if (matchesError) throw matchesError;

        const incomingMatches = incoming || [];
        const previous = currentMatchesRef.current || [];
        const previousById = new Map(previous.map((m) => [m.id, m]));
        const visible = deriveVisible(incomingMatches, initialData?.officialIds, selectedDay, filter, favoriteMatches);

        // Hold a score change for 8 seconds, then reveal it with the goal animation.
        for (const next of visible) {
          const prev = previousById.get(next.id);
          if (!prev || pendingGoalsRef.current.has(next.id)) continue;
          const homeChanged = Number(next.home_score ?? 0) !== Number(prev.home_score ?? 0);
          const awayChanged = Number(next.away_score ?? 0) !== Number(prev.away_score ?? 0);
          if (!homeChanged && !awayChanged) continue;
          const side = Number(next.home_score ?? 0) > Number(prev.home_score ?? 0) ? "home" : Number(next.away_score ?? 0) > Number(prev.away_score ?? 0) ? "away" : null;
          const team = side === "home" ? teamName(next.home_team, "Home team") : side === "away" ? teamName(next.away_team, "Away team") : "Match score";
          const score = (next.home_score ?? 0) + ":" + (next.away_score ?? 0);
          const timer = setTimeout(() => {
            if (cancelled) return;
            setState((current) => ({
              ...current,
              matches: current.matches.map((m) => m.id === next.id ? { ...m, home_score: next.home_score, away_score: next.away_score, status: next.status } : m),
            }));
            setGoalFlashes((current) => ({ ...current, [next.id]: { side, team, score } }));
            setTimeout(() => setGoalFlashes((current) => { const copy = { ...current }; delete copy[next.id]; return copy; }), 2600);
            pendingGoalsRef.current.delete(next.id);
          }, 8000);
          pendingGoalsRef.current.set(next.id, timer);
        }

        currentMatchesRef.current = incomingMatches;
        if (!cancelled) {
          setState((current) => ({
            ...current,
            matches: visible.slice(0, 12).map((next) => {
              if (!pendingGoalsRef.current.has(next.id)) return next;
              return current.matches.find((m) => m.id === next.id) || next;
            }),
            loading: false,
            error: "",
          }));
        }
      } catch (error) {
        if (!cancelled) setState((x) => ({ ...x, loading: false, error: error?.message || "Football data could not be loaded." }));
      }
    }
    load();
    const refreshDelay = initialMatches.some((match) => LIVE_STATUSES.has(match.status)) ? 5000 : 15000;
    const refreshTimer = setInterval(load, refreshDelay);
    return () => {
      cancelled = true;
      clearInterval(refreshTimer);
      pendingGoalsRef.current.forEach((timer) => clearTimeout(timer));
      pendingGoalsRef.current.clear();
    };
  }, [selectedDay, filter]);

  const liveCount = state.matches.filter((m) => LIVE_STATUSES.has(m.status)).length;
  const displayedMatches = filter === "MY TEAMS"
    ? state.matches.filter((m) => favoriteTeams.has(m.home_team?.id) || favoriteTeams.has(m.away_team?.id))
    : filter === "FAVOURITES"
      ? state.matches.filter((m) => favoriteMatches.has(m.id))
      : state.matches;

  return (
    <section className="container section">
      <div className="section-heading">
        <div>
          <span className="section-kicker">What's happening</span>
          <h2>{filter === "LIVE" ? "Live football." : filter === "RESULTS" ? "Official results." : filter === "UPCOMING" ? "Upcoming matches." : filter === "MY TEAMS" ? "My teams." : "Football, at a glance."}</h2>
        </div>
        <a href="/matches" className="quiet-link">View all →</a>
      </div>
      {state.error ? <div className="data-note">{state.error}</div> : null}
      <div className="home-dashboard">
        <div className="dashboard-card dashboard-card-wide">
          <div className="card-heading">
            <div>
              <span className="section-kicker">{liveCount ? "Live now" : filter === "RESULTS" ? "Official" : "Match feed"}</span>
              <h3>{filter === "MY TEAMS" ? "Team following" : "Matches for this date"}</h3>
            </div>
            <span className="count-pill">{displayedMatches.length}</span>
          </div>
          {state.loading ? (
            <div className="empty-state">Refreshing football data…</div>
          ) : displayedMatches.length ? (
            <div className="score-match-list">
              {displayedMatches.map((m) => <ScoreMatchCard key={m.id} match={m} goalFlash={goalFlashes[m.id]} favoriteTeams={favoriteTeams} favoriteMatches={favoriteMatches} onToggleFavorite={toggleFavorite} onToggleMatchFavorite={toggleMatchFavorite} clockNow={clockNow} />)}
            </div>
          ) : (
            <div className="empty-state">
              <strong>{filter === "MY TEAMS" ? "No followed teams yet." : filter === "FAVOURITES" ? "No favourite matches yet." : filter === "LIVE" ? "No live matches for this date." : filter === "RESULTS" ? "No finished results for this date." : "No published matches for this date."}</strong>
              <span>{filter === "MY TEAMS" ? "Followed clubs will appear here." : filter === "FAVOURITES" ? "Tap ★ on any match to save it here for quick access." : "Published Zedek fixtures and verified results will appear here automatically."}</span>
            </div>
          )}
        </div>
      </div>
      <div className="stats-strip home-stats">
        <div><b>{state.teams}</b><span>Active teams</span></div>
        <div><b>{state.competitions}</b><span>Competitions</span></div>
        <div><b>Oti</b><span>Football focus</span></div>
        <div><b>✓</b><span>Verified results</span></div>
      </div>
    </section>
  );
}
