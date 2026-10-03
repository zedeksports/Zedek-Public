'use client';

import {useEffect,useState} from "react";
import {createSupabaseBrowserClient} from "../../lib/supabase/browser";

export default function Players(){
 const [players,setPlayers]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{async function load(){const s=createSupabaseBrowserClient();const {data,error}=await s.from("players").select("id,full_name,shirt_number,position,is_captain,photo_url,team:teams!players_team_id_fkey(id,name,short_name,area,logo_url)").eq("is_active",true).order("full_name");if(error)setError(error.message);else setPlayers(data||[]);setLoading(false)}load()},[]);
 return <main><section className="container page-hero"><span className="section-kicker">Zedek Sports</span><h1>Players</h1><p>Explore published players from local football across Oti.</p></section><section className="container public-player-directory">{loading?<div className="empty-state">Loading players…</div>:error?<div className="empty-state"><strong>Players could not be loaded.</strong><span>{error}</span></div>:players.length?players.map(p=><a className="public-player-card" href={"/players/"+p.id} key={p.id}><div className="public-player-photo">{p.photo_url?<img src={p.photo_url} alt=""/>:<span>{(p.full_name||"P").slice(0,1)}</span>}</div><div><span className="section-kicker">{p.team?.short_name||p.team?.name||"Team"}</span><h2>{p.full_name}</h2><p>{p.position||"Player"} {p.shirt_number!=null?"• #"+p.shirt_number:""}{p.is_captain?" • Captain":""}</p></div></a>):<div className="empty-state"><strong>No players published yet.</strong><span>Players will appear here after they are registered in the Control Room.</span></div>}</section></main>;
}
