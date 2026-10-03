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

export default function HomeLiveData({ selectedDay, filter = "ALL" }) {
  const [state, setState] = useState({
    matches: [], teams: 0, competitions: 0, loading: true, error: "",
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState((x) => ({ ...x, loading: true, error: "" }));
      try {
        const supabase = createSupabaseBrowserClient();
        const [matches, verifications, teams, competitions] = await Promise.all([
          supabase.from("matches")
            .select("id,scheduled_at,status,home_score,away_score,home_team:teams!matches_home_team_id_fkey(id,name,short_name,logo_url),away_team:teams!matches_away_team_id_fkey(id,name,short_name,logo_url),season:seasons(id,name,competition:competitions(id,name))")
            .order("scheduled_at", { ascending: true }).limit(100),
          supabase.from("match_verifications").select("match_id").eq("official_result", true),
          supabase.from("teams").select("id", { count: "exact", head: true }).eq("is_active", true),
          supabase.from("competitions").select("id", { count: "exact", head: true }).eq("is_active", true),
        ]);

        if (matches.error) throw matches.error;
        if (verifications.error) throw verifications.error;
        if (teams.error) throw teams.error;
        if (competitions.error) throw competitions.error;

        const official = new Set((verifications.data || []).map((x) => x.match_id));
        const now = Date.now();
        const all = matches.data || [];

        const dayMatches = selectedDay
          ? all.filter((x) => x.scheduled_at && dateKey(x.scheduled_at) === selectedDay)
          : all;

        // Live matches are global: a match that is currently live remains visible
        // even if its scheduled date has rolled into the previous day.
        const live = all.filter((x) => LIVE_STATUSES.has(x.status));
        const dayUpcoming = dayMatches.filter((x) =>
          !LIVE_STATUSES.has(x.status) &&
          !FINISHED_STATUSES.has(x.status) &&
          new Date(x.scheduled_at).getTime() >= now
        );
        const dayResults = dayMatches
          .filter((x) => official.has(x.id) && FINISHED_STATUSES.has(x.status))
          .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());

        let visible;
        if (filter === "LIVE") visible = live;
        else if (filter === "UPCOMING") visible = dayUpcoming;
        else if (filter === "RESULTS") visible = dayResults;
        else if (filter === "MY TEAMS") visible = [];
        else visible = [...live, ...dayUpcoming, ...dayResults].sort(
          (a, b) => {
            if (LIVE_STATUSES.has(a.status) !== LIVE_STATUSES.has(b.status)) {
              return LIVE_STATUSES.has(a.status) ? -1 : 1;
            }
            return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
          }
        );

        if (!cancelled) {
          setState({
            matches: visible.slice(0, 12),
            teams: teams.count || 0,
            competitions: competitions.count || 0,
            loading: false,
            error: "",
          });
        }
      } catch (error) {
        if (!cancelled) setState((x) => ({
          ...x, loading: false, error: error?.message || "Football data could not be loaded.",
        }));
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
            <div className="empty-state">Loading football data…</div>
          ) : state.matches.length ? (
            state.matches.map((m) => {
              const isLive = LIVE_STATUSES.has(m.status);
              const isFinished = FINISHED_STATUSES.has(m.status);
              return (
                <a className="match-row" href={"/matches/" + m.id} key={m.id}>
                  <div>
                    <small>
                      {isLive ? "● LIVE" : isFinished ? "✓ VERIFIED RESULT" : "UPCOMING"} · {m.season?.competition?.name || "Competition TBC"} · {dateLabel(m.scheduled_at)}
                    </small>
                    <strong>{m.home_team?.short_name || m.home_team?.name || "Home team"} {isLive || isFinished ? m.home_score ?? 0 : ""}</strong>
                    <br />
                    <strong>{m.away_team?.short_name || m.away_team?.name || "Away team"} {isLive || isFinished ? m.away_score ?? 0 : ""}</strong>
                  </div>
                  <span className="row-arrow">→</span>
                </a>
              );
            })
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
