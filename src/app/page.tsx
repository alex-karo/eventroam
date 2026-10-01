import { SiteHeader } from "@/components/site-header";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <SiteHeader />
      <p className="mt-8 text-lg text-slate-700">
        The event catalog is being built.
      </p>
    </main>
  );
}
