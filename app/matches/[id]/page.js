import { createSupabaseServerClient } from "../../../lib/supabase/server";
import LiveMatchCentre from "./LiveMatchCentre";

export const dynamic = "force-dynamic";

const LIVE_STATUSES = ["live", "in_progress", "halftime", "paused"];
const OFFICIAL_STATUSES = ["finished", "verified"];

export default async function MatchPage({ params }) {
  const { id } = await params;
  const supabase = createSupabaseServerClient();
  const [matchResult, verificationResult, eventsResult, lineupsResult, statsResult, headCoachesResult, previewResult, channelResult, streamAdsResult] = await Promise.all([
    supabase.from("matches").select("id,scheduled_at,rescheduled_at,kickoff_at,halftime_at,second_half_at,status,home_score,away_score,venue,referee,round_name,leg,notes,match_preview,media_channel,streaming_url,streaming_ad_text,interruption_reason,interruption_minute,outcome_note,home_team:teams!matches_home_team_id_fkey(id,name,short_name,logo_url,home_venue),away_team:teams!matches_away_team_id_fkey(id,name,short_name,logo_url,home_venue),season:seasons(id,name,competition:competitions(id,name))").eq("id", id).maybeSingle(),
    supabase.from("match_verifications").select("official_result").eq("match_id", id).eq("official_result", true).limit(1),
    supabase.from("match_events").select("id,event_type,minute,extra_minute,details,created_at,player_id,secondary_player_id,coach_id,team_id,player:players!match_events_player_id_fkey(id,full_name,shirt_number),secondary_player:players!match_events_secondary_player_id_fkey(id,full_name,shirt_number),coach:coaches!match_events_coach_id_fkey(id,full_name,role),team:teams(id,name,short_name)").eq("match_id", id).order("minute",{ascending:true}).order("created_at",{ascending:true}),
    supabase.from("match_lineups").select("id,team_id,coach_id,formation,captain_player_id,submitted_at,team:teams(id,name,short_name,logo_url),coach:coaches(id,full_name,role,photo_url),lineup_players:match_lineup_players(id,player_id,role,shirt_number,position,player:players(id,full_name,shirt_number,position,photo_url))").eq("match_id", id),
    supabase.from("match_statistics").select("*").eq("match_id", id).maybeSingle(),
    supabase.from("team_coaches").select("team_id,coach_id,role,coach:coaches(id,full_name,role,photo_url)").eq("is_current", true).eq("role", "Head Coach"),
    supabase.from("match_previews").select("id,match_id,headline,summary,key_storylines,form_note,h2h_note,venue_note,status,published_at,updated_at").eq("match_id", id).eq("status", "published").maybeSingle(),
    supabase.from("match_channels").select("id,match_id,channel_type,name,provider,url,is_primary,active,starts_at,ends_at,updated_at").eq("match_id", id).eq("active", true).order("is_primary", {ascending:false}).order("updated_at", {ascending:false}),
    supabase.from("match_stream_ads").select("id,match_id,ad_slot_id,position,active,ad_slot:ad_slots(id,name,placement,format,image_url,target_url,active,sponsor:sponsors(id,name,logo_url,website_url))").eq("match_id", id).eq("active", true).order("priority").order("created_at", {ascending:false})
  ]);
  if (matchResult.error) return <main><div className="container data-note">{matchResult.error.message}</div></main>;
  const m=matchResult.data;
  if (!m) return <main><div className="container data-note">Match not found.</div></main>;
  const h2hResult=m.home_team?.id&&m.away_team?.id?await supabase.from("matches").select("id,scheduled_at,status,home_score,away_score,home_team:teams!matches_home_team_id_fkey(id,name,short_name),away_team:teams!matches_away_team_id_fkey(id,name,short_name)").neq("id",id).or(`and(home_team_id.eq.${m.home_team.id},away_team_id.eq.${m.away_team.id}),and(home_team_id.eq.${m.away_team.id},away_team_id.eq.${m.home_team.id})`).in("status",["finished","verified"]).order("scheduled_at",{ascending:false}).limit(20):{data:[],error:null};
  const formQueries=await Promise.all([m.home_team?.id,m.away_team?.id].map(teamId=>teamId?supabase.from("matches").select("id,scheduled_at,status,home_score,away_score,home_team_id,away_team_id").neq("id",id).or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`).in("status",["finished","verified"]).order("scheduled_at",{ascending:false}).limit(5):Promise.resolve({data:[],error:null})));
  const form=formQueries.map((r,i)=>({teamId:[m.home_team?.id,m.away_team?.id][i],rank:i+1,team:[m.home_team,m.away_team][i],results:r.error?[]:(r.data||[]).map(x=>{const home=Number(x.home_score??0),away=Number(x.away_score??0),teamId=[m.home_team?.id,m.away_team?.id][i];return home===away?"D":(x.home_team_id===teamId?home>away:away>home)?"W":"L";})}));

  const h2h=h2hResult.error?[]:h2hResult.data||[];
  const live=LIVE_STATUSES.includes(m.status);
  const official=Boolean(verificationResult.data?.length)&&OFFICIAL_STATUSES.includes(m.status);
  const events=eventsResult.error?[]:eventsResult.data||[];
  const lineups=lineupsResult.error?[]:lineupsResult.data||[];
  const stats=statsResult.error?null:statsResult.data||null;
  const preview=previewResult.error?null:previewResult.data||null;
  const channels=channelResult.error?[]:channelResult.data||[];
  const headCoaches=headCoachesResult.error?[]:headCoachesResult.data||[];
  const streamAds=streamAdsResult.error?[]:streamAdsResult.data||[];
  return <main className="match-centre-page"><LiveMatchCentre initialMatch={m} initialEvents={events} initialStats={stats} initialLineups={lineups} initialHeadCoaches={headCoaches} initialH2H={h2h} initialForm={form} initialPreview={preview} initialChannels={channels} initialStreamAds={streamAds}/></main>;
}

// Production rebuild trigger: preserve the verified Match Centre implementation.
