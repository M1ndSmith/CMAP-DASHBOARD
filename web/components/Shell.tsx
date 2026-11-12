"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const NAV = [
  { href: "/", label: "Fleet" },
  { href: "/explore", label: "Explore" },
  { href: "/engine", label: "Engine" },
  { href: "/health", label: "Health" },
  { href: "/predict", label: "Predict" },
  { href: "/scores", label: "Scores" },
  { href: "/tuning", label: "Tuning" },
];

const FLEETS = ["FD001", "FD002", "FD003", "FD004"];

function ShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const fleet = params.get("fleet") ?? "FD001";

  function hrefFor(path: string) {
    const next = new URLSearchParams(params.toString());
    if (!next.get("fleet")) next.set("fleet", "FD001");
    return `${path}?${next.toString()}`;
  }

  function chooseFleet(id: string) {
    const next = new URLSearchParams(params.toString());
    next.set("fleet", id);
    next.set("unit", "1");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="led live" aria-hidden />
          <div>
            <strong>NEXUSML</strong>
            <span>C-MAPSS remaining life</span>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={hrefFor(item.href)} className={active ? "active" : undefined}>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="fleet-block">
          <p className="label-caps">Fleet</p>
          <div className="pills">
            {FLEETS.map((id) => (
              <button
                key={id}
                type="button"
                className={id === fleet ? "pill active" : "pill"}
                aria-pressed={id === fleet}
                onClick={() => chooseFleet(id)}
              >
                <span className={id === fleet ? "led live" : "led"} aria-hidden />
                {id}
              </button>
            ))}
          </div>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="shell"><main className="main">Loading</main></div>}>
      <ShellInner>{children}</ShellInner>
    </Suspense>
  );
}
