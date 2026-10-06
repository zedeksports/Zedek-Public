'use client';

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";
import PWAInstallPrompt from "./PWAInstallPrompt";
import LiveNotificationAlerts from "./LiveNotificationAlerts";

const primaryNav=[["Matches","/matches"],["Live","/matches?filter=live"]];
const exploreNav=[["News","/news"],["Community","/community"],["Competitions","/competitions"],["Teams","/teams"],["Standings","/standings"],["Top Scorers","/statistics?view=scorers"],["Player Stats","/statistics?view=players"],["Search","/search"],["My Teams","/favorites"]];

export default function PublicShell({children}){
 const [menuOpen,setMenuOpen]=useState(false),[accountOpen,setAccountOpen]=useState(false),[night,setNight]=useState(false),[user,setUser]=useState(null),[unread,setUnread]=useState(0);
 useEffect(()=>{if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(()=>{}); const saved=localStorage.getItem("zedek-theme");const isNight=saved==="night";setNight(isNight);document.documentElement.dataset.zedekTheme=isNight?"night":"day";const supabase=createSupabaseBrowserClient();let mounted=true;supabase.auth.getSession().then(({data})=>{if(mounted)setUser(data.session?.user||null)});const {data}=supabase.auth.onAuthStateChange((_event,session)=>{setUser(session?.user||null);if(!session)setUnread(0)});return()=>{mounted=false;data.subscription.unsubscribe()};},[]);
 function toggleTheme(){const next=!night;setNight(next);localStorage.setItem("zedek-theme",next?"night":"day");document.documentElement.dataset.zedekTheme=next?"night":"day";}
 function closeLayers(){setMenuOpen(false);setAccountOpen(false);}
 async function signOut(){await createSupabaseBrowserClient().auth.signOut();closeLayers();window.location.href="/";}
 return <div className="public-site-shell">
  <header className="site-header zedek-score-header public-global-header">
   <div className="container public-nav-top">
    <a className="public-brand" href="/" aria-label="Oti Football Network home"><span className="public-brand-mark">O</span><span><b>OTI</b> FOOTBALL <strong>NETWORK</strong></span></a>
    <nav className="public-main-nav" aria-label="Primary football navigation">
      {primaryNav.map(([label,href])=><a key={href} href={href} className={label==="Matches"?"active":""}>{label}</a>)}
    </nav>
    <div className="header-actions">
      <button className="icon-button menu-button" onClick={()=>setMenuOpen(x=>!x)} aria-expanded={menuOpen} aria-label="Open football menu">☰</button>
      {user?<div className="account-wrap"><button className="account-avatar" onClick={()=>setAccountOpen(x=>!x)} aria-expanded={accountOpen} aria-label="Account">{(user.user_metadata?.full_name||user.email||"O").slice(0,1).toUpperCase()}</button>{accountOpen?<div className="account-menu"><strong>{user.user_metadata?.full_name||user.email}</strong><a href="/favorites" onClick={closeLayers}>★ Favourites</a><a href="/notifications" onClick={closeLayers}>◉ Notifications {unread>0?<b>{unread>99?"99+":unread}</b>:null}</a><a href="/settings" onClick={closeLayers}>⚙ Settings</a><button onClick={signOut}>Sign out</button></div>:null}</div>:<a className="sign-in-button" href="/login">Sign in</a>}
      <button className="theme-button" onClick={toggleTheme} aria-label="Toggle day and night mode">{night?"☀":"☾"}</button>
    </div>
   </div>
   <div className="container public-nav-bottom">
    <div className="match-mode-control" aria-label="Match mode">
      <a className="match-mode active" href="/matches"><span className="mode-icon">▦</span> Matches</a>
      <a className="match-mode live-mode" href="/matches?filter=live"><span className="live-pulse"></span> Live</a>
    </div>
    <form className="header-search" action="/search" method="get">
      <span className="header-search-icon" aria-hidden="true">⌕</span>
      <input name="q" placeholder="Search teams, players, competitions or matches…" aria-label="Search teams, players, competitions or matches" />
      <button type="submit">Search</button>
      <a href="/search">Full Search <span>→</span></a>
    </form>
   </div>
  </header>
  <aside className={menuOpen?"zedek-drawer open":"zedek-drawer"} aria-hidden={!menuOpen}>
   <div className="zedek-drawer-head"><div><span className="drawer-kicker">OTI FOOTBALL NETWORK</span><strong>Football menu</strong></div><button className="drawer-close" onClick={()=>setMenuOpen(false)} aria-label="Close menu">×</button></div>
   <div className="drawer-primary">{primaryNav.map(([label,href])=><a key={href} href={href} onClick={()=>setMenuOpen(false)}>{label}<span>→</span></a>)}</div>
   <div className="drawer-section"><span className="drawer-kicker">EXPLORE</span>{exploreNav.map(([label,href])=><a key={href} href={href} onClick={()=>setMenuOpen(false)}>{label}<span>↗</span></a>)}</div>
   <div className="drawer-section account-drawer-links"><span className="drawer-kicker">YOUR FOOTBALL</span>{user?<><a href="/favorites" onClick={()=>setMenuOpen(false)}>Favourites<span>★</span></a><a href="/notifications" onClick={()=>setMenuOpen(false)}>Notifications{unread>0?<span>{unread}</span>:<span>→</span>}</a><a href="/settings" onClick={()=>setMenuOpen(false)}>Settings<span>⚙</span></a></>:<a href="/login" onClick={()=>setMenuOpen(false)}>Sign in<span>→</span></a>}</div>
   <div className="drawer-note">Follow local teams, find live scores and keep your football settings synced to your account.</div>
  </aside>
  {menuOpen&&<button className="zedek-drawer-backdrop" aria-label="Close menu" onClick={()=>setMenuOpen(false)}/>}
  {children}
  <LiveNotificationAlerts onUnreadChange={setUnread} />
  <PWAInstallPrompt />
  <footer className="site-footer public-global-footer"><div className="container footer-inner"><div><div className="brand footer-brand"><span className="brand-mark">O</span><span>OTI <b>FOOTBALL NETWORK</b></span></div><p>Live football. Local teams. Real scores. Real people.</p></div><div className="footer-links"><a href="/matches">Matches</a><a href="/matches?filter=live">Live</a><a href="/competitions">Football Hub</a><a href="/install">Install App</a>{user?<a href="/settings">Settings</a>:<a href="/login">Sign in</a>}</div></div></footer>
 </div>;
}