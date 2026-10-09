'use client';

import { useMemo, useState } from "react";
import HomeLiveData from "./HomeLiveData";

const filters = ["ALL", "LIVE", "UPCOMING", "RESULTS", "MY TEAMS", "FAVOURITES"];

function dayItems() {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  return Array.from({ length: 8 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return {
      key: new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "Africa/Accra",
      }).format(d),
      day: i === 0 ? "TODAY" : d.toLocaleDateString("en-GH", {
        weekday: "short",
        timeZone: "Africa/Accra",
      }).toUpperCase(),
      date: d.toLocaleDateString("en-GH", {
        day: "numeric",
        month: "short",
        timeZone: "Africa/Accra",
      }),
    };
  });
}

function formatNewsDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GH", { day: "numeric", month: "short" }).format(new Date(value));
}

function NewsRail({ news }) {
  if (!news?.length) {
    return (
      <div className="oti-home-card oti-home-empty-card">
        <span className="oti-home-kicker">NEWS</span>
        <h3>Local football stories</h3>
        <p>Reports, team updates, player stories and competition news from Oti will appear here.</p>
        <a href="/news">Open football news →</a>
      </div>
    );
  }

  const [lead, ...rest] = news;
  return (
    <div className="oti-home-card oti-news-rail">
      <div className="oti-home-card-head">
        <div>
          <span className="oti-home-kicker">NEWS</span>
          <h3>Trending around Oti</h3>
        </div>
        <a href="/news">See more</a>
      </div>
      <a className="oti-news-lead" href={"/news/" + lead.slug}>
        <div className="oti-news-image">
          {lead.cover_image_url ? <img src={lead.cover_image_url} alt="" loading="lazy" decoding="async" /> : <span>OTI<br />FOOTBALL</span>}
        </div>
        <div className="oti-news-copy">
          <span>{lead.category || "Football"} · {formatNewsDate(lead.published_at)}</span>
          <strong>{lead.title}</strong>
          <p>{lead.excerpt || "Read the latest local football update."}</p>
        </div>
      </a>
      <div className="oti-news-list">
        {rest.map((item) => (
          <a href={"/news/" + item.slug} key={item.id}>
            <span>{item.category || "Football"} · {formatNewsDate(item.published_at)}</span>
            <strong>{item.title}</strong>
            <b>›</b>
          </a>
        ))}
      </div>
    </div>
  );
}

function CompetitionRail({ competitions }) {
  return (
    <div className="oti-home-card">
      <div className="oti-home-card-head">
        <div>
          <span className="oti-home-kicker">TABLES IN FOCUS</span>
          <h3>Oti competitions</h3>
        </div>
        <a href="/competitions">All</a>
      </div>
      <div className="oti-competition-list">
        {(competitions || []).slice(0, 8).map((competition, index) => (
          <a href={"/competitions/" + competition.id} key={competition.id}>
            <span className="oti-competition-rank">{String(index + 1).padStart(2, "0")}</span>
            <span>{competition.name}</span>
            <b>›</b>
          </a>
        ))}
        {!competitions?.length ? <p className="oti-home-muted">Published competitions will appear here.</p> : null}
      </div>
    </div>
  );
}

export default function HomeScoreClient({ initialData }) {
  const days = useMemo(() => dayItems(), []);
  const [selectedDay, setSelectedDay] = useState(days[0].key);
  const [filter, setFilter] = useState("ALL");

  return (
    <div className="oti-home-shell">
      <section className="oti-home-identity">
        <div className="container">
          <div className="oti-home-identity-inner">
            <div>
              <span className="oti-home-kicker"><i className="oti-live-pip" /> ZEDEK FOOTBALL NETWORK 🇬🇭</span>
              <h1>GRASS ROOT FOOTBALL.<br /><em>WHERE YOU GROW.</em></h1>
              <p>Live scores, fixtures, results, stories and the people behind the game — all from the grassroots pitches of Oti.</p>
            </div>
            <div className="oti-home-identity-meta">
              <span>LOCAL FOOTBALL</span>
              <strong>Oti Region</strong>
              <small>Community first · Matchday focused</small>
            </div>
          </div>
        </div>
      </section>

      <section className="container oti-home-leagues" aria-label="Oti competitions">
        <div className="oti-home-section-label">
          <span className="oti-home-kicker">TOP COMPETITIONS</span>
          <a href="/competitions">View all →</a>
        </div>
        <div className="oti-league-strip">
          {(initialData.competitionList || []).slice(0, 10).map((competition) => (
            <a href={"/competitions/" + competition.id} key={competition.id} className="oti-league-chip">
              <span>◈</span>
              <strong>{competition.name}</strong>
            </a>
          ))}
          {!initialData.competitionList?.length ? (
            <a href="/competitions" className="oti-league-chip"><span>◈</span><strong>Oti competitions</strong></a>
          ) : null}
        </div>
      </section>

      <section className="container oti-home-board">
        <div className="oti-home-board-head">
          <div>
            <span className="oti-home-kicker">ALL MATCHES</span>
            <h2>Matchday</h2>
          </div>
          <a href="/matches">All matches →</a>
        </div>

        <div className="oti-date-strip" aria-label="Match dates">
          {days.map((day) => (
            <button type="button" key={day.key} className={selectedDay === day.key ? "oti-date active" : "oti-date"} onClick={() => setSelectedDay(day.key)}>
              <b>{day.day}</b>
              <span>{day.date}</span>
            </button>
          ))}
          <label className="oti-date oti-date-picker">
            <b>DATE</b>
            <input type="date" value={selectedDay} onChange={(event) => setSelectedDay(event.target.value)} />
          </label>
        </div>

        <div className="oti-filter-strip" role="tablist" aria-label="Match filters">
          {filters.map((item) => (
            <button type="button" role="tab" aria-selected={filter === item} key={item} className={filter === item ? "oti-filter active" : "oti-filter"} onClick={() => setFilter(item)}>
              {item === "LIVE" ? <i className="oti-live-pip" /> : null}{item}
            </button>
          ))}
        </div>

        <div className="oti-home-grid">
          <div className="oti-home-match-column">
            <HomeLiveData selectedDay={selectedDay} filter={filter} initialData={initialData} />
          </div>
          <aside className="oti-home-sidebar" aria-label="Football information">
            <NewsRail news={initialData.news} />
            <CompetitionRail competitions={initialData.competitionList} />
            <div className="oti-home-card oti-home-brand-card">
              <span className="oti-home-kicker">THE OTI GAME</span>
              <strong>Grassroots football deserves a home.</strong>
              <p>Follow local teams, discover matchdays and stay close to the football that grows here.</p>
              <a href="/teams">Explore teams →</a>
            </div>
          </aside>
        </div>
      </section>

      {initialData.ads?.length ? (
        <section className="container oti-home-sponsor-section" aria-label="Sponsors and advertising">
          <div className="oti-home-section-label">
            <span className="oti-home-kicker">PARTNERS</span>
            <span>Supporting local football</span>
          </div>
          <div className="oti-sponsor-strip">
            {initialData.ads.slice(0, 4).map((ad) => (
              <a key={ad.id} href={ad.target_url || "#"} target={ad.target_url ? "_blank" : undefined} rel={ad.target_url ? "noreferrer" : undefined}>
                {ad.image_url ? <img src={ad.image_url} alt="" loading="lazy" decoding="async" /> : <strong>{ad.name}</strong>}
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
