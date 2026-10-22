"use client";

import { useEffect, useState } from "react";

export default function InstallPage() {
  const [promptEvent, setPromptEvent] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [device, setDevice] = useState("other");
  const [inAppBrowser, setInAppBrowser] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent || "";
    const isIOS = /iPhone|iPad|iPod/i.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setDevice(isIOS ? "ios" : /Android/i.test(ua) ? "android" : "other");
    setInAppBrowser(/FBAN|FBAV|Instagram|WhatsApp|Line\/|TikTok|Snapchat|LinkedInApp/i.test(ua));

    const onPrompt = (event) => {
      event.preventDefault();
      setPromptEvent(event);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone) {
      setInstalled(true);
    }
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
      <section className="dashboard-card" style={{ maxWidth: 760, margin: "36px auto" }}>
        <span className="section-kicker">ZEDEK SPORTS APP</span>
        <h1>Get ZEDEK SPORTS on your phone</h1>
        <p>
          Add ZEDEK SPORTS to your Home Screen for quick, app-like access. You do not need to download
          a separate APK or use Chrome on every device; the available install option depends on your
          phone and browser.
        </p>

        {installed ? <p><strong>ZEDEK SPORTS appears to be installed on this device.</strong></p> : null}
        {promptEvent && !installed ? (
          <button className="button" onClick={install}>Install ZEDEK SPORTS</button>
        ) : null}

        {!installed ? (
          <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
            {inAppBrowser ? (
              <div className="news-card">
                <div className="news-card-body">
                  <strong>First, open the site in your browser</strong>
                  <p>
                    You appear to be viewing ZEDEK SPORTS inside another app. Open that app's menu
                    and choose <b>Open in browser</b> or <b>Open in Safari</b>, then follow the
                    instructions below. In-app browsers often hide Home Screen installation options.
                  </p>
                </div>
              </div>
            ) : null}

            {(device === "ios" || device === "other") ? (
              <div className="news-card">
                <div className="news-card-body">
                  <strong>iPhone / iPad</strong>
                  <p>
                    Open this page in <b>Safari</b>, tap the <b>Share</b> button, select
                    <b> Add to Home Screen</b>, then tap <b>Add</b>. If you opened the link from
                    WhatsApp or another app, first open it in Safari.
                  </p>
                </div>
              </div>
            ) : null}

            {(device === "android" || device === "other") ? (
              <div className="news-card">
                <div className="news-card-body">
                  <strong>Android phones and tablets</strong>
                  <p>
                    Open the site in your browser and open its menu (usually <b>⋮</b> or <b>☰</b>).
                    Choose <b>Install app</b> or <b>Add to Home screen</b>, then confirm. The wording
                    varies by browser; try your phone's Samsung Internet or Microsoft Edge browser
                    if your current browser does not offer the option.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="news-card">
              <div className="news-card-body">
                <strong>Can't see an install option?</strong>
                <p>
                  Not every browser supports installing web apps. You can still open ZEDEK SPORTS
                  from your browser; for installation, use the steps above in a browser that offers
                  <b> Add to Home Screen</b> or <b>Install app</b>.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <p style={{ marginTop: 20 }}><a href="/">← Back to ZEDEK SPORTS</a></p>
      </section>
    </main>
  );
}
