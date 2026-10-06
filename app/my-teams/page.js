'use client';

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { ExplorePage, ExploreHeader, EmptyState } from "../ExploreChrome";

function Logo({ team }) {
  return <div className="explore-logo">{team?.logo_url ? <img src={team.logo_url} alt="" loading="lazy" /> : <span>{(team?.short_name || team?.name || "T").slice(0, 3).toUpperCase()}</span>}</div>;
}

export default function MyTeamsPage() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = "/login"; return; }
      const result = await supabase.from("user_favorite_teams").select("team_id,teams(id,name,short_name,area,home_venue,logo_url)").order("created_at", { ascending: false });
      if (result.error) setError(result.error.message); else setTeams(result.data || []);
      setLoading(false);
    })();
  }, []);

  async function remove(id) {
    const supabase = createSupabaseBrowserClient();
    await supabase.from("user_favorite_teams").delete().eq("team_id", id);
    setTeams(prev => prev.filter(x => x.team_id !== id));
  }

  return <ExplorePage>
    <ExploreHeader title="My Teams" eyebrow="Your Football" description="Your followed Oti clubs, presented in the same Football Hub experience as competitions and teams." />
    <section className="explore-feed">
      {loading ? <EmptyState>Loading your teams…</EmptyState> : error ? <EmptyState>{error}</EmptyState> : teams.length ? teams.map(item =>
        <div className="explore-card" key={item.team_id}>
          <Logo team={item.teams} />
          <a className="explore-card-main" href={"/teams/" + item.team_id} style={{ textDecoration: "none", color: "inherit" }}>
            <strong>{item.teams?.name || "Team"}</strong>
            <span>{item.teams?.area || "Oti"} · {item.teams?.short_name || "Team profile"}{item.teams?.home_venue ? " · " + item.teams.home_venue : ""}</span>
          </a>
          <button className="explore-action" onClick={() => remove(item.team_id)}>Remove</button>
        </div>
      ) : <EmptyState>No teams followed yet. Follow a team to build your personal list.</EmptyState>}
    </section>
  </ExplorePage>;
}