"use client";
import { useSyncExternalStore } from "react";
import { returnHref, withDiscovery } from "@/site/discovery-context";
const subscribe = () => () => {};
export function BackToResults({ token }: Readonly<{ token: string | null }>) {
  const href = useSyncExternalStore(
    subscribe,
    () => returnHref(token),
    () => withDiscovery("/", token),
  );
  return <a href={href}>Back to results</a>;
}
