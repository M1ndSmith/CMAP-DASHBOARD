"""Unsupervised health index from a single principal component of the sensors."""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.decomposition import PCA

from ml.data import RANDOM_STATE
from ml.regime import CycleScaler


def fit_health(
    train: pd.DataFrame, kept_sensors: list[str], n_regimes: int
) -> dict:
    ops = train[["op1", "op2", "op3"]].to_numpy(dtype=float)
    sensors = train[kept_sensors].to_numpy(dtype=float)
    scaler = CycleScaler(n_regimes).fit(ops, sensors)
    scaled, _labels = scaler.transform(ops, sensors)
    pca = PCA(n_components=1, random_state=RANDOM_STATE)
    component = pca.fit_transform(scaled)[:, 0]
    rul = train["rul"].to_numpy(dtype=float)
    if np.corrcoef(component, rul)[0, 1] < 0:
        pca.components_ *= -1
        component = -component
    early = component[train["rul_capped"].to_numpy() >= 125]
    last = train.sort_values("cycle").groupby("unit", sort=True).tail(1)
    last_scaled, _ = scaler.transform(
        last[["op1", "op2", "op3"]].to_numpy(dtype=float),
        last[kept_sensors].to_numpy(dtype=float),
    )
    failure = pca.transform(last_scaled)[:, 0]
    healthy_anchor = float(np.median(early))
    failure_anchor = float(np.median(failure))
    span = healthy_anchor - failure_anchor
    if abs(span) < 1e-8:
        span = 1.0
    return {
        "scaler": scaler,
        "pca": pca,
        "healthy_anchor": healthy_anchor,
        "failure_anchor": failure_anchor,
        "span": span,
    }


def health_series(frame: pd.DataFrame, kept_sensors: list[str], model: dict) -> pd.DataFrame:
    ops = frame[["op1", "op2", "op3"]].to_numpy(dtype=float)
    sensors = frame[kept_sensors].to_numpy(dtype=float)
    scaled, labels = model["scaler"].transform(ops, sensors)
    component = model["pca"].transform(scaled)[:, 0]
    health = (component - model["failure_anchor"]) / model["span"]
    return pd.DataFrame(
        {
            "split": frame["split"].to_numpy(),
            "unit": frame["unit"].to_numpy(dtype=int),
            "cycle": frame["cycle"].to_numpy(dtype=int),
            "health": health,
            "regime": labels.astype(int),
        }
    )
