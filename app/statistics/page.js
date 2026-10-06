import { createSupabaseServerClient } from "../../lib/supabase/server";
import { ExplorePage, ExploreHeader, EmptyState } from "../ExploreChrome";

export const dynamic = "force-dynamic";

export default async function StatisticsPage({ searchParams }) {
  const sp = await searchParams;
  const view = sp?.view === "players" ? "players" : "scorers";
  const s = createSupabaseServerClient();

  const [{ data: official, error: officialError }, { data: events, error: eventError }] = await Promise.all([
    s.from("official_player_statistics").select("id,player_id,season_id,team_id,matches_played,goals,assists,yellow_cards,red_cards,minutes_played,player:players(id,full_name,position,photo_url),team:teams(id,name,short_name)").order("goals", { ascending: false }).limit(500),
    s.from("match_events").select("match_id,event_type,player_id,secondary_player_id,team_id,player:players!match_events_player_id_fkey(id,full_name,position),team:teams(id,name,short_name),match:matches!match_events_match_id_fkey(status,season_id)").in("event_type", ["goal", "own_goal", "yellow_card", "red_card"]),
  ]);

  const error = officialError || eventError;
  const map = new Map();
  const ensure = (id, player, team) => {
    if (!id) return null;
    if (!map.has(id)) map.set(id, { id, name: player?.full_name || "Player", team: team?.short_name || team?.name || "Team", position: player?.position || "", matches: 0, goals: 0, assists: 0, yellow: 0, red: 0 });
    return map.get(id);
  };

  for (const row of official || []) {
    const r = ensure(row.player_id, row.player, row.team);
    if (!r) continue;
    r.matches = Math.max(r.matches, row.matches_played || 0);
    r.goals = Math.max(r.goals, row.goals || 0);
    r.assists = Math.max(r.assists, row.assists || 0);
    r.yellow = Math.max(r.yellow, row.yellow_cards || 0);
    r.red = Math.max(r.red, row.red_cards || 0);
  }

  const verifiedEvents = (events || []).filter(e => e.match?.status === "verified");
  for (const e of verifiedEvents) {
    if (e.event_type !== "own_goal") {
      const r = ensure(e.player_id, e.player, e.team);
      if (r && e.event_type === "goal") r.goals += 1;
      if (r && e.event_type === "yellow_card") r.yellow += 1;
      if (r && e.event_type === "red_card") r.red += 1;
    }
    if (e.event_type === "goal" && e.secondary_player_id) {
      const r = ensure(e.secondary_player_id, null, e.team);
      if (r) r.assists += 1;
    }
  }

  const rows = [...map.values()].sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.name.localeCompare(b.name));
  const top = rows.slice(0, 10);

  return <ExplorePage>
    <ExploreHeader title={view === "players" ? "Player Stats" : "Top Scorers"} eyebrow="Football Intelligence" description={view === "players" ? "Player output from official statistics and verified match events." : "Goal and assist leaders from the verified football record."} />
    <section className="explore-feed">
      <div className="explore-statbar"><div><b>{rows.length}</b><span>Players tracked</span></div><div><b>{rows.reduce((n, x) => n + x.goals, 0)}</b><span>Goals</span></div><div><b>{rows.reduce((n, x) => n + x.assists, 0)}</b><span>Assists</span></div></div>
      <div className="explore-filter"><a className="explore-card" href="/statistics?view=scorers" style={{ padding: "8px 11px" }}>Top Scorers</a><a className="explore-card" href="/statistics?view=players" style={{ padding: "8px 11px" }}>Player Stats</a></div>
      {error ? <EmptyState>{error.message}</EmptyState> : rows.length ? <section className="explore-section"><span className="explore-section-kicker">{view === "players" ? "PLAYER OUTPUT" : "GOALS & ASSISTS"}</span><h2>{view === "players" ? "Player statistics" : "Top 10 scorers"}</h2>{top.map((r, i) => <a className="explore-rank" href={"/players/" + r.id} key={r.id}><span className="explore-rank-num">{i + 1}</span><div className="explore-rank-main"><strong>{r.name}</strong><span>{r.team} · {r.position || "Player"} · {r.goals} goals · {r.assists} assists{view === "players" ? " · " + r.yellow + "Y · " + r.red + "R" : ""}</span></div><span className="explore-rank-value">{r.goals}</span></a>)}</section> : <EmptyState>No player statistics or verified match-event records are available yet.</EmptyState>}
    </section>
  </ExplorePage>;
}