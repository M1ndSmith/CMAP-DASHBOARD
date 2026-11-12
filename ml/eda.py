"""Aggregates for the Explore page. Raw cycles stay in parquet."""

from __future__ import annotations

import numpy as np
import pandas as pd

from ml.regime import CycleScaler


def _histogram(values: np.ndarray, bins: int = 20) -> list[dict]:
    if len(values) == 0:
        return []
    counts, edges = np.histogram(values, bins=bins)
    rows = []
    for index, count in enumerate(counts):
        rows.append(
            {
                "lo": float(edges[index]),
                "hi": float(edges[index + 1]),
                "count": int(count),
            }
        )
    return rows


def _length_summary(frame: pd.DataFrame) -> dict:
    lengths = frame.groupby("unit").size().to_numpy(dtype=float)
    return {
        "min": float(lengths.min()),
        "max": float(lengths.max()),
        "mean": float(lengths.mean()),
        "bins": _histogram(lengths, 20),
    }


def build_eda(
    train: pd.DataFrame,
    test: pd.DataFrame,
    kept_sensors: list[str],
    variances: dict[str, float],
    dropped: list[str],
    n_regimes: int,
    cycle_scaler: CycleScaler,
) -> dict:
    ops = train[["op1", "op2", "op3"]].to_numpy(dtype=float)
    sensors = train[kept_sensors].to_numpy(dtype=float)
    scaled, labels = cycle_scaler.transform(ops, sensors)
    correlation = np.corrcoef(scaled, rowvar=False)
    if correlation.ndim == 0:
        correlation = np.array([[1.0]])
    correlation = np.nan_to_num(correlation, nan=0.0)

    sample_count = min(2000, len(train))
    rng = np.random.default_rng(42)
    picked = rng.choice(len(train), size=sample_count, replace=False)
    scatter = [
        {
            "op1": float(ops[index, 0]),
            "op2": float(ops[index, 1]),
            "op3": float(ops[index, 2]),
            "regime": int(labels[index]),
        }
        for index in picked
    ]

    histograms = {}
    for index, name in enumerate(kept_sensors):
        histograms[name] = _histogram(sensors[:, index], 20)

    regimes = []
    for regime in range(n_regimes):
        center = cycle_scaler.centers[regime]
        regimes.append(
            {
                "id": regime,
                "size": int(cycle_scaler.sizes[regime]),
                "center": [float(value) for value in center],
            }
        )

    return {
        "variances": [
            {"column": column, "std": float(value), "dropped": column in dropped}
            for column, value in variances.items()
        ],
        "cycle_length": {"train": _length_summary(train), "test": _length_summary(test)},
        "regimes": regimes,
        "correlation": {
            "sensors": kept_sensors,
            "matrix": correlation.round(4).tolist(),
        },
        "histograms": histograms,
        "scatter": scatter,
    }
