import { Suspense } from "react";
import { HealthChart } from "@/components/Charts";
import { SplitUnitSelect } from "@/components/Controls";
import { PageHeader } from "@/components/Header";
import { api } from "@/lib/api";
import { fleetOf, num } from "@/lib/format";
import type { FleetPayload, HealthSeries } from "@/lib/types";

export default async function HealthPage({
  searchParams,
}: {
  searchParams: Promise<{ fleet?: string; unit?: string; split?: string }>;
}) {
  const sp = await searchParams;
  const fleet = fleetOf(sp.fleet);
  const summary = await api<FleetPayload>(`/fleets/${fleet}/engines`);
  const split = sp.split === "test" ? "test" : "train";
  const choices = summary.engines.filter((engine) => engine.split === split);
  const requested = Number(sp.unit ?? choices[0]?.unit ?? 1);
  const unit = choices.some((engine) => engine.unit === requested) ? requested : (choices[0]?.unit ?? 1);
  const series = await api<HealthSeries>(`/fleets/${fleet}/health/${unit}?split=${split}`);
  const latest = series.health[series.health.length - 1] ?? 0;
  const start = series.health[0] ?? 0;

  return (
    <>
      <PageHeader
        kicker="Health"
        title={`${split} unit ${unit}`}
        detail="1 is early life · 0 is the training failure level"
      />
      <Suspense>
        <SplitUnitSelect engines={summary.engines} />
      </Suspense>
      <section className="metrics">
        <article className="card">
          <header className="card-head">
            <p className="label-caps">At first cycle</p>
          </header>
          <p className="metric-xl">{num(start, 2)}</p>
        </article>
        <article className="card">
          <header className="card-head">
            <p className="label-caps">At last cycle</p>
          </header>
          <p className="metric-xl">{num(latest, 2)}</p>
        </article>
      </section>
      <article className="card">
        <header className="card-head">
          <p className="label-caps">Degradation curve</p>
          <span className="stamp">first principal component</span>
        </header>
        <HealthChart cycle={series.cycle} health={series.health} />
      </article>
    </>
  );
}
