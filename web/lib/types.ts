export type EngineRow = {
  unit: number;
  split: "train" | "test";
  cycles: number;
  true_rul: number | null;
};

export type FleetPayload = {
  id: string;
  conditions: string;
  fault_modes: string[];
  n_regimes: number;
  train_engines: number;
  test_engines: number;
  engines: EngineRow[];
};

export type Cleaning = {
  fleet: string;
  dropped: string[];
  kept_ops: string[];
  kept_sensors: string[];
  n_regimes: number;
  window: number;
  rul_cap: number;
  short_test_units: number[];
  train_windows: number;
  test_engines_scored: number;
};

export type Bin = { lo: number; hi: number; count: number };

export type Eda = {
  variances: { column: string; std: number; dropped: boolean }[];
  cycle_length: {
    train: { min: number; max: number; mean: number; bins: Bin[] };
    test: { min: number; max: number; mean: number; bins: Bin[] };
  };
  regimes: { id: number; size: number; center: number[] }[];
  correlation: { sensors: string[]; matrix: number[][] };
  histograms: Record<string, Bin[]>;
  scatter: { op1: number; op2: number; op3: number; regime: number }[];
};

export type EngineSeries = {
  fleet: string;
  split: string;
  unit: number;
  cycle: number[];
  regime: number[];
  ops: Record<string, number[]>;
  sensors: Record<string, number[]>;
};

export type HealthSeries = {
  fleet: string;
  split: string;
  unit: number;
  cycle: number[];
  health: number[];
  regime: number[];
};

export type Prediction = {
  unit: number;
  true_rul: number;
  pred: number;
  error: number;
  call: "early" | "late" | "on time";
  lo?: number;
  hi?: number;
};

export type Predictions = { hgb: Prediction[]; ridge: Prediction[] };

export type ModelMetrics = {
  rmse: number;
  mae: number;
  phm: number;
  params: Record<string, number | null>;
  cv_rmse: number;
};

export type Metrics = {
  fleet: string;
  n_test: number;
  ridge: ModelMetrics;
  hgb: ModelMetrics;
};

export type Trial = {
  params: Record<string, number | null>;
  mean_cv_rmse: number;
  fold_rmses: number[];
  selected: boolean;
};

export type Trials = {
  ridge: { best_params: Record<string, number | null>; best_cv_rmse: number; trials: Trial[] };
  hgb: { best_params: Record<string, number | null>; best_cv_rmse: number; trials: Trial[] };
};
