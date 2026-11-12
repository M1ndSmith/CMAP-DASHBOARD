"""Test-set scores. Late remaining-life calls are penalized more than early ones."""

from __future__ import annotations

import numpy as np


def rmse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.sqrt(np.mean((y_true - y_pred) ** 2)))


def mae(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.mean(np.abs(y_true - y_pred)))


def phm_score(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """PHM'08 asymmetric score. d = predicted - true. Positive d is a late call."""
    gap = np.asarray(y_pred, dtype=float) - np.asarray(y_true, dtype=float)
    penalties = np.where(gap < 0, np.exp(-gap / 13.0) - 1.0, np.exp(gap / 10.0) - 1.0)
    return float(penalties.sum())


def score_row(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    return {
        "rmse": rmse(y_true, y_pred),
        "mae": mae(y_true, y_pred),
        "phm": phm_score(y_true, y_pred),
    }
