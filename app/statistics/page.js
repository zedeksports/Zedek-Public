import { createSupabaseServerClient } from "../../lib/supabase/server";
import { ExplorePage, ExploreHeader, EmptyState } from "../ExploreChrome";

export const dynamic = "force-dynamic";

const number = value => Number(value || 0);

export default async function StatisticsPage({ searchParams }) {
  const sp = await searchParams;
  const view = sp?.view === "players" ? "players" : "scorers";
  const requestedCompetition = typeof sp?.competition === "string" ? sp.competition : "";
  const s = createSupabaseServerClient();

  const [{ data: competitions, error: competitionError }, { data: official, error: officialError }, { data: events, error: eventError }] = await Promise.all([
    s.from("competitions").select("id,name").eq("is_active", true).order("name", { ascending: true }),
    s.from("official_player_statistics").select("id,player_id,season_id,team_id,matches_played,goals,assists,yellow_cards,red_cards,minutes_played,player:players(id,full_name,position,photo_url),team:teams(id,name,short_name),season:seasons(id,competition:competitions(id,name))").order("goals", { ascending: false }).limit(1000),
    s.from("match_events").select("match_id,event_type,player_id,secondary_player_id,team_id,player:players!match_events_player_id_fkey(id,full_name,position,photo_url),team:teams(id,name,short_name),match:matches!match_events_match_id_fkey(status,season_id,season:seasons(id,competition:competitions(id,name)))").in("event_type", ["goal", "own_goal", "yellow_card", "red_card"]),
  ]);

  const selectedCompetition = competitions?.some(c => c.id === requestedCompetition)
    ? requestedCompetition
    : (competitions?.[0]?.id || "");
  const selectedCompetitionName = competitions?.find(c => c.id === selectedCompetition)?.name || "All competitions";
  const error = competitionError || (officialError && eventError ? officialError : null);
  const belongsToCompetition = row => !selectedCompetition || row?.season?.competition?.id === selectedCompetition;

  const grouped = new Map();
  const ensure = (id, player, team) => {
    if (!id) return null;
    if (!grouped.has(id)) grouped.set(id, {
      id,
      name: player?.full_name || "Player",
      team: team?.short_name || team?.name || "Team",
      position: player?.position || "",
      photo: player?.photo_url || "",
      matches: 0, goals: 0, assists: 0, yellow: 0, red: 0, minutes: 0,
    });
    const row = grouped.get(id);
    if (player?.full_name && row.name === "Player") row.name = player.full_name;
    if (team?.short_name || team?.name) row.team = team.short_name || team.name;
    if (player?.position) row.position = player.position;
    if (player?.photo_url) row.photo = player.photo_url;
    return row;
  };

  if (!competitionError && !officialError && official?.some(belongsToCompetition)) {
    for (const x of official.filter(belongsToCompetition)) {
      const row = ensure(x.player_id, x.player, x.team);
      if (!row) continue;
      row.matches += number(x.matches_played);
      row.goals += number(x.goals);
      row.assists += number(x.assists);
      row.yellow += number(x.yellow_cards);
      row.red += number(x.red_cards);
      row.minutes += number(x.minutes_played);
    }
  } else if (!competitionError && !eventError) {
    for (const e of (events || []).filter(x => x.match?.status === "verified" && (!selectedCompetition || x.match?.season?.competition?.id === selectedCompetition))) {
      if (e.event_type !== "own_goal") {
        const row = ensure(e.player_id, e.player, e.team);
        if (row && e.event_type === "goal") row.goals++;
        if (row && e.event_type === "yellow_card") row.yellow++;
        if (row && e.event_type === "red_card") row.red++;
      }
      if (e.event_type === "goal" && e.secondary_player_id) {
        const row = ensure(e.secondary_player_id, null, e.team);
        if (row) row.assists++;
      }
    }
  }

  const rows = [...grouped.values()].sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.name.localeCompare(b.name));
  const top = rows.slice(0, 10);
  const totalGoals = rows.reduce((n, x) => n + x.goals, 0);
  const totalAssists = rows.reduce((n, x) => n + x.assists, 0);

  return <ExplorePage>
    <ExploreHeader title={view === "players" ? "Player Stats" : "Top Scorers"} eyebrow="Football Intelligence" description={view === "players" ? "Player output from official statistics and verified match events." : "Goal and assist leaders for the selected competition."} />
    <section className="explore-feed">
      <form className="explore-card statistics-competition-picker" action="/statistics" method="get">
        <input type="hidden" name="view" value={view} />
        <label htmlFor="statistics-competition">Competition</label>
        <select id="statistics-competition" name="competition" defaultValue={selectedCompetition} aria-label="Choose competition">
          {(competitions || []).map(competition => <option key={competition.id} value={competition.id}>{competition.name}</option>)}
        </select>
        <button type="submit">View stats</button>
      </form>
      <div className="explore-statbar"><div><b>{rows.length}</b><span>Players tracked</span></div><div><b>{totalGoals}</b><span>Goals</span></div><div><b>{totalAssists}</b><span>Assists</span></div></div>
      <div className="explore-filter"><a className="explore-card" href={"/statistics?view=scorers&competition="+encodeURIComponent(selectedCompetition)}>Top Scorers</a><a className="explore-card" href={"/statistics?view=players&competition="+encodeURIComponent(selectedCompetition)}>Player Stats</a></div>
      {error ? <EmptyState>{error.message}</EmptyState> : rows.length ? <section className="explore-section"><span className="explore-section-kicker">{selectedCompetitionName.toUpperCase()}</span><h2>{view === "players" ? "Player statistics" : "Top 10 scorers"}</h2>{top.map((r, i) => <a className="explore-rank" href={"/players/" + r.id} key={r.id}><span className="explore-rank-num">{i + 1}</span><div className="explore-rank-main"><strong>{r.name}</strong><span>{r.team} · {r.position || "Player"} · {r.goals} goals · {r.assists} assists{view === "players" ? " · " + r.yellow + "Y · " + r.red + "R" : ""}</span></div><span className="explore-rank-value">{r.goals}</span></a>)}</section> : <EmptyState>No player statistics are available for {selectedCompetitionName} yet.</EmptyState>}
    </section>
  </ExplorePage>;
}
