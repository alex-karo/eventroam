"use client";

import type { ReactNode } from "react";
import posthog from "posthog-js";

type Props = {
  className: string;
  href: string;
  children: ReactNode;
} & (
  | { destination: "email"; placement: "hero" | "footer" }
  | { destination: "festivals"; placement: "example" }
);

export function PromoLink({
  className,
  href,
  children,
  destination,
  placement,
}: Readonly<Props>) {
  const opensInNewTab = destination === "festivals";

  return (
    <a
      className={className}
      href={href}
      target={opensInNewTab ? "_blank" : undefined}
      rel={opensInNewTab ? "noopener noreferrer" : undefined}
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
