"""Load the NASA C-MAPSS fleet files."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "CMAPSSData"
ARTIFACT_DIR = ROOT / "artifacts"

SENSOR_COLS = [f"s{i}" for i in range(1, 22)]
OP_COLS = ["op1", "op2", "op3"]
COLUMNS = ["unit", "cycle", *OP_COLS, *SENSOR_COLS]

WINDOW = 30
RUL_CAP = 125
RANDOM_STATE = 42

FLEET_META = {
    "FD001": {
        "conditions": "Sea level",
        "fault_modes": ["HPC degradation"],
        "n_regimes": 1,
        "fixed_drop": ["op3", "s1", "s5", "s6", "s10", "s16", "s18", "s19"],
    },
    "FD002": {
        "conditions": "Six flight regimes",
        "fault_modes": ["HPC degradation"],
        "n_regimes": 6,
        "fixed_drop": None,
    },
    "FD003": {
        "conditions": "Sea level",
        "fault_modes": ["HPC degradation", "Fan degradation"],
        "n_regimes": 1,
        "fixed_drop": ["op3", "s1", "s5", "s16", "s18", "s19"],
    },
    "FD004": {
        "conditions": "Six flight regimes",
        "fault_modes": ["HPC degradation", "Fan degradation"],
        "n_regimes": 6,
        "fixed_drop": None,
    },
}


def fleet_dir(fleet: str) -> Path:
    path = ARTIFACT_DIR / fleet
    path.mkdir(parents=True, exist_ok=True)
    return path


def load_cycles(fleet: str, split: str) -> pd.DataFrame:
    path = DATA_DIR / f"{split}_{fleet}.txt"
    frame = pd.read_csv(path, sep=r"\s+", header=None, names=COLUMNS)
    frame["unit"] = frame["unit"].astype(int)
    frame["cycle"] = frame["cycle"].astype(int)
    frame["split"] = split
    return frame


def load_rul(fleet: str) -> pd.Series:
    path = DATA_DIR / f"RUL_{fleet}.txt"
    values = pd.read_csv(path, sep=r"\s+", header=None, names=["rul"])
    # File order matches unit ids 1..N.
    return pd.Series(values["rul"].to_numpy(dtype=float), index=range(1, len(values) + 1), name="rul")


def attach_train_rul(frame: pd.DataFrame) -> pd.DataFrame:
    out = frame.copy()
    life = out.groupby("unit")["cycle"].transform("max")
    out["rul"] = (life - out["cycle"]).astype(float)
    out["rul_capped"] = out["rul"].clip(upper=RUL_CAP)
    return out
