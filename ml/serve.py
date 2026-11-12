"""Read-only API over the artifacts written by `python -m ml.run`."""

from __future__ import annotations

import json
from functools import lru_cache

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from ml.data import ARTIFACT_DIR, FLEET_META

app = FastAPI(title="NexusML CMAPSS")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:3000", "http://localhost:3000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


def _fleet_or_404(fleet: str) -> None:
    if fleet not in FLEET_META:
        raise HTTPException(status_code=404, detail=f"Unknown fleet {fleet}")
    path = ARTIFACT_DIR / fleet
    if not (path / "fleet.json").exists():
        raise HTTPException(status_code=404, detail=f"No artifacts for {fleet}. Run python -m ml.run")


def _read_json(fleet: str, name: str) -> dict:
    _fleet_or_404(fleet)
    return json.loads((ARTIFACT_DIR / fleet / name).read_text())


@lru_cache(maxsize=8)
def _cycles(fleet: str) -> pd.DataFrame:
    _fleet_or_404(fleet)
    return pd.read_parquet(ARTIFACT_DIR / fleet / "engines.parquet")


@lru_cache(maxsize=8)
def _health(fleet: str) -> pd.DataFrame:
    _fleet_or_404(fleet)
    return pd.read_parquet(ARTIFACT_DIR / fleet / "health.parquet")


@app.get("/fleets")
def fleets() -> dict:
    rows = []
    for fleet in FLEET_META:
        path = ARTIFACT_DIR / fleet / "fleet.json"
        if not path.exists():
            continue
        payload = json.loads(path.read_text())
        rows.append({key: payload[key] for key in ("id", "conditions", "fault_modes", "n_regimes", "train_engines", "test_engines")})
    return {"fleets": rows}


@app.get("/fleets/{fleet}/cleaning")
def cleaning(fleet: str) -> dict:
    return _read_json(fleet, "cleaning.json")


@app.get("/fleets/{fleet}/eda")
def eda(fleet: str) -> dict:
    return _read_json(fleet, "eda.json")


@app.get("/fleets/{fleet}/engines")
def engines(fleet: str) -> dict:
    payload = _read_json(fleet, "fleet.json")
    return payload


@app.get("/fleets/{fleet}/engines/{unit}")
def engine(fleet: str, unit: int, split: str = "train") -> dict:
    if split not in {"train", "test"}:
        raise HTTPException(status_code=400, detail="split must be train or test")
    frame = _cycles(fleet)
    subset = frame[(frame["split"] == split) & (frame["unit"] == unit)].sort_values("cycle")
    if subset.empty:
        raise HTTPException(status_code=404, detail=f"{fleet} {split} unit {unit} not found")
    sensor_cols = [column for column in subset.columns if column.startswith("s") and column[1:].isdigit()]
    return {
        "fleet": fleet,
        "split": split,
        "unit": unit,
        "cycle": subset["cycle"].astype(int).tolist(),
        "regime": subset["regime"].astype(int).tolist(),
        "ops": {column: subset[column].astype(float).tolist() for column in ("op1", "op2", "op3")},
        "sensors": {column: subset[column].astype(float).tolist() for column in sensor_cols},
    }


@app.get("/fleets/{fleet}/health/{unit}")
def health(fleet: str, unit: int, split: str = "train") -> dict:
    if split not in {"train", "test"}:
        raise HTTPException(status_code=400, detail="split must be train or test")
    frame = _health(fleet)
    subset = frame[(frame["split"] == split) & (frame["unit"] == unit)].sort_values("cycle")
    if subset.empty:
        raise HTTPException(status_code=404, detail=f"{fleet} {split} unit {unit} not found")
    return {
        "fleet": fleet,
        "split": split,
        "unit": unit,
        "cycle": subset["cycle"].astype(int).tolist(),
        "health": subset["health"].astype(float).tolist(),
        "regime": subset["regime"].astype(int).tolist(),
    }


@app.get("/fleets/{fleet}/predictions")
def predictions(fleet: str) -> dict:
    return _read_json(fleet, "predictions.json")


@app.get("/fleets/{fleet}/predictions/{unit}")
def prediction(fleet: str, unit: int) -> dict:
    payload = _read_json(fleet, "predictions.json")
    hgb = next((row for row in payload["hgb"] if row["unit"] == unit), None)
    ridge = next((row for row in payload["ridge"] if row["unit"] == unit), None)
    if hgb is None:
        raise HTTPException(status_code=404, detail=f"No prediction for {fleet} unit {unit}")
    return {"fleet": fleet, "hgb": hgb, "ridge": ridge}


@app.get("/fleets/{fleet}/metrics")
def metrics(fleet: str) -> dict:
    return _read_json(fleet, "metrics.json")


@app.get("/fleets/{fleet}/trials")
def trials(fleet: str) -> dict:
    return _read_json(fleet, "trials.json")


def main() -> None:
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)


if __name__ == "__main__":
    main()
