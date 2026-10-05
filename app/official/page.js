'use client';

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

export default function OfficialPortal(){
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [profile,setProfile]=useState(null);
  const [assignments,setAssignments]=useState([]);
  const [teamData,setTeamData]=useState([]);
  const [selected,setSelected]=useState(null);

  useEffect(()=>{
    let mounted=true;
    (async()=>{
      const supabase=createSupabaseBrowserClient();
      const {data:{session},error:sessionError}=await supabase.auth.getSession();
      if(sessionError) { if(mounted){setError(sessionError.message);setLoading(false)} return; }
      if(!session){window.location.href="/login";return;}
      const p=await supabase.from("profiles").select("id,full_name,phone,role,is_active").eq("id",session.user.id).maybeSingle();
      if(p.error){if(mounted){setError(p.error.message);setLoading(false)}return;}
      if(!p.data?.is_active||p.data.role!=="team_official"){if(mounted){setError("This account does not have Team Official access. Ask a Zedek administrator to activate your account.");setLoading(false)}return;}
      const a=await supabase.from("team_officials").select("id,team_id,role,start_date,end_date,is_current,teams(id,name,short_name,area,home_venue,logo_url)").eq("user_id",session.user.id).eq("is_current",true).order("created_at",{ascending:false});
      if(a.error){if(mounted){setError(a.error.message);setLoading(false)}return;}
      const rows=a.data||[];
      if(mounted){setProfile(p.data);setAssignments(rows);setSelected(rows[0]||null);}
      const ids=rows.map(x=>x.team_id);
      if(ids.length){
        const [players,matches]=await Promise.all([
          supabase.from("players").select("id,full_name,shirt_number,position,photo_url,is_captain,team_id").in("team_id",ids).eq("is_active",true).order("shirt_number"),
          supabase.from("matches").select("id,scheduled_at,status,home_score,away_score,home_team_id,away_team_id,home_team:teams!matches_home_team_id_fkey(id,name,short_name,logo_url),away_team:teams!matches_away_team_id_fkey(id,name,short_name,logo_url),season:seasons(id,name,competition:competitions(id,name))").or(ids.map(id=>"home_team_id.eq."+id+",away_team_id.eq."+id).join(",")).order("scheduled_at",{ascending:true}).limit(30)
        ]);
        if(mounted){setTeamData([{players:players.data||[],matches:matches.data||[]}]);}
      }
      if(mounted)setLoading(false);
    })();
    return()=>{mounted=false};
  },[]);

  async function signOut(){await createSupabaseBrowserClient().auth.signOut();window.location.href="/login";}

  if(loading)return <main className="page account-page"><div className="container empty-state">Loading your official workspace…</div></main>;
  if(error)return <main className="page account-page"><div className="container empty-state"><strong>Official access</strong><span style={{display:"block",marginTop:8}}>{error}</span><a className="button" href="/login" style={{display:"inline-flex",marginTop:18}}>Back to sign in</a></div></main>;

  const current=selected?.teams;
  const data=teamData[0]||{players:[],matches:[]};
  const teamId=selected?.team_id;
  const matches=data.matches.filter(m=>m.home_team_id===teamId||m.away_team_id===teamId).slice(0,10);

  return <main className="page">
    <section className="container page-hero">
      <span className="section-kicker">ZEDEK SPORTS • OFFICIAL</span>
      <h1>Official Portal</h1>
      <p>Welcome, {profile?.full_name||"Team Official"}. This workspace shows the teams currently assigned to your official account.</p>
      <button className="button" onClick={signOut}>Sign out</button>
    </section>
    <section className="container" style={{paddingBottom:60}}>
      {!assignments.length?<div className="empty-state"><strong>Account activated — team assignment pending.</strong><span>Your Zedek account is a Team Official account, but no current team assignment has been made yet.</span></div>:
      <>
        {assignments.length>1&&<div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:18}}>{assignments.map(a=><button key={a.id} className={"button "+(selected?.id===a.id?"primary":"")} onClick={()=>setSelected(a)}>{a.teams?.name||"Team"}</button>)}</div>}
        <div className="settings-layout" style={{alignItems:"start"}}>
          <section className="settings-card">
            <span className="section-kicker">ASSIGNED TEAM</span>
            <h2>{current?.name||"Team"}</h2>
            <p>{selected?.role||"Team Official"}{current?.area?" • "+current.area:""}{current?.home_venue?" • "+current.home_venue:""}</p>
            <div className="team-record" style={{marginTop:18}}>
              <div><b>{data.players.length}</b><span>Active players</span></div>
              <div><b>{matches.length}</b><span>Fixtures</span></div>
            </div>
          </section>
          <section className="settings-card">
            <span className="section-kicker">ACCESS</span>
            <h2>Official status</h2>
            <p>Your account is active and linked to the team above. Zedek administrators control team assignments and official roles.</p>
            <a className="button" href={teamId?"/teams/"+teamId:"/teams"}>Open public team profile</a>
          </section>
        </div>
        <section className="settings-card" style={{marginTop:16}}>
          <span className="section-kicker">SQUAD</span><h2>Active players</h2>
          {data.players.length?<div className="squad-grid">{data.players.map(p=><div className="player-card" key={p.id}><div className="player-photo">{p.photo_url?<img src={p.photo_url} alt="" loading="lazy"/>:<span>{(p.full_name||"P").slice(0,1)}</span>}</div><div className="player-card-info"><span>#{p.shirt_number??"—"} {p.is_captain?"• Captain":""}</span><h3>{p.full_name}</h3><p>{p.position||"Player"}</p></div></div>)}</div>:<div className="empty-state compact">No active players are currently registered for this team.</div>}
        </section>
        <section className="settings-card" style={{marginTop:16}}>
          <span className="section-kicker">FIXTURES</span><h2>Team schedule</h2>
          {matches.length?<div className="team-match-list">{matches.map(m=>{const home=m.home_team_id===teamId;const opp=home?m.away_team:m.home_team;return <a className="team-match-row" href={"/matches/"+m.id} key={m.id}><div className="team-match-date"><b>{new Intl.DateTimeFormat("en-GH",{day:"numeric",month:"short",year:"numeric"}).format(new Date(m.scheduled_at))}</b><span>{m.season?.competition?.name||"Competition"}</span></div><div className="team-match-opponent"><span>{home?"vs":"at"}</span><strong>{opp?.short_name||opp?.name||"Opponent"}</strong></div><div className="team-match-score"><span className="match-status">{m.status||"scheduled"}</span></div></a>})}</div>:<div className="empty-state compact">No fixtures currently linked to this team.</div>}
        </section>
      </>}
    </section>
  </main>;
}
