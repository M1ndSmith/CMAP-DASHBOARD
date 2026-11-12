"""Window statistics computed only from an engine's own past cycles."""

from __future__ import annotations

import numpy as np
import pandas as pd

from ml.data import WINDOW


def rolling_sensor_stats(sensors: np.ndarray, window: int) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Last value, mean, population std, and slope for every full window."""
    count, width = sensors.shape
    sum_w = np.empty((count - window + 1, width), dtype=float)
    sumsq = np.empty_like(sum_w)
    c1 = np.cumsum(sensors, axis=0)
    c2 = np.cumsum(sensors * sensors, axis=0)
    sum_w[0] = c1[window - 1]
    sumsq[0] = c2[window - 1]
    if count > window:
        sum_w[1:] = c1[window:] - c1[:-window]
        sumsq[1:] = c2[window:] - c2[:-window]
    mean = sum_w / window
    var = np.maximum(sumsq / window - mean * mean, 0.0)
    std = np.sqrt(var)
    axis = np.arange(window, dtype=float)
    centered = axis - axis.mean()
    varx = float(np.dot(centered, centered))
    kernel = centered[::-1]
    slope = np.column_stack(
        [np.convolve(sensors[:, col], kernel, mode="valid") / varx for col in range(width)]
    )
    last = sensors[window - 1 :]
    return last, mean, std, slope


def single_window_stats(sensors: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """One feature row from a series shorter than the training window."""
    count = sensors.shape[0]
    axis = np.arange(count, dtype=float)
    centered = axis - axis.mean()
    varx = float(np.dot(centered, centered))
    slope = (sensors * centered[:, None]).sum(axis=0) / varx
    return sensors[-1], sensors.mean(axis=0), sensors.std(axis=0), slope


def feature_names(op_cols: list[str], sensor_cols: list[str]) -> list[str]:
    names = list(op_cols)
    for sensor in sensor_cols:
        names.extend([f"{sensor}_last", f"{sensor}_mean", f"{sensor}_std", f"{sensor}_slope"])
    return names


def _stack_stats(
    last: np.ndarray, mean: np.ndarray, std: np.ndarray, slope: np.ndarray
) -> np.ndarray:
    width = last.shape[-1]
    if last.ndim == 1:
        stats = np.empty(width * 4, dtype=float)
        stats[0::4] = last
        stats[1::4] = mean
        stats[2::4] = std
        stats[3::4] = slope
        return stats
    stats = np.empty((last.shape[0], width * 4), dtype=float)
    stats[:, 0::4] = last
    stats[:, 1::4] = mean
    stats[:, 2::4] = std
    stats[:, 3::4] = slope
    return stats


def build_windows(
    frame: pd.DataFrame,
    op_cols: list[str],
    sensor_cols: list[str],
    *,
    allow_short: bool,
    window: int = WINDOW,
) -> pd.DataFrame:
    """One row per cycle that has `window` cycles of history.

    Test engines shorter than `window` contribute their final cycle only,
    using every cycle they do have. Training engines are all longer than
    the window, so `allow_short` stays off for them.
    """
    pieces: list[pd.DataFrame] = []
    names = feature_names(op_cols, sensor_cols)
    has_rul = "rul_capped" in frame.columns
    for unit, group in frame.groupby("unit", sort=True):
        group = group.sort_values("cycle")
        sensors = group[sensor_cols].to_numpy(dtype=float)
        ops = group[op_cols].to_numpy(dtype=float)
        cycles = group["cycle"].to_numpy()
        count = len(group)
        if count >= window:
            last, mean, std, slope = rolling_sensor_stats(sensors, window)
            block = np.hstack([ops[window - 1 :], _stack_stats(last, mean, std, slope)])
            cycle_out = cycles[window - 1 :]
            if has_rul:
                rul = group["rul_capped"].to_numpy(dtype=float)[window - 1 :]
        elif allow_short and count >= 2:
            last, mean, std, slope = single_window_stats(sensors)
            block = np.hstack([ops[-1], _stack_stats(last, mean, std, slope)])[None, :]
            cycle_out = cycles[-1:]
            rul = group["rul_capped"].to_numpy(dtype=float)[-1:] if has_rul else None
        else:
            continue
        out = pd.DataFrame(block, columns=names)
        out.insert(0, "cycle", cycle_out)
        out.insert(0, "unit", int(unit))
        if has_rul:
            out["rul_capped"] = rul
        pieces.append(out)
    if not pieces:
        return pd.DataFrame(columns=["unit", "cycle", *names])
    return pd.concat(pieces, ignore_index=True)
