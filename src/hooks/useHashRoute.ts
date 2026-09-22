import { useEffect, useState } from "react";

export const ROUTES = ["mission-control", "overview", "collision-physics", "collision-lab", "test-log", "upload"] as const;
export type Route = (typeof ROUTES)[number];

export const isRoute = (v: string): v is Route => (ROUTES as readonly string[]).includes(v);

function readHash(): Route {
  const raw = window.location.hash.replace(/^#\/?/, "").split("?")[0].toLowerCase();
  if (isRoute(raw)) return raw;
  // also accept human paths like #/log
  if (raw === "control" || raw === "mission" || raw === "3d") return "mission-control";
  if (raw === "physics" || raw === "sim" || raw === "2d") return "collision-physics";
  if (raw === "log") return "test-log";
  if (raw === "lab") return "collision-lab";
  return "mission-control";
}

export function useHashRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(readHash);

  useEffect(() => {
    const onHash = () => setRoute(readHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigate = (r: Route) => {
    window.location.hash = `/${r}`;
    setRoute(r);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return [route, navigate];
}
