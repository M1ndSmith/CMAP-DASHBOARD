"""Fit flight-regime clusters and per-regime scales on training rows only."""

from __future__ import annotations

import numpy as np
from sklearn.cluster import KMeans

from ml.data import RANDOM_STATE


class RegimeStandardizer:
    """Scale operating settings globally and sensor-window features inside each regime.

    Regime labels come from the latest operating settings on each window.
    A single-regime fleet skips clustering and uses one scale.
    """

    def __init__(self, n_ops: int, n_regimes: int) -> None:
        self.n_ops = n_ops
        self.n_regimes = n_regimes
        self.kmeans: KMeans | None = None
        self.sensor_mean: dict[int, np.ndarray] = {}
        self.sensor_std: dict[int, np.ndarray] = {}
        self.op_mean: np.ndarray | None = None
        self.op_std: np.ndarray | None = None
        self.global_mean: np.ndarray | None = None
        self.global_std: np.ndarray | None = None

    def fit(self, features: np.ndarray) -> "RegimeStandardizer":
        ops = features[:, : self.n_ops]
        sensors = features[:, self.n_ops :]
        self.op_mean = ops.mean(axis=0)
        self.op_std = _safe_std(ops.std(axis=0))
        self.global_mean = sensors.mean(axis=0)
        self.global_std = _safe_std(sensors.std(axis=0))
        labels = self._fit_labels(ops)
        self.sensor_mean = {}
        self.sensor_std = {}
        for regime in range(self.n_regimes):
            mask = labels == regime
            if int(mask.sum()) < 2:
                self.sensor_mean[regime] = self.global_mean
                self.sensor_std[regime] = self.global_std
                continue
            block = sensors[mask]
            self.sensor_mean[regime] = block.mean(axis=0)
            self.sensor_std[regime] = _safe_std(block.std(axis=0))
        return self

    def transform(self, features: np.ndarray) -> np.ndarray:
        if self.op_mean is None or self.global_mean is None:
            raise RuntimeError("RegimeStandardizer is not fit")
        ops = features[:, : self.n_ops]
        sensors = features[:, self.n_ops :]
        labels = self._predict_labels(ops)
        scaled = np.empty_like(sensors)
        for regime in range(self.n_regimes):
            mask = labels == regime
            if not np.any(mask):
                continue
            mean = self.sensor_mean.get(regime, self.global_mean)
            std = self.sensor_std.get(regime, self.global_std)
            scaled[mask] = (sensors[mask] - mean) / std
        ops_scaled = (ops - self.op_mean) / self.op_std
        return np.hstack([ops_scaled, scaled])

    def predict_regime(self, features: np.ndarray) -> np.ndarray:
        return self._predict_labels(features[:, : self.n_ops])

    def _fit_labels(self, ops: np.ndarray) -> np.ndarray:
        if self.n_regimes == 1:
            self.kmeans = None
            return np.zeros(len(ops), dtype=int)
        self.kmeans = KMeans(n_clusters=self.n_regimes, n_init=10, random_state=RANDOM_STATE)
        return self.kmeans.fit_predict(ops)

    def _predict_labels(self, ops: np.ndarray) -> np.ndarray:
        if self.n_regimes == 1 or self.kmeans is None:
            return np.zeros(len(ops), dtype=int)
        return self.kmeans.predict(ops)


class CycleScaler:
    """Per-regime scale for raw cycle sensor readings, used by health and EDA."""

    def __init__(self, n_regimes: int) -> None:
        self.n_regimes = n_regimes
        self.kmeans: KMeans | None = None
        self.mean: dict[int, np.ndarray] = {}
        self.std: dict[int, np.ndarray] = {}
        self.global_mean: np.ndarray | None = None
        self.global_std: np.ndarray | None = None
        self.centers: list[list[float]] = []
        self.sizes: list[int] = []

    def fit(self, ops: np.ndarray, sensors: np.ndarray) -> "CycleScaler":
        self.global_mean = sensors.mean(axis=0)
        self.global_std = _safe_std(sensors.std(axis=0))
        if self.n_regimes == 1:
            labels = np.zeros(len(ops), dtype=int)
            self.kmeans = None
            self.centers = [ops.mean(axis=0).tolist()]
        else:
            self.kmeans = KMeans(n_clusters=self.n_regimes, n_init=10, random_state=RANDOM_STATE)
            labels = self.kmeans.fit_predict(ops)
            self.centers = self.kmeans.cluster_centers_.tolist()
        self.sizes = [int((labels == regime).sum()) for regime in range(self.n_regimes)]
        for regime in range(self.n_regimes):
            mask = labels == regime
            if int(mask.sum()) < 2:
                self.mean[regime] = self.global_mean
                self.std[regime] = self.global_std
                continue
            block = sensors[mask]
            self.mean[regime] = block.mean(axis=0)
            self.std[regime] = _safe_std(block.std(axis=0))
        return self

    def transform(self, ops: np.ndarray, sensors: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        labels = self.predict(ops)
        scaled = np.empty_like(sensors)
        for regime in range(self.n_regimes):
            mask = labels == regime
            if not np.any(mask):
                continue
            scaled[mask] = (sensors[mask] - self.mean[regime]) / self.std[regime]
        return scaled, labels

    def predict(self, ops: np.ndarray) -> np.ndarray:
        if self.n_regimes == 1 or self.kmeans is None:
            return np.zeros(len(ops), dtype=int)
        return self.kmeans.predict(ops)


def _safe_std(std: np.ndarray) -> np.ndarray:
    out = std.astype(float).copy()
    out[out < 1e-8] = 1.0
    return out


def sensors_flat_in_every_regime(
    ops: np.ndarray, sensors: np.ndarray, sensor_names: list[str], n_regimes: int, threshold: float = 1e-3
) -> list[str]:
    """Drop a sensor only when it does not move inside any flight regime."""
    labels = KMeans(n_clusters=n_regimes, n_init=10, random_state=RANDOM_STATE).fit_predict(ops)
    dropped: list[str] = []
    for index, name in enumerate(sensor_names):
        spreads = []
        for regime in range(n_regimes):
            values = sensors[labels == regime, index]
            if len(values) == 0:
                continue
            spreads.append(float(values.std()))
        if spreads and max(spreads) < threshold:
            dropped.append(name)
    return dropped
