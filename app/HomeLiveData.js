'use client';

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

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

function deriveVisible(all, officialIds, selectedDay, filter) {
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
    .filter((x) => official.has(x.id) && FINISHED_STATUSES.has(x.status))
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());

  if (filter === "LIVE") return live;
  if (filter === "UPCOMING") return dayUpcoming;
  if (filter === "RESULTS") return dayResults;
  if (filter === "MY TEAMS") return [];
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

function liveMinute(match) {
  if (!match?.scheduled_at) return null;
  if (match.status === "halftime") return "HT";
  if (match.status === "paused") return "PAUSED";
  if (!LIVE_STATUSES.has(match.status)) return null;
  const started = new Date(match.scheduled_at).getTime();
  const elapsed = Math.floor((Date.now() - started) / 60000);
  if (!Number.isFinite(elapsed) || elapsed < 1) return "1'";
  return Math.min(elapsed, 120) + "'";
}

function TeamCrest({ team, fallback }) {
  const [broken, setBroken] = useState(false);
  const hasLogo = Boolean(team?.logo_url) && !broken;
  return (
    <span className="score-team-crest" aria-hidden="true">
      {hasLogo ? (
        <img src={team.logo_url} alt="" onError={() => setBroken(true)} />
      ) : (
        <span>{initials(team, fallback)}</span>
      )}
    </span>
  );
}

function ScoreMatchCard({ match }) {
  const isLive = LIVE_STATUSES.has(match.status);
  const isFinished = FINISHED_STATUSES.has(match.status);
  const home = teamName(match.home_team, "Home team");
  const away = teamName(match.away_team, "Away team");
  const homeScore = isLive || isFinished ? (match.home_score ?? 0) : null;
  const awayScore = isLive || isFinished ? (match.away_score ?? 0) : null;
  const statusLabel = isLive ? (match.status === "halftime" ? "HALF-TIME" : match.status === "paused" ? "PAUSED" : "LIVE") : isFinished ? "FT" : "KICK-OFF";
  const minute = liveMinute(match);

  return (
    <a className={`score-match-card ${isLive ? "is-live" : ""}`} href={"/matches/" + match.id}>
      <div className="score-match-head">
        <span className={isLive ? "score-status live" : isFinished ? "score-status finished" : "score-status"}>
          {isLive ? <i /> : null}{statusLabel}
        </span>
        <span className="score-match-competition">{match.season?.competition?.name || "Competition TBC"}</span>
        <span className="score-match-time">{isLive ? (minute || "LIVE") : isFinished ? "Match Centre" : dateLabel(match.scheduled_at)}</span>
      </div>

      <div className="score-match-body">
        <div className="score-side">
          <TeamCrest team={match.home_team} fallback="Home" />
          <strong>{home}</strong>
        </div>
        <div className="score-centre">
          <div className="score-numbers">
            <b>{homeScore ?? "—"}</b>
            <span>:</span>
            <b>{awayScore ?? "—"}</b>
          </div>
          <small>{isLive ? (minute || "LIVE") : isFinished ? "OFFICIAL RESULT" : "PRE-MATCH"}</small>
        </div>
        <div className="score-side away">
          <strong>{away}</strong>
          <TeamCrest team={match.away_team} fallback="Away" />
        </div>
      </div>

      <div className="score-match-foot">
        <span>{isLive ? (minute ? "Live • " + minute : "Live score updates") : isFinished ? "Verified by Zedek Sports" : "Fixture"}</span>
        <b>Open match centre <em>→</em></b>
      </div>
    </a>
  );
}

export default function HomeLiveData({ selectedDay, filter = "ALL", initialData }) {
  const initialMatches = initialData?.matches || [];
  const [state, setState] = useState(() => ({
    matches: deriveVisible(initialMatches, initialData?.officialIds, selectedDay, filter).slice(0, 12),
    teams: initialData?.teams || 0,
    competitions: initialData?.competitions || 0,
    loading: false,
    error: initialData?.error || "",
  }));

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = createSupabaseBrowserClient();
        const [matches, verifications, teams, competitions] = await Promise.all([
          supabase.from("matches").select("id,scheduled_at,status,home_score,away_score,home_team:teams!matches_home_team_id_fkey(id,name,short_name,logo_url),away_team:teams!matches_away_team_id_fkey(id,name,short_name,logo_url),season:seasons(id,name,competition:competitions(id,name))").order("scheduled_at", { ascending: true }).limit(100),
          supabase.from("match_verifications").select("match_id").eq("official_result", true),
          supabase.from("teams").select("id", { count: "exact", head: true }).eq("is_active", true),
          supabase.from("competitions").select("id", { count: "exact", head: true }).eq("is_active", true),
        ]);
        if (matches.error) throw matches.error;
        if (verifications.error) throw verifications.error;
        if (teams.error) throw teams.error;
        if (competitions.error) throw competitions.error;
        const officialIds = (verifications.data || []).map((x) => x.match_id);
        const visible = deriveVisible(matches.data || [], officialIds, selectedDay, filter);
        if (!cancelled) setState({
          matches: visible.slice(0, 12),
          teams: teams.count || 0,
          competitions: competitions.count || 0,
          loading: false,
          error: "",
        });
      } catch (error) {
        if (!cancelled) setState((x) => ({ ...x, loading: false, error: error?.message || "Football data could not be loaded." }));
      }
    }
    load();
    const refreshTimer = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(refreshTimer); };
  }, [selectedDay, filter]);

  const liveCount = state.matches.filter((m) => LIVE_STATUSES.has(m.status)).length;

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
            <span className="count-pill">{state.matches.length}</span>
          </div>
          {state.loading ? (
            <div className="empty-state">Refreshing football data…</div>
          ) : state.matches.length ? (
            <div className="score-match-list">
              {state.matches.map((m) => <ScoreMatchCard key={m.id} match={m} />)}
            </div>
          ) : (
            <div className="empty-state">
              <strong>{filter === "MY TEAMS" ? "No followed teams yet." : filter === "LIVE" ? "No live matches for this date." : filter === "RESULTS" ? "No verified results for this date." : "No published matches for this date."}</strong>
              <span>{filter === "MY TEAMS" ? "Team following will appear here when you choose clubs to follow." : "Published Zedek fixtures and verified results will appear here automatically."}</span>
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
