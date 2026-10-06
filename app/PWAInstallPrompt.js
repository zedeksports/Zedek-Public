"use client";

import { useEffect, useState } from "react";

export default function PWAInstallPrompt() {
  const [installEvent, setInstallEvent] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (event) => {
      event.preventDefault();
      setInstallEvent(event);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
      setExpanded(false);
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

  const title = installed ? "ZEDEK SPORTS App" : "Download ZEDEK SPORTS";
  const message = installed
    ? "App installed. Open it from your home screen."
    : "Install for faster access and live updates.";

  return (
    <div
      role="region"
      aria-label="ZEDEK SPORTS app download"
      style={{
        position: "fixed",
        right: "12px",
        bottom: "12px",
        zIndex: 1200,
        width: expanded ? "min(360px, calc(100vw - 24px))" : "auto",
        maxWidth: "calc(100vw - 24px)",
        color: "#fff",
        background: "rgba(7,16,24,.96)",
        border: "1px solid rgba(255,255,255,.14)",
        borderRadius: expanded ? "16px" : "999px",
        boxShadow: "0 12px 34px rgba(0,0,0,.28)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        overflow: "hidden",
      }}
    >
      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-expanded="false"
          style={{
            border: 0,
            background: "transparent",
            color: "#fff",
            cursor: "pointer",
            minHeight: "42px",
            padding: "0 14px",
            display: "flex",
            alignItems: "center",
            gap: "7px",
            fontSize: "11px",
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          <span aria-hidden="true">📲</span>
          <span>Install app</span>
          <span aria-hidden="true" style={{ opacity: 0.65 }}>⌃</span>
        </button>
      ) : (
        <div style={{ padding: "13px 14px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "10px",
            }}
          >
            <div style={{ display: "grid", gap: "4px", minWidth: 0 }}>
              <strong style={{ fontSize: "13px", lineHeight: 1.2 }}>{title}</strong>
              <span style={{ fontSize: "10px", lineHeight: 1.4, color: "rgba(255,255,255,.72)" }}>
                {message}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-label="Collapse app install prompt"
              aria-expanded="true"
              style={{
                flex: "0 0 auto",
                width: "28px",
                height: "28px",
                border: "1px solid rgba(255,255,255,.16)",
                borderRadius: "50%",
                background: "rgba(255,255,255,.07)",
                color: "#fff",
                cursor: "pointer",
                fontSize: "15px",
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          <button
            type="button"
            onClick={handleInstall}
            style={{
              width: "100%",
              minHeight: "40px",
              marginTop: "10px",
              border: 0,
              borderRadius: "10px",
              background: "#d2aa58",
              color: "#101b2b",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: 900,
            }}
          >
            {installed ? "Install Help" : "Download App"}
          </button>
        </div>
      )}
    </div>
  );
}
