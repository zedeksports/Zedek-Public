'use client';

import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

function playAlertSound() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.48);
    osc.onended = () => ctx.close().catch(() => {});
  } catch {}
}

async function enableAlerts() {
  localStorage.setItem("zedek-alert-sound", "enabled");
  playAlertSound();
  if ("Notification" in window && Notification.permission === "default") {
    try { await Notification.requestPermission(); } catch {}
  }
}

export default function LiveNotificationAlerts({ onUnreadChange }) {
  const [user, setUser] = useState(null);
  const [notification, setNotification] = useState(null);
  const [permission, setPermission] = useState(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported"
  );
  const [soundEnabled, setSoundEnabled] = useState(
    typeof window !== "undefined" && localStorage.getItem("zedek-alert-sound") === "enabled"
  );
  const timerRef = useRef(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let mounted = true;
    let channel;

    async function start() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted || !session) return;
      setUser(session.user);

      const unread = await supabase.from("user_notifications").select("id", { count: "exact", head: true }).is("read_at", null);
      if (mounted) onUnreadChange?.(unread.count || 0);

      channel = supabase
        .channel("zedek-public-notifications-" + session.user.id)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "user_notifications", filter: "user_id=eq." + session.user.id },
          ({ new: row }) => {
            if (!mounted) return;
            setNotification(row);
            window.clearTimeout(timerRef.current);
            timerRef.current = window.setTimeout(() => setNotification(null), 7000);
            onUnreadChange?.((unread.count || 0) + 1);

            if (localStorage.getItem("zedek-alert-sound") === "enabled") playAlertSound();
            if ("Notification" in window && Notification.permission === "granted") {
              try {
                new Notification(row.title || "ZEDEK SPORTS", {
                  body: row.body || "New football update",
                  tag: row.id,
                  icon: "/icon-192.png"
                });
              } catch {}
            }
          }
        )
        .subscribe();
    }

    start();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (!session) onUnreadChange?.(0);
    });

    return () => {
      mounted = false;
      window.clearTimeout(timerRef.current);
      authListener.subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, [onUnreadChange]);

  if (!user || !notification) return null;

  const isGoal = notification.notification_type === "goal";

  async function turnOnAlerts() {
    await enableAlerts();
    setSoundEnabled(true);
    if ("Notification" in window) setPermission(Notification.permission);
  }

  return (
    <div
      role="status"
      aria-live="assertive"
      style={{
        position: "fixed", right: 16, bottom: 16, zIndex: 9999, width: "min(390px, calc(100vw - 32px))",
        borderRadius: 18, padding: 16, background: "var(--ink, #111)", color: "var(--cream-2, #fff)",
        boxShadow: "0 18px 50px rgba(0,0,0,.28)", border: "1px solid rgba(255,255,255,.14)"
      }}
    >
      <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
        <div style={{fontSize:26,lineHeight:1}}>{isGoal ? "⚽" : "🔔"}</div>
        <div style={{flex:1}}>
          <strong style={{display:"block",fontSize:15,marginBottom:4}}>{isGoal ? "GOAL!" : notification.title}</strong>
          <span style={{display:"block",fontSize:13,lineHeight:1.45,opacity:.88}}>{notification.body}</span>
        </div>
        <button onClick={()=>setNotification(null)} aria-label="Close notification" style={{border:0,background:"transparent",color:"inherit",fontSize:20,cursor:"pointer"}}>×</button>
      </div>
      {!soundEnabled && (
        <button onClick={turnOnAlerts} style={{marginTop:12,width:"100%",border:0,borderRadius:10,padding:"10px 12px",fontWeight:800,cursor:"pointer"}}>
          🔊 Enable goal sounds & alerts
        </button>
      )}
      {permission === "denied" && (
        <small style={{display:"block",marginTop:8,opacity:.65}}>Browser notifications are blocked. In-app alerts still work.</small>
      )}
    </div>
  );
}
