import { ErrorBars, MetricBars } from "@/components/Charts";
import { PageHeader } from "@/components/Header";
import { api } from "@/lib/api";
import { FLEETS, fleetOf, num } from "@/lib/format";
import type { Metrics, Predictions } from "@/lib/types";

export default async function ScoresPage({
  searchParams,
}: {
  searchParams: Promise<{ fleet?: string }>;
}) {
  const fleet = fleetOf((await searchParams).fleet);
  const [metrics, predictions] = await Promise.all([
    Promise.all(FLEETS.map((id) => api<Metrics>(`/fleets/${id}/metrics`))),
    api<Predictions>(`/fleets/${fleet}/predictions`),
  ]);
  const bars = metrics.map((row) => ({
    fleet: row.fleet,
    ridge: row.ridge.rmse,
    hgb: row.hgb.rmse,
  }));
  const phm = metrics.map((row) => ({
    fleet: row.fleet,
    ridge: row.ridge.phm,
    hgb: row.hgb.phm,
  }));

  return (
    <>
      <PageHeader
        kicker="Scores"
        title="Held-out test engines"
        detail="Late calls add exp(d/10) − 1 · early calls add exp(−d/13) − 1"
      />
      <article className="card">
        <header className="card-head">
          <p className="label-caps">Ridge against boosting</p>
          <span className="stamp">one row per test engine, last window</span>
        </header>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fleet</th>
                <th className="num">Ridge RMSE</th>
                <th className="num">Boost RMSE</th>
                <th className="num">Ridge MAE</th>
                <th className="num">Boost MAE</th>
                <th className="num">Ridge PHM</th>
                <th className="num">Boost PHM</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((row) => (
                <tr key={row.fleet} className={row.fleet === fleet ? "selected" : undefined}>
                  <td>{row.fleet}</td>
                  <td className="num">{num(row.ridge.rmse, 2)}</td>
                  <td className="num">{num(row.hgb.rmse, 2)}</td>
                  <td className="num">{num(row.ridge.mae, 2)}</td>
                  <td className="num">{num(row.hgb.mae, 2)}</td>
                  <td className="num">{num(row.ridge.phm, 1)}</td>
                  <td className="num">{num(row.hgb.phm, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
      <section className="split even">
        <article className="card">
          <header className="card-head">
            <p className="label-caps">RMSE</p>
            <span className="stamp">cyan ridge · violet boost</span>
          </header>
          <MetricBars rows={bars} metric="Boost" />
        </article>
        <article className="card">
          <header className="card-head">
            <p className="label-caps">PHM score</p>
            <span className="stamp">lower is better</span>
          </header>
          <MetricBars rows={phm} metric="Boost" />
        </article>
      </section>
      <article className="card">
        <header className="card-head">
          <p className="label-caps">{fleet} error by engine</p>
          <span className="stamp">positive is late</span>
        </header>
        <ErrorBars rows={predictions.hgb} />
      </article>
    </>
  );
}
