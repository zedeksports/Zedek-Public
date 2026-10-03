'use client';

import { useMemo, useState } from "react";
import HomeLiveData from "./HomeLiveData";

const filters = ["ALL", "LIVE", "UPCOMING", "RESULTS", "MY TEAMS"];

function dayItems() {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return {
      key: new Intl.DateTimeFormat("en-CA", { year:"numeric", month:"2-digit", day:"2-digit", timeZone:"Africa/Accra" }).format(d),
      day: i === 0 ? "TODAY" : d.toLocaleDateString("en-GH", { weekday:"short", timeZone:"Africa/Accra" }).toUpperCase(),
      date: d.toLocaleDateString("en-GH", { day:"numeric", month:"short", timeZone:"Africa/Accra" }),
    };
  });
}

function HeroMark() {
  return (
    <div className="grass-root-art" aria-label="Grass root football">
      <div className="grass-root-glow" />
      <svg viewBox="0 0 620 500" role="img" aria-hidden="true">
        <defs>
          <linearGradient id="pitch" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#173b2b"/><stop offset="1" stopColor="#0a1820"/></linearGradient>
          <linearGradient id="jersey" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#20a86b"/><stop offset="1" stopColor="#0d5b45"/></linearGradient>
        </defs>
        <rect width="620" height="500" rx="34" fill="url(#pitch)"/>
        <path d="M-20 430 Q220 300 660 350" fill="none" stroke="#e7c15a" strokeWidth="4" opacity=".65"/>
        <path d="M35 460 Q270 335 640 390" fill="none" stroke="#fff" strokeWidth="2" opacity=".16"/>
        <circle cx="495" cy="318" r="24" fill="#fff"/>
        <path d="M480 318 l15-15 17 7 5 20-16 12-18-8z" fill="#18222c"/>
        <circle cx="270" cy="125" r="38" fill="#7a4b2e"/>
        <path d="M224 120 Q268 54 322 113 L306 140 Q270 105 231 145z" fill="#151515"/>
        <path d="M238 163 Q280 145 318 166 L340 290 278 322 220 286z" fill="url(#jersey)"/>
        <path d="M238 180 L180 250 L202 268 L258 220" fill="#7a4b2e"/>
        <path d="M318 180 L366 230 L349 248 L300 213" fill="#7a4b2e"/>
        <path d="M249 310 L225 400 L267 405 L288 326z" fill="#101b2b"/>
        <path d="M292 320 L325 378 L405 344 L420 369 L312 423 L270 340z" fill="#101b2b"/>
        <path d="M325 378 L410 342 L430 365 L338 414z" fill="#f1f1ec"/>
        <path d="M220 399 L262 401 L270 425 L214 425z" fill="#fff"/>
        <circle cx="431" cy="366" r="18" fill="#fff"/>
        <path d="M421 366 l10-9 12 5 3 13-11 9-12-6z" fill="#1a2733"/>
        <text x="38" y="52" fill="#e7c15a" fontSize="16" fontWeight="900" letterSpacing="4">ZEDEK SPORTS</text>
      </svg>
      <div className="grass-root-title"><span>GRASS ROOT</span><strong>FOOTBALL</strong></div>
    </div>
  );
}

export default function HomeScoreClient({ initialData }) {
  const days = useMemo(() => dayItems(), []);
  const [selectedDay, setSelectedDay] = useState(days[0].key);
  const [filter, setFilter] = useState("ALL");

  return (
    <main className="page theme-day">
      <section className="score-hero">
        <div className="container score-hero-inner">
          <div className="score-hero-copy">
            <span className="section-kicker"><i className="score-live-dot" /> OTI FOOTBALL NETWORK</span>
            <h1>GRASS ROOT FOOTBALL.<br /><em>WHERE YOU GROW.</em></h1>
            <p>Live scores, fixtures and the people behind the game — from community pitches across Oti.</p>
            <div className="hero-actions">
              <a className="hero-action-primary" href="/matches">Open Match Centre <span>→</span></a>
              <a className="hero-action-secondary" href="/competitions">Explore competitions <span>↗</span></a>
            </div>
          </div>
          <HeroMark />
        </div>
      </section>

      <section className="container score-feed">
        <div className="score-topbar">
          <div><span className="section-kicker">FOOTBALL</span><h2>Matches</h2></div>
          <a href="/matches" className="score-all-link">All matches →</a>
        </div>
        <div className="score-date-strip" aria-label="Match dates">
          {days.map((d) => <button type="button" key={d.key} className={selectedDay === d.key ? "score-day active" : "score-day"} onClick={() => setSelectedDay(d.key)}><b>{d.day}</b><span>{d.date}</span></button>)}
          <label className="score-calendar" aria-label="Choose match date"><span>CAL</span><input type="date" value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)} /></label>
        </div>
        <div className="score-filter-row" role="tablist" aria-label="Match filters">
          {filters.map((item) => <button type="button" role="tab" aria-selected={filter === item} key={item} className={filter === item ? "score-filter active" : "score-filter"} onClick={() => setFilter(item)}>{item}</button>)}
        </div>
        <div className="score-live-banner"><span><i className="score-live-dot" /> LIVE CENTRE</span><strong>Official Zedek match information</strong><a href="/matches?filter=live">Open live matches →</a></div>
        <HomeLiveData selectedDay={selectedDay} filter={filter} initialData={initialData} />
      </section>

      <section className="container score-explore">
        <div className="score-topbar"><div><span className="section-kicker">FOOTBALL HUB</span><h2>Everything else lives one layer down.</h2></div></div>
        <div className="score-explore-grid">
          <a href="/competitions"><span>01</span><strong>Competitions</strong><small>Seasons, standings, scorers and player statistics.</small><b>→</b></a>
          <a href="/teams"><span>02</span><strong>Teams & squads</strong><small>Club identity, full squad and individual player profiles.</small><b>→</b></a>
          <a href="/search"><span>03</span><strong>Search the football</strong><small>Find a team, player, competition, season or match.</small><b>→</b></a>
        </div>
      </section>
    </main>
  );
}
