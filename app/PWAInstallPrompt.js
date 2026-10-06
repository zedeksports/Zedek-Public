"use client";

import { useEffect, useState } from "react";

export default function PWAInstallPrompt() {
  const [installEvent, setInstallEvent] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (event) => {
      event.preventDefault();
      setInstallEvent(event);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      window.navigator.standalone;
    if (standalone) setInstalled(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function handleInstall() {
    if (installEvent) {
      await installEvent.prompt();
      setInstallEvent(null);
      return;
    }
    window.location.href = "/install";
  }

  return (
    <div className="pwa-install-banner" role="region" aria-label="ZEDEK SPORTS app download">
      <div>
        <strong>{installed ? "ZEDEK SPORTS App" : "Download ZEDEK SPORTS"}</strong>
        <span>
          {installed
            ? "App installed. Open the app from your home screen."
            : "Install the local football app for faster access and live updates."}
        </span>
      </div>
      <button className="button" onClick={handleInstall}>
        {installed ? "Install Help" : installEvent ? "Download App" : "Download App"}
      </button>
    </div>
  );
}
