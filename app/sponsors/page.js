import { createSupabaseServerClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SponsorsPage() {
  const supabase = createSupabaseServerClient();
  const today = new Date().toISOString().slice(0,10);
  const [{data:sponsors,error:sponsorError},{data:ads,error:adsError}] = await Promise.all([
    supabase.from("sponsors").select("id,name,logo_url,website_url,tier,status,start_date,end_date").eq("status","active").or("start_date.is.null,start_date.lte."+today).or("end_date.is.null,end_date.gte."+today).order("tier").order("name"),
    supabase.from("ad_slots").select("id,name,placement,format,image_url,target_url,sponsor_id").eq("active",true).or("start_date.is.null,start_date.lte."+today).or("end_date.is.null,end_date.gte."+today).order("created_at",{ascending:false}).limit(12)
  ]);
  const error=sponsorError||adsError;
  return <main>
    <section className="container page-hero">
      <span className="section-kicker">ZEDEK SPORTS • PARTNERS</span>
      <h1>Supporting local football.</h1>
      <p>Meet the organisations helping Zedek Sports document, follow and grow football across Oti.</p>
    </section>
    <section className="container section">
      {error?<div className="data-note">{error.message}</div>:null}
      {sponsors?.length?<div className="news-grid">
        {sponsors.map(s=><a key={s.id} className="news-card" href={s.website_url||"#"} target={s.website_url?"_blank":undefined} rel={s.website_url?"noreferrer":undefined}>
          <div className="news-cover">{s.logo_url?<img src={s.logo_url} alt={s.name} loading="lazy"/>:<span>ZEDEK<br/>PARTNER</span>}</div>
          <div className="news-card-body"><span className="section-kicker">{s.tier||"Partner"}</span><h2>{s.name}</h2><p>Official Zedek Sports partner.</p></div>
        </a>)}
      </div>:<div className="empty-state"><strong>No public sponsors yet.</strong><span>Verified sponsorship partners will appear here when activated in the Control Room.</span></div>}
    </section>
    {ads?.length?<section className="container section">
      <div className="page-hero" style={{paddingBottom:20}}><span className="section-kicker">PUBLIC PARTNERSHIPS</span><h2>Featured partner placements.</h2></div>
      <div className="news-grid">
        {ads.map(ad=><a key={ad.id} className="news-card" href={ad.target_url||"#"} target={ad.target_url?"_blank":undefined} rel={ad.target_url?"noreferrer":undefined}>
          <div className="news-cover">{ad.image_url?<img src={ad.image_url} alt={ad.name} loading="lazy"/>:<span>{ad.name}</span>}</div>
          <div className="news-card-body"><span className="section-kicker">{ad.placement||"Partner placement"}</span><h2>{ad.name}</h2><p>Featured on Zedek Sports.</p></div>
        </a>)}
      </div>
    </section>:null}
  </main>;
}
