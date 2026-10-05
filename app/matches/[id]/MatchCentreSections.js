'use client';

import { useEffect, useId, useState } from "react";

function Chevron({ open }) {
  return <span className={"mc-accordion-chevron" + (open ? " open" : "")} aria-hidden="true">⌄</span>;
}

export function CollapsibleSection({ title, eyebrow, children, defaultOpen = false, className = "" }) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <section className={"mc-accordion-section " + (open ? "is-open " : "") + className}>
      <button
        type="button"
        className="mc-accordion-trigger"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen(value => !value)}
      >
        <span className="mc-accordion-title">
          {eyebrow ? <small>{eyebrow}</small> : null}
          <strong>{title}</strong>
        </span>
        <Chevron open={open} />
      </button>
      <div id={contentId} className="mc-accordion-body" aria-hidden={!open}>
        <div className="mc-accordion-body-inner">{open ? children : null}</div>
      </div>
    </section>
  );
}

export function FormIndicator({ value }) {
  const normalized = ["W", "D", "L"].includes(String(value || "").toUpperCase())
    ? String(value).toUpperCase()
    : "?";
  return <span className={"mc-form-indicator " + normalized.toLowerCase()} title={normalized === "W" ? "Win" : normalized === "D" ? "Draw" : normalized === "L" ? "Loss" : "Unknown"}>{normalized}</span>;
}

export function FormTeamCard({ team, rank, results }) {
  const image = team?.flag_url || team?.country_flag_url || team?.logo_url || "";
  const name = team?.name || team?.short_name || "Team TBC";
  const form = Array.from({ length: 6 }, (_, index) => results?.[index] || "?");

  return (
    <article className="mc-form-team-card">
      <div className="mc-form-team-top">
        <span className="mc-form-rank">{rank}.</span>
        <div className="mc-form-team-identity">
          <div className="mc-form-team-image">
            {image ? <img src={image} alt="" /> : <span>{name.slice(0, 2).toUpperCase()}</span>}
          </div>
          <strong title={name}>{name}</strong>
        </div>
      </div>
      <div className="mc-form-results" aria-label={name + " recent form"}>
        {form.map((value, index) => <FormIndicator key={index} value={value} />)}
      </div>
    </article>
  );
}

export function FormSection({ teams = [], defaultOpen = true }) {
  return (
    <CollapsibleSection title="FORM" eyebrow="RECENT TEAM FORM" defaultOpen={defaultOpen} className="mc-form-section">
      <div className="mc-form-grid">
        {teams.map((team, index) => (
          <FormTeamCard key={team?.id || team?.team_id || index} team={team} rank={team?.rank || index + 1} results={team?.results || []} />
        ))}
      </div>
      <div className="mc-form-legend" aria-label="Form legend">
        <span><FormIndicator value="W" /> Win</span>
        <span><FormIndicator value="D" /> Draw</span>
        <span><FormIndicator value="L" /> Loss</span>
        <span><FormIndicator value="?" /> Unknown</span>
      </div>
    </CollapsibleSection>
  );
}

function countdownText(target) {
  const ms = new Date(target).getTime() - Date.now();
  if (!Number.isFinite(ms)) return "";
  if (ms <= 0) return "Kick-off is due";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return "Kicks off in " + days + "d " + hours + "h";
  if (hours > 0) return "Kicks off in " + hours + "h " + minutes + "m";
  return "Kicks off in " + Math.max(1, minutes) + "m";
}

export function MatchSummaryCard({ match, venue }) {
  const [countdown, setCountdown] = useState("");
  useEffect(() => {
    const update = () => setCountdown(countdownText(match?.scheduled_at));
    update();
    const timer = setInterval(update, 30000);
    return () => clearInterval(timer);
  }, [match?.scheduled_at]);

  const home = match?.home_team;
  const away = match?.away_team;
  const date = match?.scheduled_at ? new Date(match.scheduled_at) : null;
  const dateLabel = date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()
    : "DATE TBC";
  const timeLabel = date && !Number.isNaN(date.getTime())
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
    : "TIME TBC";

  return (
    <section className="mc-summary-card">
      <div className="mc-summary-kicker">PRE-MATCH</div>
      <div className="mc-summary-title-row">
        <div>
          <small>{match?.season?.competition?.name || "Competition"}</small>
          <h2>Match Summary</h2>
        </div>
        <span className="mc-summary-status">UPCOMING</span>
      </div>
      <div className="mc-summary-teams">
        <div className="mc-summary-team">
          <div className="mc-summary-logo">{home?.logo_url ? <img src={home.logo_url} alt="" /> : <span>{(home?.name || "HT").slice(0, 2).toUpperCase()}</span>}</div>
          <strong>{home?.name || "Home Team"}</strong>
          <small>HOME</small>
        </div>
        <div className="mc-summary-vs"><span>VS</span><b>{timeLabel}</b><small>{dateLabel}</small></div>
        <div className="mc-summary-team">
          <div className="mc-summary-logo">{away?.logo_url ? <img src={away.logo_url} alt="" /> : <span>{(away?.name || "AT").slice(0, 2).toUpperCase()}</span>}</div>
          <strong>{away?.name || "Away Team"}</strong>
          <small>AWAY</small>
        </div>
      </div>
      <div className="mc-summary-meta">
        <div><span>VENUE</span><strong>{venue || "Venue TBC"}</strong></div>
        <div><span>DATE</span><strong>{dateLabel}</strong></div>
        <div><span>KICK-OFF</span><strong>{timeLabel}</strong></div>
        {countdown ? <div><span>COUNTDOWN</span><strong>{countdown}</strong></div> : null}
      </div>
    </section>
  );
}

export function H2HPreview({ matches = [], match }) {
  if (!matches.length) return <div className="mc-empty-inline">No previous verified meetings are available.</div>;
  const homeId = match?.home_team?.id;
  const homeName = match?.home_team?.name || "Home";
  const awayName = match?.away_team?.name || "Away";

  return (
    <div className="mc-h2h-preview">
      {matches.map(item => {
        const hs = Number(item.home_score ?? 0);
        const as = Number(item.away_score ?? 0);
        const draw = hs === as;
        const homeWon = hs > as;
        const homeMark = draw ? "D" : ((item.home_team?.id === homeId && homeWon) || (item.away_team?.id === homeId && !homeWon)) ? "W" : "L";
        const date = item.scheduled_at ? new Date(item.scheduled_at) : null;
        const dateLabel = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString(undefined, { day: "2-digit", month: "short" }) : "—";
        return (
          <a href={"/matches/" + item.id} className="mc-h2h-preview-row" key={item.id}>
            <span>{dateLabel}</span>
            <strong>{item.home_team?.short_name || item.home_team?.name || homeName}</strong>
            <b>{hs}:{as}</b>
            <strong>{item.away_team?.short_name || item.away_team?.name || awayName}</strong>
            <i className={homeMark.toLowerCase()}>{homeMark}</i>
          </a>
        );
      })}
    </div>
  );
}
