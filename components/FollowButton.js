'use client';

import { useEffect,useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

export default function FollowButton({type,id,label}){
 const [followed,setFollowed]=useState(false);const [loading,setLoading]=useState(true);
 useEffect(()=>{(async()=>{const s=createSupabaseBrowserClient();const {data:{session}}=await s.auth.getSession();if(!session){setLoading(false);return}const table=type==="team"?"user_favorite_teams":"user_favorite_matches";const column=type==="team"?"team_id":"match_id";const {data}=await s.from(table).select(column).eq(column,id).maybeSingle();setFollowed(Boolean(data));setLoading(false)})()},[type,id]);
 async function toggle(event){event?.stopPropagation();const s=createSupabaseBrowserClient();const {data:{session}}=await s.auth.getSession();if(!session){window.location.href="/login";return}setLoading(true);const table=type==="team"?"user_favorite_teams":"user_favorite_matches";const column=type==="team"?"team_id":"match_id";if(followed){const {error}=await s.from(table).delete().eq(column,id);if(!error)setFollowed(false)}else{const {error}=await s.from(table).insert({[column]:id,user_id:session.user.id});if(!error)setFollowed(true)}setLoading(false)}
 return <button className={followed?"follow-button active":"follow-button"} onClick={toggle} disabled={loading} aria-pressed={followed}>{followed?"★ Following":"☆ "+(label||"Follow")}</button>;
}