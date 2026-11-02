import type { Metadata } from "next";
import "@/app/globals.css";
import { AnalyticsBanner } from "@/site/analytics-banner";

export const metadata: Metadata = {
  title: "Eventroam",
  description: "Discover events around the world.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <AnalyticsBanner />
      </body>
    </html>
  );
}
