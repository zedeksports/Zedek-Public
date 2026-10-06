'use client';

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

const VISITOR_KEY = "zedek_analytics_visitor_id";
const CHANNEL = "zedek-public-audience";

function getVisitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

export default function SitePresenceTracker() {
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const visitorId = getVisitorId();
    const channel = supabase.channel(CHANNEL, {
      config: { presence: { key: visitorId } }
    });

    let mounted = true;

    channel.subscribe(async (status) => {
      if (status !== "SUBSCRIBED" || !mounted) return;
      await channel.track({ online: true });
    });

    return () => {
      mounted = false;
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
