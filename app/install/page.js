"use client";

import { useEffect, useState } from "react";

export default function InstallPage() {
  const [promptEvent, setPromptEvent] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (event) => { event.preventDefault(); setPromptEvent(event); };
    const onInstalled = () => { setInstalled(true); setPromptEvent(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone) setInstalled(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    setPromptEvent(null);
  }

  return (
    <main className="container section">
      <section className="dashboard-card" style={{maxWidth:760,margin:"36px auto"}}>
        <span className="section-kicker">ZEDEK SPORTS APP</span>
        <h1>Install ZEDEK SPORTS</h1>
        <p>Install ZEDEK SPORTS on your phone for a fast app-like football experience, without downloading from an app store.</p>
        {installed ? <p><strong>ZEDEK SPORTS is already installed on this device.</strong></p> : null}
        {promptEvent ? <button className="button" onClick={install}>Install ZEDEK SPORTS</button> : null}
        {!promptEvent && !installed ? <div style={{display:"grid",gap:12,marginTop:20}}>
          <div className="news-card"><div className="news-card-body"><strong>Android / Chrome</strong><p>Open ZEDEK SPORTS in Chrome, then choose <b>Install app</b> or <b>Add to Home screen</b> from the browser menu.</p></div></div>
          <div className="news-card"><div className="news-card-body"><strong>iPhone / iPad</strong><p>Open ZEDEK SPORTS in Safari, tap <b>Share</b>, then choose <b>Add to Home Screen</b>.</p></div></div>
        </div> : null}
        <p style={{marginTop:20}}><a href="/">← Back to ZEDEK SPORTS</a></p>
      </section>
    </main>
  );
}
