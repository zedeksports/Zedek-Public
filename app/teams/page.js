import { createSupabaseServerClient } from "../../lib/supabase/server";
import { ExplorePage, ExploreHeader, EmptyState } from "../ExploreChrome";

export const dynamic = "force-dynamic";

function Logo({ team }) {
  return (
    <div className="explore-logo">
      {team?.logo_url ? <img src={team.logo_url} alt="" loading="lazy" /> : <span>{(team?.short_name || team?.name || "T").slice(0, 3).toUpperCase()}</span>}
    </div>
  );
}

function TeamCard({ team }) {
  return (
    <a className="explore-card" href={"/teams/" + team.id}>
      <Logo team={team} />
      <div className="explore-card-main">
        <strong>{team.name}</strong>
        <span>{team.area || "Oti"} · {team.short_name || "Team profile"}{team.home_venue ? " · " + team.home_venue : ""}</span>
      </div>
      <span className="explore-arrow">›</span>
    </a>
  );
}

export default async function TeamsPage() {
  const { data, error } = await createSupabaseServerClient()
    .from("teams")
    .select("id,name,short_name,area,home_venue,logo_url")
    .eq("is_active", true)
    .order("name", { ascending: true });

  return (
    <ExplorePage>
      <ExploreHeader
        title="Teams"
        eyebrow="Football Hub"
        description="Discover the clubs, identities and football communities across Oti."
      />
      <section className="explore-feed">
        {error ? <EmptyState>{error.message}</EmptyState> : data?.length ? data.map(team => <TeamCard team={team} key={team.id} />) : <EmptyState>No active teams published yet.</EmptyState>}
      </section>
    </ExplorePage>
  );
}
