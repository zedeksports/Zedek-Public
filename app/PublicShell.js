'use client';

import { useEffect, useState } from "react";

const primaryNav = [
  ["Matches", "/matches"],
  ["Live", "/matches?filter=live"],
];

const exploreNav = [
  ["Competitions", "/competitions"],
  ["Teams", "/teams"],
  ["Standings", "/standings"],
  ["Top Scorers", "/statistics?view=scorers"],
  ["Player Stats", "/statistics?view=players"],
  ["Search", "/search"],
];

export default function PublicShell({ children }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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

  function closeLayers() {
    setMenuOpen(false);
    setSearchOpen(false);
  }

  return (
    <>
      <header className="site-header zedek-score-header public-global-header">
        <div className="container nav">
          <a className="brand brand-primary" href="/" aria-label="Zedek Sports home" onClick={closeLayers}>
            <span className="brand-mark">Z</span>
            <span>ZEDEK <b>SPORTS</b></span>
          </a>

          <nav className="nav-links primary-nav" aria-label="Primary football navigation">
            {primaryNav.map(([label, href]) => <a key={href} href={href}>{label}</a>)}
          </nav>

          <div className="header-actions">
            <button className="icon-button menu-button" onClick={() => setMenuOpen(x => !x)} aria-expanded={menuOpen} aria-label="Open football menu" title="Menu">☰</button>
            <button className="icon-button search-button" onClick={() => setSearchOpen(x => !x)} aria-label="Search Zedek Sports" title="Search">⌕</button>
            <button className="theme-button" onClick={toggleTheme} aria-label="Toggle day and night mode">{night ? "☀" : "☾"}</button>
          </div>
        </div>
      </header>

      <aside className={menuOpen ? "zedek-drawer open" : "zedek-drawer"} aria-hidden={!menuOpen}>
        <div className="zedek-drawer-head">
          <div><span className="drawer-kicker">ZEDEK SPORTS</span><strong>Football hub</strong></div>
          <button className="drawer-close" onClick={() => setMenuOpen(false)} aria-label="Close menu">×</button>
        </div>
        <div className="drawer-primary">
          {primaryNav.map(([label, href]) => <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}<span>→</span></a>)}
        </div>
        <div className="drawer-section">
          <span className="drawer-kicker">EXPLORE</span>
          {exploreNav.map(([label, href]) => <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}<span>↗</span></a>)}
        </div>
        <div className="drawer-note">Competitions contain their seasons, standings, scorers and player statistics. Team pages contain squads and player profiles.</div>
      </aside>
      {menuOpen && <button className="zedek-drawer-backdrop" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}

      <div className={searchOpen ? "quick-search open" : "quick-search"}>
        <form className="container quick-search-inner" action="/search" method="get">
          <span>⌕</span>
          <input name="q" placeholder="Search teams, players, competitions or matches…" aria-label="Quick search" />
          <button type="submit">Search</button>
          <a href="/search" onClick={() => setSearchOpen(false)}>Full search →</a>
        </form>
      </div>

      {children}

      <footer className="site-footer public-global-footer">
        <div className="container footer-inner">
          <div>
            <div className="brand footer-brand"><span className="brand-mark">Z</span><span>ZEDEK <b>SPORTS</b></span></div>
            <p>Local football. Properly followed.</p>
          </div>
          <div className="footer-links">
            <a href="/matches">Matches</a><a href="/matches?filter=live">Live</a><a href="/competitions">Football Hub</a>
          </div>
        </div>
      </footer>
    </>
  );
}
