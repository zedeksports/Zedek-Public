'use client';

import { useEffect, useState } from "react";

const nav = [
  ["Matches", "/matches"],
  ["Teams", "/teams"],
  ["Competitions", "/competitions"],
  ["Statistics", "/statistics"],
];

export default function PublicShell({ children }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [night, setNight] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("zedek-theme");
    setNight(saved === "night");
    document.documentElement.dataset.zedekTheme = saved === "night" ? "night" : "day";
  }, []);

  function toggleTheme() {
    const next = !night;
    setNight(next);
    localStorage.setItem("zedek-theme", next ? "night" : "day");
    document.documentElement.dataset.zedekTheme = next ? "night" : "day";
  }

  return (
    <>
      <header className="site-header zedek-score-header public-global-header">
        <div className="container nav">
          <a className="brand" href="/" aria-label="Zedek Sports home">
            <span className="brand-mark">Z</span>
            <span>ZEDEK <b>SPORTS</b></span>
          </a>
          <nav className="nav-links" aria-label="Main navigation">
            {nav.map(([label, href]) => <a key={href} href={href}>{label}</a>)}
          </nav>
          <div className="header-actions">
            <button className="icon-button" onClick={() => setSearchOpen(x => !x)} aria-label="Search Zedek Sports" title="Search">⌕</button>
            <button className="theme-button" onClick={toggleTheme} aria-label="Toggle day and night mode">{night ? "☀" : "☾"}</button>
          </div>
        </div>
      </header>
      <div className={searchOpen ? "quick-search open" : "quick-search"}>
        <form className="container quick-search-inner" action="/search" method="get">
          <span>⌕</span>
          <input name="q" placeholder="Search teams, players, competitions or matches…" aria-label="Quick search" />
          <button type="submit">Search</button>
          <a href="/search">Full search →</a>
        </form>
      </div>
      {children}
      <footer className="site-footer public-global-footer">
        <div className="container footer-inner">
          <div>
            <div className="brand footer-brand"><span className="brand-mark">Z</span><span>ZEDEK <b>SPORTS</b></span></div>
            <p>Local football. Properly followed.</p>
          </div>
          <div className="footer-links">{nav.map(([label, href]) => <a key={href} href={href}>{label}</a>)}</div>
        </div>
      </footer>
    </>
  );
}
