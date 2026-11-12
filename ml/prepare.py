"""Column drops, labels, and the matrices the models actually see."""

from __future__ import annotations

import numpy as np
import pandas as pd

from ml.data import OP_COLS, SENSOR_COLS, FLEET_META, attach_train_rul, load_cycles, load_rul
from ml.regime import sensors_flat_in_every_regime
from ml.windows import build_windows, feature_names


def column_variance(frame: pd.DataFrame) -> dict[str, float]:
    variances = {}
    for column in [*OP_COLS, *SENSOR_COLS]:
        variances[column] = float(frame[column].std(ddof=0))
    return variances


def select_columns(fleet: str, train: pd.DataFrame) -> tuple[list[str], list[str], list[str]]:
    meta = FLEET_META[fleet]
    if meta["fixed_drop"] is not None:
        dropped = list(meta["fixed_drop"])
    else:
        dropped = sensors_flat_in_every_regime(
            train[OP_COLS].to_numpy(dtype=float),
            train[SENSOR_COLS].to_numpy(dtype=float),
            SENSOR_COLS,
            meta["n_regimes"],
        )
    kept_ops = [column for column in OP_COLS if column not in dropped]
    kept_sensors = [column for column in SENSOR_COLS if column not in dropped]
    return dropped, kept_ops, kept_sensors


def assemble(fleet: str) -> dict:
    train = attach_train_rul(load_cycles(fleet, "train"))
    test = load_cycles(fleet, "test")
    rul = load_rul(fleet)
    dropped, kept_ops, kept_sensors = select_columns(fleet, train)
    train_windows = build_windows(train, kept_ops, kept_sensors, allow_short=False)
    test_windows = build_windows(test, kept_ops, kept_sensors, allow_short=True)
    names = feature_names(kept_ops, kept_sensors)
    last_test = test_windows.sort_values(["unit", "cycle"]).groupby("unit", sort=True).tail(1)
    short_units = sorted(int(unit) for unit, count in test.groupby("unit").size().items() if count < 30)
    return {
        "train_cycles": train,
        "test_cycles": test,
        "rul": rul,
        "dropped": dropped,
        "kept_ops": kept_ops,
        "kept_sensors": kept_sensors,
        "feature_names": names,
        "train_windows": train_windows,
        "test_last": last_test,
        "short_test_units": short_units,
        "variances": column_variance(train),
        "n_regimes": FLEET_META[fleet]["n_regimes"],
    }


def matrix_from(frame: pd.DataFrame, names: list[str]) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    features = frame[names].to_numpy(dtype=float)
    groups = frame["unit"].to_numpy()
    cycles = frame["cycle"].to_numpy()
    target = frame["rul_capped"].to_numpy(dtype=float) if "rul_capped" in frame.columns else np.array([])
    return features, groups, cycles, target
