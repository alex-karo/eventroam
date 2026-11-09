"use client";

import type { ReactNode } from "react";
import posthog from "posthog-js";

type Props = {
  className: string;
  href: string;
  children: ReactNode;
} & (
  | { destination: "linkedin"; placement: "hero" | "footer" }
  | { destination: "festivals"; placement: "example" }
);

export function PromoLink({
  className,
  href,
  children,
  destination,
  placement,
}: Readonly<Props>) {
  return (
    <a
      className={className}
      href={href}
      target={destination === "linkedin" ? "_blank" : undefined}
      rel={destination === "linkedin" ? "noopener noreferrer" : undefined}
      onClick={() =>
        posthog.capture("promo_link_clicked", {
          destination,
          placement,
        })
      }
    >
      {children}
    </a>
  );
}
