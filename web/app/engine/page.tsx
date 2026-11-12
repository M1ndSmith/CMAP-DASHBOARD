import { Suspense } from "react";
import { EngineCharts } from "@/components/Charts";
import { SplitUnitSelect } from "@/components/Controls";
import { PageHeader } from "@/components/Header";
import { api } from "@/lib/api";
import { fleetOf } from "@/lib/format";
import type { EngineSeries, FleetPayload } from "@/lib/types";

export default async function EnginePage({
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
  const series = await api<EngineSeries>(`/fleets/${fleet}/engines/${unit}?split=${split}`);
  const current = choices.find((engine) => engine.unit === unit);

  return (
    <>
      <PageHeader
        kicker="Engine"
        title={`${split} unit ${unit}`}
        detail={
          current?.true_rul == null
            ? `${series.cycle.length} cycles recorded`
            : `${series.cycle.length} cycles recorded · ${current.true_rul} cycles remain after the cutoff`
        }
      />
      <Suspense>
        <SplitUnitSelect engines={summary.engines} />
      </Suspense>
      <EngineCharts cycle={series.cycle} ops={series.ops} sensors={series.sensors} regime={series.regime} />
    </>
  );
}
