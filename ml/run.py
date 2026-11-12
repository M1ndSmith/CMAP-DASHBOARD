"""Write one fleet's cleaning, EDA, health, tuning, and test-score artifacts."""

from __future__ import annotations

import json

import joblib
import numpy as np
import pandas as pd

from ml.data import FLEET_META, RUL_CAP, WINDOW, fleet_dir
from ml.eda import build_eda
from ml.health import fit_health, health_series
from ml.metrics import score_row
from ml.prepare import assemble, matrix_from
from ml.train import fit_models, tune_hgb, tune_ridge


def _dump(path, payload) -> None:
    path.write_text(json.dumps(payload, indent=2))


def _engine_table(cycles: pd.DataFrame, split: str, rul: pd.Series | None) -> list[dict]:
    rows = []
    for unit, group in cycles.groupby("unit", sort=True):
        record = {
            "unit": int(unit),
            "split": split,
            "cycles": int(group["cycle"].max()),
            "true_rul": None if rul is None else float(rul.loc[int(unit)]),
        }
        rows.append(record)
    return rows


def _cycle_frame(frame: pd.DataFrame, kept_sensors: list[str], labels: np.ndarray) -> pd.DataFrame:
    out = frame[["split", "unit", "cycle", "op1", "op2", "op3", *kept_sensors]].copy()
    out["regime"] = labels.astype(int)
    return out


def process_fleet(fleet: str) -> None:
    print(f"\n=== {fleet} ===", flush=True)
    meta = FLEET_META[fleet]
    prepared = assemble(fleet)
    names = prepared["feature_names"]
    n_ops = len(prepared["kept_ops"])
    n_regimes = prepared["n_regimes"]
    train_x, groups, _cycles, target = matrix_from(prepared["train_windows"], names)
    print(
        f"windows={len(train_x)} features={train_x.shape[1]} dropped={prepared['dropped']}",
        flush=True,
    )

    ridge_study = tune_ridge(train_x, target, groups, n_ops, n_regimes)
    hgb_study = tune_hgb(train_x, target, groups, n_ops, n_regimes)
    models = fit_models(
        train_x,
        target,
        n_ops,
        n_regimes,
        ridge_study["best_params"]["alpha"],
        hgb_study["best_params"],
    )

    test_last = prepared["test_last"].sort_values("unit")
    test_x, test_units, _test_cycles, _ = matrix_from(test_last, names)
    scaled_test = models["scaler"].transform(test_x)
    true = prepared["rul"].loc[test_units].to_numpy(dtype=float)
    ridge_pred = models["ridge"].predict(scaled_test)
    hgb_pred = models["hgb"].predict(scaled_test)
    q10 = models["q10"].predict(scaled_test)
    q90 = models["q90"].predict(scaled_test)

    def pack(pred, low=None, high=None):
        rows = []
        for index, unit in enumerate(test_units):
            gap = float(pred[index] - true[index])
            if gap > 0:
                call = "late"
            elif gap < 0:
                call = "early"
            else:
                call = "on time"
            row = {
                "unit": int(unit),
                "true_rul": float(true[index]),
                "pred": float(pred[index]),
                "error": gap,
                "call": call,
            }
            if low is not None:
                row["lo"] = float(min(low[index], high[index]))
                row["hi"] = float(max(low[index], high[index]))
            rows.append(row)
        return rows

    predictions = {"hgb": pack(hgb_pred, q10, q90), "ridge": pack(ridge_pred)}
    metrics = {
        "fleet": fleet,
        "n_test": int(len(true)),
        "ridge": {**score_row(true, ridge_pred), "params": ridge_study["best_params"], "cv_rmse": ridge_study["best_cv_rmse"]},
        "hgb": {**score_row(true, hgb_pred), "params": hgb_study["best_params"], "cv_rmse": hgb_study["best_cv_rmse"]},
    }

    health_model = fit_health(prepared["train_cycles"], prepared["kept_sensors"], n_regimes)
    train_health = health_series(prepared["train_cycles"], prepared["kept_sensors"], health_model)
    test_health = health_series(prepared["test_cycles"], prepared["kept_sensors"], health_model)
    health = pd.concat([train_health, test_health], ignore_index=True)

    train_labels = health_model["scaler"].predict(
        prepared["train_cycles"][["op1", "op2", "op3"]].to_numpy(dtype=float)
    )
    test_labels = health_model["scaler"].predict(
        prepared["test_cycles"][["op1", "op2", "op3"]].to_numpy(dtype=float)
    )
    cycles = pd.concat(
        [
            _cycle_frame(prepared["train_cycles"], prepared["kept_sensors"], train_labels),
            _cycle_frame(prepared["test_cycles"], prepared["kept_sensors"], test_labels),
        ],
        ignore_index=True,
    )
    eda = build_eda(
        prepared["train_cycles"],
        prepared["test_cycles"],
        prepared["kept_sensors"],
        prepared["variances"],
        prepared["dropped"],
        n_regimes,
        health_model["scaler"],
    )
    cleaning = {
        "fleet": fleet,
        "dropped": prepared["dropped"],
        "kept_ops": prepared["kept_ops"],
        "kept_sensors": prepared["kept_sensors"],
        "variances": prepared["variances"],
        "n_regimes": n_regimes,
        "window": WINDOW,
        "rul_cap": RUL_CAP,
        "short_test_units": prepared["short_test_units"],
        "train_windows": int(len(prepared["train_windows"])),
        "test_engines_scored": int(len(test_last)),
    }
    fleet_payload = {
        "id": fleet,
        "conditions": meta["conditions"],
        "fault_modes": meta["fault_modes"],
        "n_regimes": n_regimes,
        "train_engines": int(prepared["train_cycles"]["unit"].nunique()),
        "test_engines": int(prepared["test_cycles"]["unit"].nunique()),
        "engines": _engine_table(prepared["train_cycles"], "train", None)
        + _engine_table(prepared["test_cycles"], "test", prepared["rul"]),
    }

    out = fleet_dir(fleet)
    _dump(out / "cleaning.json", cleaning)
    _dump(out / "eda.json", eda)
    _dump(out / "fleet.json", fleet_payload)
    _dump(out / "predictions.json", predictions)
    _dump(out / "metrics.json", metrics)
    _dump(out / "trials.json", {"ridge": ridge_study, "hgb": hgb_study})
    cycles.to_parquet(out / "engines.parquet", index=False)
    health.to_parquet(out / "health.parquet", index=False)
    joblib.dump(
        {"models": models, "feature_names": names, "kept_sensors": prepared["kept_sensors"]},
        out / "model.joblib",
    )
    print(
        f"{fleet} test rmse ridge={metrics['ridge']['rmse']:.2f} hgb={metrics['hgb']['rmse']:.2f} "
        f"phm={metrics['hgb']['phm']:.1f}",
        flush=True,
    )


def main() -> None:
    for fleet in FLEET_META:
        process_fleet(fleet)


if __name__ == "__main__":
    main()
