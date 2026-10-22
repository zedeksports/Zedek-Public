"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Keeps a page's navigational UI state in the URL so refresh, direct links,
 * and browser back/forward restore the same view.
 *
 * validValues is an optional pipe-delimited list, e.g. "overview|squad|matches".
 */
export function usePersistentQueryState(key, defaultValue, validValues = "") {
  const [value, setValue] = useState(defaultValue);
  const allowed = validValues ? validValues.split("|") : null;

  const read = useCallback(() => {
    if (typeof window === "undefined") return defaultValue;
    const candidate = new URL(window.location.href).searchParams.get(key);
    if (candidate == null || candidate === "") return defaultValue;
    if (allowed && !allowed.includes(candidate)) return defaultValue;
    return candidate;
  }, [key, defaultValue, validValues]);

  useEffect(() => {
    const syncFromUrl = () => setValue(read());
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, [read]);

  const update = useCallback((next) => {
    setValue((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      const normalized = allowed && !allowed.includes(resolved) ? defaultValue : resolved;
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        if (normalized === defaultValue || normalized == null || normalized === "") {
          url.searchParams.delete(key);
        } else {
          url.searchParams.set(key, String(normalized));
        }
        const nextUrl = url.pathname + url.search + url.hash;
        const currentUrl = window.location.pathname + window.location.search + window.location.hash;
        if (nextUrl !== currentUrl) window.history.pushState({ ...window.history.state }, "", nextUrl);
      }
      return normalized;
    });
  }, [key, defaultValue, validValues]);

  return [value, update];
}
