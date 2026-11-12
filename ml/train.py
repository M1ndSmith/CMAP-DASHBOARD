"""GroupKFold search for Ridge and histogram gradient boosting."""

from __future__ import annotations

from itertools import product

import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.model_selection import GroupKFold

from ml.data import RANDOM_STATE
from ml.metrics import rmse
from ml.regime import RegimeStandardizer


def _ridge(alpha: float) -> Ridge:
    return Ridge(alpha=float(alpha))


def _hgb(params: dict, loss: str = "squared_error", quantile: float | None = None) -> HistGradientBoostingRegressor:
    kwargs = dict(params)
    if loss == "quantile":
        kwargs["loss"] = "quantile"
        kwargs["quantile"] = quantile
    else:
        kwargs["loss"] = "squared_error"
    return HistGradientBoostingRegressor(early_stopping=False, random_state=RANDOM_STATE, **kwargs)


def _fold_scores(
    features: np.ndarray,
    target: np.ndarray,
    groups: np.ndarray,
    n_ops: int,
    n_regimes: int,
    build_model,
) -> list[float]:
    scores = []
    splitter = GroupKFold(n_splits=3)
    for train_index, valid_index in splitter.split(features, target, groups):
        scaler = RegimeStandardizer(n_ops, n_regimes).fit(features[train_index])
        model = build_model()
        model.fit(scaler.transform(features[train_index]), target[train_index])
        pred = model.predict(scaler.transform(features[valid_index]))
        scores.append(rmse(target[valid_index], pred))
    return scores


def tune_ridge(features, target, groups, n_ops: int, n_regimes: int) -> dict:
    trials = []
    alphas = np.logspace(-3, 3, 8)
    for alpha in alphas:
        fold_rmses = _fold_scores(
            features, target, groups, n_ops, n_regimes, lambda alpha=alpha: _ridge(float(alpha))
        )
        trials.append(
            {
                "params": {"alpha": float(alpha)},
                "mean_cv_rmse": float(np.mean(fold_rmses)),
                "fold_rmses": [float(value) for value in fold_rmses],
            }
        )
        print(f"  ridge alpha={alpha:.4g} cv_rmse={trials[-1]['mean_cv_rmse']:.3f}", flush=True)
    best = min(trials, key=lambda trial: trial["mean_cv_rmse"])
    for trial in trials:
        trial["selected"] = trial is best
    return {"best_params": best["params"], "best_cv_rmse": best["mean_cv_rmse"], "trials": trials}


def tune_hgb(features, target, groups, n_ops: int, n_regimes: int) -> dict:
    grid = list(product([100, 200, 400], [3, 6, None], [0.05, 0.1, 0.2], [20, 50]))
    picks = np.random.default_rng(RANDOM_STATE).choice(len(grid), size=12, replace=False)
    trials = []
    for draw, index in enumerate(picks, start=1):
        max_iter, max_depth, learning_rate, min_samples_leaf = grid[int(index)]
        params = {
            "max_iter": int(max_iter),
            "max_depth": None if max_depth is None else int(max_depth),
            "learning_rate": float(learning_rate),
            "min_samples_leaf": int(min_samples_leaf),
        }
        fold_rmses = _fold_scores(
            features, target, groups, n_ops, n_regimes, lambda params=params: _hgb(params)
        )
        trials.append(
            {
                "params": params,
                "mean_cv_rmse": float(np.mean(fold_rmses)),
                "fold_rmses": [float(value) for value in fold_rmses],
            }
        )
        print(
            f"  hgb {draw}/12 depth={params['max_depth']} lr={params['learning_rate']} "
            f"leaf={params['min_samples_leaf']} iter={params['max_iter']} "
            f"cv_rmse={trials[-1]['mean_cv_rmse']:.3f}",
            flush=True,
        )
    best = min(trials, key=lambda trial: trial["mean_cv_rmse"])
    for trial in trials:
        trial["selected"] = trial is best
    return {"best_params": best["params"], "best_cv_rmse": best["mean_cv_rmse"], "trials": trials}


def fit_models(features, target, n_ops: int, n_regimes: int, ridge_alpha: float, hgb_params: dict) -> dict:
    scaler = RegimeStandardizer(n_ops, n_regimes).fit(features)
    scaled = scaler.transform(features)
    ridge = _ridge(ridge_alpha)
    ridge.fit(scaled, target)
    point = _hgb(hgb_params)
    point.fit(scaled, target)
    low = _hgb(hgb_params, loss="quantile", quantile=0.1)
    low.fit(scaled, target)
    high = _hgb(hgb_params, loss="quantile", quantile=0.9)
    high.fit(scaled, target)
    return {"scaler": scaler, "ridge": ridge, "hgb": point, "q10": low, "q90": high}
