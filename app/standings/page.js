import { createSupabaseServerClient } from "../../lib/supabase/server";
export const dynamic="force-dynamic";
function Table({rows}){return <div className="standings-table-wrap"><table className="standings-table"><thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr></thead><tbody>{rows.map((r,i)=><tr key={r.id}><td>{i+1}</td><td><strong>{r.name}</strong></td><td>{r.p}</td><td>{r.w}</td><td>{r.d}</td><td>{r.l}</td><td>{r.gf}</td><td>{r.ga}</td><td>{r.gf-r.ga}</td><td><strong>{r.pts}</strong></td></tr>)}</tbody></table></div>;}
export default async function StandingsPage({searchParams}){
 const sp=await searchParams;
 const competitionId=sp?.competition||"";
 const seasonId=sp?.season||"";
 const stageId=sp?.stage||"";
 const s=createSupabaseServerClient();
 const [{data:competitions,error:cE},{data:seasons,error:sE},{data:stages,error:stE},{data:matches,error:mE},{data:verified,error:vE}]=await Promise.all([
  s.from("competitions").select("id,name").eq("is_active",true).order("name"),
  s.from("seasons").select("id,name,year,competition_id").order("year",{ascending:false}),
  s.from("stages").select("id,name,season_id,stage_order,is_active").eq("is_active",true).order("stage_order"),
  s.from("matches").select("id,season_id,stage_id,home_team_id,away_team_id,home_score,away_score,status,home_team:teams!matches_home_team_id_fkey(id,name),away_team:teams!matches_away_team_id_fkey(id,name)"),
  s.from("match_verifications").select("match_id").eq("official_result",true)
 ]);
 const error=cE||sE||stE||mE||vE,official=new Set((verified||[]).map(x=>x.match_id));
 const seasonCandidates=(seasons||[]).filter(x=>!competitionId||x.competition_id===competitionId);
 const season=seasonCandidates.find(x=>x.id===seasonId)||seasonCandidates[0];
 const comp=competitions?.find(x=>x.id===season?.competition_id)||competitions?.find(x=>x.id===competitionId)||competitions?.[0];
 const stageCandidates=(stages||[]).filter(x=>x.season_id===season?.id);
 const stage=stageCandidates.find(x=>x.id===stageId)||stageCandidates[0];
 const relevant=(matches||[]).filter(m=>m.season_id===season?.id&&(!stage||m.stage_id===stage.id)&&official.has(m.id)&&["finished","verified"].includes(m.status));
 const map=new Map();
 const add=(id,name,gf,ga,w,d,l)=>{if(!map.has(id))map.set(id,{id,name,p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0});const r=map.get(id);r.p++;r.gf+=gf;r.ga+=ga;r.w+=w;r.d+=d;r.l+=l;r.pts+=w*3+d;};
 for(const m of relevant){if(m.home_score==null||m.away_score==null)continue;const h=m.home_score,a=m.away_score;add(m.home_team_id,m.home_team?.name||"Home",h,a,h>a?1:0,h===a?1:0,h<a?1:0);add(m.away_team_id,m.away_team?.name||"Away",a,h,a>h?1:0,h===a?1:0,a<h?1:0);}
 const rows=[...map.values()].sort((a,b)=>b.pts-a.pts||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||a.name.localeCompare(b.name));
 return <main><section className="container page-hero"><span className="section-kicker">Zedek Sports • Official</span><h1>Standings</h1><p>Verified competition tables, calculated from official results only.</p></section><section className="container standings-page">{error?<div className="data-note">{error.message}</div>:!season?<div className="empty-state"><strong>No published competition season yet.</strong><span>The official table will appear when a competition season is registered.</span></div>:<><form className="standings-filters" method="get"><label>Competition<select name="competition" defaultValue={competitionId}><option value="">All competitions</option>{(competitions||[]).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Season<select name="season" defaultValue={season.id}>{seasonCandidates.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Stage<select name="stage" defaultValue={stage?.id||""}><option value="">All active stages</option>{stageCandidates.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><button className="button" type="submit">Apply filters</button><a className="button button-secondary" href="/standings">Reset</a></form><div className="section-heading"><div><span className="section-kicker">{comp?.name||"Competition"}</span><h2>{season.name}{stage?" • "+stage.name:""}</h2></div><span className="verified-badge">✓ Official only</span></div>{rows.length?<Table rows={rows}/>:<div className="empty-state"><strong>No official results yet.</strong><span>Standings will populate automatically after verified matches are published.</span></div>}</>}</section></main>;
}