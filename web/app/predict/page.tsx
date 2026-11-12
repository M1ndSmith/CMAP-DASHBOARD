import { Suspense } from "react";
import { PredictScatter } from "@/components/Charts";
import { UnitSelect } from "@/components/Controls";
import { PageHeader } from "@/components/Header";
import { api } from "@/lib/api";
import { fleetOf, num } from "@/lib/format";
import type { Predictions } from "@/lib/types";

export default async function PredictPage({
  searchParams,
}: {
  searchParams: Promise<{ fleet?: string; unit?: string }>;
}) {
  const sp = await searchParams;
  const fleet = fleetOf(sp.fleet);
  const predictions = await api<Predictions>(`/fleets/${fleet}/predictions`);
  const units = predictions.hgb.map((row) => row.unit);
  const requested = Number(sp.unit ?? units[0] ?? 1);
  const unit = units.includes(requested) ? requested : units[0];
  const row = predictions.hgb.find((item) => item.unit === unit) ?? predictions.hgb[0];
  const ridge = predictions.ridge.find((item) => item.unit === row.unit);

  return (
    <>
      <PageHeader
        kicker="Predict"
        title={`Test unit ${row.unit}`}
        detail="Boosted model · band is the 10th to 90th percentile fit"
      />
      <Suspense>
        <UnitSelect units={units} />
      </Suspense>
      <section className="metrics">
        <article className="card">
          <header className="card-head">
            <p className="label-caps">Predicted cycles</p>
          </header>
          <p className="metric-xl">{num(row.pred, 1)}</p>
          <p className="quiet">
            band {num(row.lo ?? row.pred, 1)} – {num(row.hi ?? row.pred, 1)}
          </p>
        </article>
        <article className="card">
          <header className="card-head">
            <p className="label-caps">True remaining</p>
          </header>
          <p className="metric-xl">{num(row.true_rul, 0)}</p>
        </article>
        <article className="card">
          <header className="card-head">
            <p className="label-caps">Error</p>
            <span className="stamp">predicted − true</span>
          </header>
          <p className={`metric-xl ${row.call === "on time" ? "ontime" : row.call}`}>{num(row.error, 1)}</p>
        </article>
        <article className="card">
          <header className="card-head">
            <p className="label-caps">Call</p>
          </header>
          <span className={`pill ${row.call === "on time" ? "ontime" : row.call} static`}>
            <span className={`led ${row.call === "on time" ? "ontime" : row.call}`} />
            {row.call}
          </span>
          <p className="quiet">Ridge {ridge ? num(ridge.pred, 1) : "—"}</p>
        </article>
      </section>
      <section className="split">
        <article className="card">
          <header className="card-head">
            <p className="label-caps">Predicted against true</p>
            <span className="stamp">amber early · coral late · cyan this engine</span>
          </header>
          <PredictScatter rows={predictions.hgb} selected={row.unit} />
        </article>
        <article className="card">
          <header className="card-head">
            <p className="label-caps">Test engines</p>
          </header>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Unit</th>
                  <th className="num">True</th>
                  <th className="num">Pred</th>
                  <th className="num">Error</th>
                  <th>Call</th>
                </tr>
              </thead>
              <tbody>
                {predictions.hgb.map((item) => (
                  <tr key={item.unit} className={item.unit === row.unit ? "selected" : undefined}>
                    <td>{item.unit}</td>
                    <td className="num">{num(item.true_rul, 0)}</td>
                    <td className="num">{num(item.pred, 1)}</td>
                    <td className="num">{num(item.error, 1)}</td>
                    <td>{item.call}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </>
  );
}
