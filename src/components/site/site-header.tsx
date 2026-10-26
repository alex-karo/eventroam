import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="discovery-header">
      <Link
        className="discovery-brand"
        href="/"
        aria-label="Eventroam festivals"
      >
        Eventroam<span aria-hidden="true">.</span>
      </Link>
      <span className="discovery-scope">Festivals</span>
    </header>
  );
}
