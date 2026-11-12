export const FLEETS = ["FD001", "FD002", "FD003", "FD004"] as const;
export type FleetId = (typeof FLEETS)[number];

export function fleetOf(value?: string): FleetId {
  return FLEETS.includes(value as FleetId) ? (value as FleetId) : "FD001";
}

export function num(value: number, digits = 1): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function compact(value: number): string {
  const abs = Math.abs(value);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return num(value, digits);
}

export function paramText(value: number | null | undefined): string {
  if (value === null || value === undefined) return "none";
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toPrecision(4)));
}
