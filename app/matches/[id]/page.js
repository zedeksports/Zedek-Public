import { createSupabaseServerClient } from "../../../lib/supabase/server";
import FollowButton from "../../../components/FollowButton";

export const dynamic = "force-dynamic";

const LIVE_STATUSES = ["live", "in_progress", "halftime", "paused"];
const OFFICIAL_STATUSES = ["finished", "verified"];

function dateTime(value) {
  return value
    ? new Intl.DateTimeFormat("en-GH", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Africa/Accra",
      }).format(new Date(value))
    : "Date TBC";
}

function Team({ team }) {
  return (
    <a className="match-detail-team" href={team?.id ? `/teams/${team.id}` : "#"}>
      <div className="mc-logo">
        {team?.logo_url ? (
          <img src={team.logo_url} alt="" />
        ) : (
          <span>{(team?.short_name || team?.name || "?").slice(0, 2).toUpperCase()}</span>
        )}
      </div>
      <h2>{team?.name || "Team TBC"}</h2>
    </a>
  );
}

export default async function MatchPage({ params }) {
  const { id } = await params;
  const supabase = createSupabaseServerClient();

  const [matchResult, verificationResult, eventsResult, lineupsResult, statsResult] =
    await Promise.all([
      supabase
        .from("matches")
        .select(
          "id,scheduled_at,status,home_score,away_score,venue,round_name,leg,notes,home_team:teams!matches_home_team_id_fkey(id,name,short_name,logo_url),away_team:teams!matches_away_team_id_fkey(id,name,short_name,logo_url),season:seasons(id,name,competition:competitions(id,name))"
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("match_verifications")
        .select("official_result")
        .eq("match_id", id)
        .eq("official_result", true)
        .limit(1),
      supabase
        .from("match_events")
        .select(
          "id,event_type,minute,extra_minute,details,player_id,secondary_player_id,team_id,player:players!match_events_player_id_fkey(id,full_name,shirt_number),secondary_player:players!match_events_secondary_player_id_fkey(id,full_name,shirt_number),team:teams(id,name,short_name)"
        )
        .eq("match_id", id)
        .order("minute", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("match_lineups")
        .select(
          "id,team_id,formation,captain_player_id,team:teams(id,name,short_name),lineup_players:match_lineup_players(id,player_id,role,shirt_number,position,player:players(id,full_name,shirt_number,position))"
        )
        .eq("match_id", id),
      supabase.from("match_statistics").select("*").eq("match_id", id).maybeSingle(),
    ]);

  if (matchResult.error) {
    return (
      <main>
        <div className="container data-note">{matchResult.error.message}</div>
      </main>
    );
  }

  const m = matchResult.data;
  if (!m) {
    return (
      <main>
        <div className="container data-note">Match not found.</div>
      </main>
    );
  }

  const h2hResult = m.home_team?.id && m.away_team?.id
    ? await supabase.from("matches").select("id,scheduled_at,status,home_score,away_score,home_team:teams!matches_home_team_id_fkey(id,name,short_name),away_team:teams!matches_away_team_id_fkey(id,name,short_name)").neq("id", id).or(`and(home_team_id.eq.${m.home_team.id},away_team_id.eq.${m.away_team.id}),and(home_team_id.eq.${m.away_team.id},away_team_id.eq.${m.home_team.id})`).in("status", ["finished","verified"]).order("scheduled_at",{ascending:false}).limit(5)
    : { data: [], error: null };
  const h2h = h2hResult.error ? [] : h2hResult.data || [];

  const live = LIVE_STATUSES.includes(m.status);
  const official =
    Boolean(verificationResult.data?.length) && OFFICIAL_STATUSES.includes(m.status);
  const events = eventsResult.error ? [] : eventsResult.data || [];
  const lineups = lineupsResult.error ? [] : lineupsResult.data || [];
  const stats = statsResult.error ? null : statsResult.data || null;

  return (
    <main>
      <section className="container page-hero">
        <div className="public-breadcrumbs">
          <a href="/matches">← All matches</a>
        </div>
        <span className="section-kicker">{m.season?.competition?.name || "Competition"}</span>
        <h1>{live ? "Live Match" : official ? "Official Result" : "Match Centre"}</h1>
        <p>{dateTime(m.scheduled_at)}{m.venue ? ` • ${m.venue}` : ""}</p>
        <div className="match-context-links">
          {m.season?.competition?.id ? (
            <a href={`/competitions/${m.season.competition.id}`}>View competition →</a>
          ) : null}
          {m.season?.id ? (
            <a href={`/standings?competition=${m.season.competition?.id || ""}&season=${m.season.id}`}>
              View standings →
            </a>
          ) : null}
        </div>
      </section>

      <section className="container match-detail"><nav className="match-detail-tabs" aria-label="Match information"><a href="#summary">Summary</a>{(live || official) ? <a href="#stats">Stats</a> : null}{lineups.length ? <a href="#lineups">Lineups</a> : null}{h2h.length ? <a href="#h2h">H2H</a> : null}</nav>
        <div className="match-detail-card" id="summary">
          <div className="mc-meta">
            <span>{m.round_name || "Match"}</span>
            <span className={live ? "live-dot" : ""}>
              {live ? "LIVE" : official ? "OFFICIAL" : m.status}
            </span>
          </div>
          <div className="match-detail-score">
            <Team team={m.home_team} />
            <div>
              <strong>{live || official ? m.home_score ?? 0 : "—"}</strong>
              <span>:</span>
              <strong>{live || official ? m.away_score ?? 0 : "—"}</strong>
            </div>
            <Team team={m.away_team} />
          </div>
          <div className="match-follow-row"><FollowButton type="match" id={m.id} label="Follow match"/></div>
          {m.leg ? <div className="match-detail-note">Leg {m.leg}</div> : null}
        </div>

        {(live || official) ? (
          <section className="detail-section">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Timeline</span>
                <h2>Match events</h2>
              </div>
            </div>
            {events.length ? (
              <div className="event-list">
                {events.map((e) => (
                  <div className="event-row" key={e.id}>
                    <b>{e.minute}'{e.extra_minute ? `+${e.extra_minute}` : ""}</b>
                    <span>
                      {e.event_type?.replaceAll("_", " ")}
                      {e.player?.full_name ? ` • ${e.player.full_name}` : ""}
                      {e.secondary_player?.full_name ? ` • ${e.secondary_player.full_name}` : ""}
                      {e.details ? ` — ${e.details}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">No recorded events yet.</div>
            )}
          </section>
        ) : null}

        {(live || official) && stats ? (
          <section className="detail-section">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Match statistics</span>
                <h2>Match statistics</h2>
              </div>
            </div>
            <div className="match-stats-grid">
              {[
                ["Possession", `${stats.home_possession ?? 0}% — ${stats.away_possession ?? 0}%`],
                ["Shots", `${stats.home_shots ?? 0} — ${stats.away_shots ?? 0}`],
                ["Shots on target", `${stats.home_shots_on_target ?? 0} — ${stats.away_shots_on_target ?? 0}`],
                ["Corners", `${stats.home_corners ?? 0} — ${stats.away_corners ?? 0}`],
                ["Fouls", `${stats.home_fouls ?? 0} — ${stats.away_fouls ?? 0}`],
                ["Offsides", `${stats.home_offsides ?? 0} — ${stats.away_offsides ?? 0}`],
                ["Pass accuracy", `${stats.home_pass_accuracy ?? 0}% — ${stats.away_pass_accuracy ?? 0}%`],
                ["xG", `${stats.home_xg ?? 0} — ${stats.away_xg ?? 0}`],
              ].map(([label, value]) => (
                <div className="stat-box" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {lineups.length ? (
          <section className="detail-section">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Lineups</span>
                <h2>Teams & players</h2>
              </div>
            </div>
            <div className="lineup-grid">
              {lineups.map((l) => (
                <div className="dashboard-card" key={l.id}>
                  <h3>{l.team?.name}</h3>
                  {l.formation ? <p className="lineup-formation">{l.formation}</p> : null}
                  <div className="lineup-list">
                    {(l.lineup_players || []).map((p) => (
                      <div className="lineup-player" key={p.id}>
                        <span>{p.shirt_number ?? p.player?.shirt_number ?? "—"}</span>
                        {p.player?.id ? (
                          <a href={`/players/${p.player.id}`}>
                            <strong>{p.player?.full_name || "Player"}</strong>
                          </a>
                        ) : (
                          <strong>{p.player?.full_name || "Player"}</strong>
                        )}
                        <small>{p.role || p.position || ""}</small>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {h2h.length ? (<section className="detail-section" id="h2h"><div className="section-heading"><div><span className="section-kicker">Head to head</span><h2>Recent meetings</h2></div><span className="verified-badge">Last 5</span></div><div className="h2h-list">{h2h.map((x) => { const homeWin=x.home_score!=null&&x.home_score>x.away_score; const awayWin=x.away_score!=null&&x.away_score>x.home_score; return <a className="h2h-row" href={"/matches/"+x.id} key={x.id}><span>{new Intl.DateTimeFormat("en-GH",{day:"numeric",month:"short",year:"numeric"}).format(new Date(x.scheduled_at))}</span><strong>{x.home_team?.short_name||x.home_team?.name||"Home"} <b>{x.home_score??0}:{x.away_score??0}</b> {x.away_team?.short_name||x.away_team?.name||"Away"}</strong><em>{homeWin?"HOME WIN":awayWin?"AWAY WIN":"DRAW"}</em></a>})}</div></section> : null}

        {m.notes ? (
          <section className="detail-section">
            <span className="section-kicker">Match notes</span>
            <p className="match-notes">{m.notes}</p>
          </section>
        ) : null}
      </section>
    </main>
  );
}
