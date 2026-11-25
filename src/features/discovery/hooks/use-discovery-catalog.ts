import { useCallback, useEffect, useRef, useState } from "react";
import type { DiscoverySummary, Genre } from "@/catalog/read/contracts";

export type DiscoveryCatalog = {
  summaries: DiscoverySummary[];
  genres: Genre[];
};

export function useDiscoveryCatalog(initialCatalog: DiscoveryCatalog) {
  const [catalog, setCatalog] = useState(initialCatalog);
  const [loadError, setLoadError] = useState(false);
  const latest = useRef(0);
  const load = useCallback(() => {
    const request = ++latest.current;
    return fetch("/api/discovery", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Discovery is unavailable.");
        }
        return response.json() as Promise<DiscoveryCatalog>;
      })
      .then((next) => {
        if (request !== latest.current) {
          return;
        }
        setCatalog(next);
        setLoadError(false);
      })
      .catch(() => {
        if (request === latest.current) {
          setLoadError(true);
        }
      });
  }, []);
  useEffect(() => {
    const catalogRequests = latest;
    void load();
    return () => {
      ++catalogRequests.current;
    };
  }, [load]);
  return { catalog, loadError, retry: load };
}
