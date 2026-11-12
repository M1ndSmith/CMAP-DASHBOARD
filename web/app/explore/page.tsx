import { Suspense } from "react";
import {
  CorrelationHeatmap,
  CycleLengthChart,
  RegimeScatter,
  SensorHistogram,
  VarianceChart,
} from "@/components/Charts";
import { PageHeader } from "@/components/Header";
import { api } from "@/lib/api";
import { fleetOf, num } from "@/lib/format";
import type { Eda } from "@/lib/types";

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ fleet?: string }>;
}) {
  const fleet = fleetOf((await searchParams).fleet);
  const eda = await api<Eda>(`/fleets/${fleet}/eda`);

  return (
    <>
      <PageHeader
        kicker="Explore"
        title="What the sensors do"
        detail={`${fleet} · ${eda.scatter.length.toLocaleString("en-US")} regime samples`}
      />
      <section className="split">
        <article className="card">
          <header className="card-head">
            <p className="label-caps">Column spread</p>
            <span className="stamp">
              log10 std · dropped {eda.variances.filter((row) => row.dropped).map((row) => row.column).join(", ") || "none"}
            </span>
          </header>
          <VarianceChart rows={eda.variances} />
        </article>
        <article className="card">
          <header className="card-head">
            <p className="label-caps">Sensor correlation</p>
            <span className="stamp">after regime scaling</span>
          </header>
          <CorrelationHeatmap sensors={eda.correlation.sensors} matrix={eda.correlation.matrix} />
        </article>
      </section>
      <section className="split even">
        <article className="card">
          <header className="card-head">
            <p className="label-caps">Flight regimes</p>
            <span className="stamp">op1 against op2</span>
          </header>
          <RegimeScatter points={eda.scatter} />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Regime</th>
                  <th className="num">Cycles</th>
                  <th className="num">op1</th>
                  <th className="num">op2</th>
                  <th className="num">op3</th>
                </tr>
              </thead>
              <tbody>
                {eda.regimes.map((regime) => (
                  <tr key={regime.id}>
                    <td>{regime.id}</td>
                    <td className="num">{regime.size.toLocaleString("en-US")}</td>
                    {regime.center.map((value, index) => (
                      <td key={index} className="num">
                        {num(value, 2)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
        <article className="card">
          <header className="card-head">
            <p className="label-caps">Run length</p>
            <span className="stamp">
              train mean {num(eda.cycle_length.train.mean, 0)} · test mean {num(eda.cycle_length.test.mean, 0)}
            </span>
          </header>
          <CycleLengthChart title="Train" bins={eda.cycle_length.train.bins} />
          <CycleLengthChart title="Test" bins={eda.cycle_length.test.bins} />
          <Suspense>
            <SensorHistogram histograms={eda.histograms} />
          </Suspense>
        </article>
      </section>
    </>
  );
}
