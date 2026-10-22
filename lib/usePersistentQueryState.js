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

  const isAllowed = useCallback(
    (candidate) => !validValues || validValues.split("|").includes(candidate),
    [validValues]
  );

  const read = useCallback(() => {
    if (typeof window === "undefined") return defaultValue;
    const candidate = new URL(window.location.href).searchParams.get(key);
    if (candidate == null || candidate === "" || !isAllowed(candidate)) return defaultValue;
    return candidate;
  }, [key, defaultValue, isAllowed]);

  useEffect(() => {
    const syncFromUrl = () => setValue(read());
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, [read]);

  const update = useCallback((next) => {
    const resolved = typeof next === "function" ? next(value) : next;
    const normalized = resolved == null || resolved === "" || !isAllowed(resolved)
      ? defaultValue
      : resolved;

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (normalized === defaultValue) {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, String(normalized));
      }
      const nextUrl = url.pathname + url.search + url.hash;
      const currentUrl = window.location.pathname + window.location.search + window.location.hash;
      if (nextUrl !== currentUrl) window.history.pushState({ ...window.history.state }, "", nextUrl);
    }

    setValue(normalized);
  }, [key, defaultValue, isAllowed, value]);

  return [value, update];
}
