'use client';

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { ExplorePage, ExploreHeader, EmptyState } from "../ExploreChrome";

function TeamLogo({ team }) {
  return (
    <div className="explore-logo">
      {team?.logo_url ? <img src={team.logo_url} alt="" loading="lazy" /> : <span>{(team?.short_name || team?.name || "T").slice(0, 3).toUpperCase()}</span>}
    </div>
  );
}

function MatchCard({ item, onRemove }) {
  const m = item.matches;
  const date = m?.scheduled_at
    ? new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Accra" }).format(new Date(m.scheduled_at))
    : "Time TBC";
  return (
    <div className="explore-card">
      <div className="explore-logo"><span>⚽</span></div>
      <a className="explore-card-main" href={"/matches/" + item.match_id} style={{ textDecoration: "none", color: "inherit" }}>
        <strong>{m?.home_team?.short_name || m?.home_team?.name || "Home"} vs {m?.away_team?.short_name || m?.away_team?.name || "Away"}</strong>
        <span>{date} · {m?.status || "scheduled"} · Open match centre →</span>
      </a>
      <button className="explore-action" onClick={onRemove}>Remove</button>
    </div>
  );
}

export default function FavoritesPage() {
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/login";
        return;
      }
      const [t, m] = await Promise.all([
        supabase.from("user_favorite_teams").select("team_id,teams(id,name,short_name,area,logo_url)").order("created_at", { ascending: false }),
        supabase.from("user_favorite_matches").select("match_id,matches(id,scheduled_at,status,home_score,away_score,home_team:teams!matches_home_team_id_fkey(name,short_name),away_team:teams!matches_away_team_id_fkey(name,short_name))").order("created_at", { ascending: false }),
      ]);
      const bad = [t, m].find(x => x.error);
      if (bad) setError(bad.error.message);
      else {
        setTeams(t.data || []);
        setMatches(m.data || []);
      }
      setLoading(false);
    })();
  }, []);

  async function removeTeam(id) {
    const supabase = createSupabaseBrowserClient();
    await supabase.from("user_favorite_teams").delete().eq("team_id", id);
    setTeams(prev => prev.filter(x => x.team_id !== id));
  }

  async function removeMatch(id) {
    const supabase = createSupabaseBrowserClient();
    await supabase.from("user_favorite_matches").delete().eq("match_id", id);
    setMatches(prev => prev.filter(x => x.match_id !== id));
  }

  return (
    <ExplorePage>
      <ExploreHeader title="Favourites" eyebrow="Your Football" description="Teams and matches you want close at hand, synced to your account." />
      <section className="explore-feed">
        {error ? <EmptyState>{error}</EmptyState> : null}
        {loading ? <EmptyState>Loading favourites…</EmptyState> : (
          <>
            <section className="explore-section">
              <div className="explore-section-heading">
                <span className="explore-section-kicker">YOUR TEAMS</span>
                <h2>Favourites</h2>
              </div>
              {teams.length ? teams.map(item => (
                <div className="explore-card" key={item.team_id}>
                  <TeamLogo team={item.teams} />
                  <a className="explore-card-main" href={"/teams/" + item.team_id} style={{ textDecoration: "none", color: "inherit" }}>
                    <strong>{item.teams?.name || "Team"}</strong>
                    <span>{item.teams?.area || "Oti"} · Open team profile →</span>
                  </a>
                  <button className="explore-action" onClick={() => removeTeam(item.team_id)}>Remove</button>
                </div>
              )) : <EmptyState>No teams followed yet. Add a favourite from a team page.</EmptyState>}
            </section>

            <section className="explore-section">
              <div className="explore-section-heading">
                <span className="explore-section-kicker">YOUR MATCHES</span>
                <h2>Followed matches</h2>
              </div>
              {matches.length ? matches.map(item => <MatchCard key={item.match_id} item={item} onRemove={() => removeMatch(item.match_id)} />) : <EmptyState>No matches followed yet. Open a match centre and follow it.</EmptyState>}
            </section>
          </>
        )}
      </section>
    </ExplorePage>
  );
}
