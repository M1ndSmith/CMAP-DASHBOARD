import { TrialBars } from "@/components/Charts";
import { PageHeader } from "@/components/Header";
import { api } from "@/lib/api";
import { fleetOf, num, paramText } from "@/lib/format";
import type { Trial, Trials } from "@/lib/types";

function Fields({ params }: { params: Record<string, number | null> }) {
  return (
    <div className="fields">
      {Object.entries(params).map(([key, value]) => (
        <label className="field" key={key}>
          <span>{key}</span>
          <input readOnly value={paramText(value)} />
        </label>
      ))}
    </div>
  );
}

function TrialTable({ trials }: { trials: Trial[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Trial</th>
            <th>Parameters</th>
            <th className="num">CV RMSE</th>
            <th>Folds</th>
          </tr>
        </thead>
        <tbody>
          {trials.map((trial, index) => (
            <tr key={index} className={trial.selected ? "selected" : undefined}>
              <td>{trial.selected ? "Chosen" : index + 1}</td>
              <td>
                {Object.entries(trial.params)
                  .map(([key, value]) => `${key}=${paramText(value)}`)
                  .join("  ")}
              </td>
              <td className="num">{num(trial.mean_cv_rmse, 3)}</td>
              <td>{trial.fold_rmses.map((value) => num(value, 2)).join(" · ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function TuningPage({
  searchParams,
}: {
  searchParams: Promise<{ fleet?: string }>;
}) {
  const fleet = fleetOf((await searchParams).fleet);
  const trials = await api<Trials>(`/fleets/${fleet}/trials`);

  return (
    <>
      <PageHeader
        kicker="Tuning"
        title="Chosen on training engines only"
        detail={`${fleet} · 3 folds by engine · test set not used`}
      />
      <article className="card">
        <header className="card-head">
          <p className="label-caps">Boosting</p>
          <span className="stamp">CV RMSE {num(trials.hgb.best_cv_rmse, 3)}</span>
        </header>
        <Fields params={trials.hgb.best_params} />
        <TrialBars trials={trials.hgb.trials} />
        <TrialTable trials={trials.hgb.trials} />
      </article>
      <article className="card">
        <header className="card-head">
          <p className="label-caps">Ridge</p>
          <span className="stamp">CV RMSE {num(trials.ridge.best_cv_rmse, 3)}</span>
        </header>
        <Fields params={trials.ridge.best_params} />
        <TrialTable trials={trials.ridge.trials} />
      </article>
    </>
  );
}
