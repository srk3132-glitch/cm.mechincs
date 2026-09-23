import { startTransition, useCallback, useEffect, useState } from "react";

export const ROUTES = [
  "mission-control",
  "overview",
  "compare-runs",
  "settings",
  "collision-physics",
  "collision-lab",
  "test-log",
  "upload",
] as const;

export type Route = (typeof ROUTES)[number];

export const isRoute = (v: string): v is Route => (ROUTES as readonly string[]).includes(v);

function readHash(): Route {
  const raw = window.location.hash.replace(/^#\/?/, "").split("?")[0].toLowerCase();
  if (isRoute(raw)) return raw;
  if (raw === "control" || raw === "mission" || raw === "3d") return "mission-control";
  if (raw === "physics" || raw === "sim" || raw === "2d") return "collision-physics";
  if (raw === "log") return "test-log";
  if (raw === "lab") return "collision-lab";
  if (raw === "compare" || raw === "compare-runs") return "compare-runs";
  if (raw === "settings" || raw === "prefs") return "settings";
  return "overview";
}

export function useHashRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(readHash);

  useEffect(() => {
    const onHash = () => setRoute(readHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigate = useCallback((r: Route) => {
    if (r === route) return;

    window.location.hash = `/${r}`;
    startTransition(() => {
      setRoute(r);
    });

    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  }, [route]);

  return [route, navigate];
}
