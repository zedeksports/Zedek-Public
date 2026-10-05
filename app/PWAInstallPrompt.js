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
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone;
    if (standalone) setInstalled(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || !installEvent) return null;

  return (
    <div className="pwa-install-banner" role="region" aria-label="Install ZEDEK SPORTS">
      <div>
        <strong>Install ZEDEK SPORTS</strong>
        <span>Get the local football app on your phone for faster access.</span>
      </div>
      <button className="button" onClick={async () => { await installEvent.prompt(); setInstallEvent(null); }}>Install</button>
    </div>
  );
}
