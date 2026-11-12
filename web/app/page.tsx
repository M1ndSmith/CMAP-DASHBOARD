import Link from "next/link";
import { PageHeader } from "@/components/Header";
import { api } from "@/lib/api";
import { fleetOf, num } from "@/lib/format";
import type { Cleaning, FleetPayload } from "@/lib/types";

export default async function FleetPage({
  searchParams,
}: {
  searchParams: Promise<{ fleet?: string }>;
}) {
  const fleet = fleetOf((await searchParams).fleet);
  const [summary, cleaning] = await Promise.all([
    api<FleetPayload>(`/fleets/${fleet}/engines`),
    api<Cleaning>(`/fleets/${fleet}/cleaning`),
  ]);

  return (
    <>
      <PageHeader
        kicker="Fleet"
        title={summary.id}
        detail={`${summary.conditions} · ${summary.fault_modes.join(", ")}`}
      />
      <section className="metrics">
        <article className="card">
          <header className="card-head">
            <p className="label-caps">Train engines</p>
          </header>
          <p className="metric-xl">{summary.train_engines}</p>
        </article>
        <article className="card">
          <header className="card-head">
            <p className="label-caps">Test engines</p>
          </header>
          <p className="metric-xl">{summary.test_engines}</p>
        </article>
        <article className="card">
          <header className="card-head">
            <p className="label-caps">Flight regimes</p>
          </header>
          <p className="metric-xl">{summary.n_regimes}</p>
        </article>
        <article className="card">
          <header className="card-head">
            <p className="label-caps">Dropped columns</p>
            <span className="stamp">std ≈ 0</span>
          </header>
          <p className="metric-xl">{cleaning.dropped.length}</p>
          <p className="quiet">{cleaning.dropped.join(", ") || "None"}</p>
        </article>
      </section>
      {cleaning.short_test_units.length > 0 ? (
        <p className="note">
          {cleaning.short_test_units.length} test engines have fewer than {cleaning.window} cycles. Their
          prediction uses every cycle they recorded.
        </p>
      ) : null}
      <article className="card">
        <header className="card-head">
          <p className="label-caps">Engines</p>
          <span className="stamp">
            window {cleaning.window} · RUL cap {cleaning.rul_cap} · {num(cleaning.train_windows, 0)} train rows
          </span>
        </header>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Unit</th>
                <th>Split</th>
                <th className="num">Cycles</th>
                <th className="num">True remaining</th>
              </tr>
            </thead>
            <tbody>
              {summary.engines.map((engine) => (
                <tr key={`${engine.split}-${engine.unit}`}>
                  <td>
                    <Link href={`/engine?fleet=${fleet}&split=${engine.split}&unit=${engine.unit}`}>
                      {engine.unit}
                    </Link>
                  </td>
                  <td>{engine.split}</td>
                  <td className="num">{engine.cycles}</td>
                  <td className="num">{engine.true_rul === null ? "—" : num(engine.true_rul, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </>
  );
}
