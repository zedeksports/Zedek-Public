'use client';

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

const notificationSelect = "*,matches(id,home_score,away_score,home_team:teams!matches_home_team_id_fkey(name),away_team:teams!matches_away_team_id_fkey(name))";

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let channel;
    let mounted = true;
    const supabase = createSupabaseBrowserClient();

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = "/login";
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("user_notifications")
        .select(notificationSelect)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!mounted) return;

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setItems(data || []);
      }
      setLoading(false);

      channel = supabase
        .channel("zedek-notification-page-" + session.user.id)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "user_notifications",
            filter: "user_id=eq." + session.user.id
          },
          async (payload) => {
            if (!mounted) return;

            // Re-fetch the inserted row with the same joins used by the
            // initial list so realtime items have the same complete shape.
            const { data: freshNotification, error: refreshError } = await supabase
              .from("user_notifications")
              .select(notificationSelect)
              .eq("id", payload.new.id)
              .maybeSingle();

            if (!mounted) return;

            if (refreshError || !freshNotification) {
              setItems(current => [payload.new, ...current].slice(0, 100));
              return;
            }

            setItems(current => {
              const withoutDuplicate = current.filter(item => item.id !== freshNotification.id);
              return [freshNotification, ...withoutDuplicate].slice(0, 100);
            });
          }
        )
        .subscribe();
    })();

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  async function markAll() {
    const supabase = createSupabaseBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase
      .from("user_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", session.user.id)
      .is("read_at", null);

    if (!error) {
      setItems(current =>
        current.map(item => ({
          ...item,
          read_at: item.read_at || new Date().toISOString()
        }))
      );
    }
  }

  async function mark(id) {
    const supabase = createSupabaseBrowserClient();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("user_notifications")
      .update({ read_at: now })
      .eq("id", id);

    if (!error) {
      setItems(current =>
        current.map(item => item.id === id ? { ...item, read_at: now } : item)
      );
    }
  }

  return (
    <main className="page settings-page">
      <div className="container">
        <div className="page-hero">
          <span className="section-kicker">PERSONALISED FEED</span>
          <h1>Notifications</h1>
          <p>Important updates from the teams and matches you follow.</p>
        </div>

        <div className="notification-toolbar">
          <a href="/settings">Notification settings →</a>
          <button className="button" onClick={markAll}>Mark all read</button>
        </div>

        {error ? <div className="account-error">{error}</div> : null}

        {loading ? (
          <div className="empty-state">Loading notifications…</div>
        ) : items.length ? (
          <div className="notification-list">
            {items.map(x => (
              <button
                className={x.read_at ? "notification-row read" : "notification-row"}
                key={x.id}
                onClick={() => mark(x.id)}
              >
                <span className="notification-icon">●</span>
                <span>
                  <b>{x.title}</b>
                  <small>{x.body}</small>
                  <time>
                    {new Intl.DateTimeFormat("en-GH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Africa/Accra"
                    }).format(new Date(x.created_at))}
                  </time>
                </span>
                <i>{x.read_at ? "" : "NEW"}</i>
              </button>
            ))}
          </div>
        ) : (
          <div className="settings-card empty-state">
            <strong>No notifications yet.</strong>
            <span>Follow a team or match and we'll keep this space ready for important football updates.</span>
          </div>
        )}
      </div>
    </main>
  );
}
