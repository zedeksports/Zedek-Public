import { createSupabaseServerClient } from "../../../lib/supabase/server";
import LiveMatchCentre from "./LiveMatchCentre";

export const dynamic = "force-dynamic";

const LIVE_STATUSES = ["live", "in_progress", "halftime", "paused"];
const OFFICIAL_STATUSES = ["finished", "verified"];

export default async function MatchPage({ params }) {
  const { id } = await params;
  const supabase = createSupabaseServerClient();
  const [matchResult, verificationResult, eventsResult, lineupsResult, statsResult] = await Promise.all([
    supabase.from("matches").select("id,scheduled_at,kickoff_at,halftime_at,second_half_at,status,home_score,away_score,venue,round_name,leg,notes,home_team:teams!matches_home_team_id_fkey(id,name,short_name,logo_url),away_team:teams!matches_away_team_id_fkey(id,name,short_name,logo_url),season:seasons(id,name,competition:competitions(id,name))").eq("id", id).maybeSingle(),
    supabase.from("match_verifications").select("official_result").eq("match_id", id).eq("official_result", true).limit(1),
    supabase.from("match_events").select("id,event_type,minute,extra_minute,details,created_at,player_id,secondary_player_id,team_id,player:players!match_events_player_id_fkey(id,full_name,shirt_number),secondary_player:players!match_events_secondary_player_id_fkey(id,full_name,shirt_number),team:teams(id,name,short_name)").eq("match_id", id).order("minute",{ascending:true}).order("created_at",{ascending:true}),
    supabase.from("match_lineups").select("id,team_id,formation,captain_player_id,submitted_at,team:teams(id,name,short_name,logo_url),lineup_players:match_lineup_players(id,player_id,role,shirt_number,position,player:players(id,full_name,shirt_number,position,photo_url))").eq("match_id", id),
    supabase.from("match_statistics").select("*").eq("match_id", id).maybeSingle()
  ]);
  if (matchResult.error) return <main><div className="container data-note">{matchResult.error.message}</div></main>;
  const m=matchResult.data;
  if (!m) return <main><div className="container data-note">Match not found.</div></main>;
  const h2hResult=m.home_team?.id&&m.away_team?.id?await supabase.from("matches").select("id,scheduled_at,status,home_score,away_score,home_team:teams!matches_home_team_id_fkey(id,name,short_name),away_team:teams!matches_away_team_id_fkey(id,name,short_name)").neq("id",id).or(`and(home_team_id.eq.${m.home_team.id},away_team_id.eq.${m.away_team.id}),and(home_team_id.eq.${m.away_team.id},away_team_id.eq.${m.home_team.id})`).in("status",["finished","verified"]).order("scheduled_at",{ascending:false}).limit(5):{data:[],error:null};
  const h2h=h2hResult.error?[]:h2hResult.data||[];
  const live=LIVE_STATUSES.includes(m.status);
  const official=Boolean(verificationResult.data?.length)&&OFFICIAL_STATUSES.includes(m.status);
  const events=eventsResult.error?[]:eventsResult.data||[];
  const lineups=lineupsResult.error?[]:lineupsResult.data||[];
  const stats=statsResult.error?null:statsResult.data||null;
  return <main className="match-centre-page"><LiveMatchCentre initialMatch={m} initialEvents={events} initialStats={stats} initialLineups={lineups} initialH2H={h2h}/></main>;
}
