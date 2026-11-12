"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { EngineRow } from "@/lib/types";

export function SplitUnitSelect({ engines }: { engines: EngineRow[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const split = params.get("split") === "test" ? "test" : "train";
  const choices = engines.filter((engine) => engine.split === split);
  const requested = Number(params.get("unit") ?? choices[0]?.unit ?? 1);
  const unit = choices.some((engine) => engine.unit === requested) ? requested : choices[0]?.unit;

  function push(nextSplit: string, nextUnit: number) {
    const next = new URLSearchParams(params.toString());
    next.set("split", nextSplit);
    next.set("unit", String(nextUnit));
    if (!next.get("fleet")) next.set("fleet", "FD001");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="controls">
      <label className="field">
        <span>Split</span>
        <select
          value={split}
          onChange={(event) => {
            const nextSplit = event.target.value;
            const first = engines.find((engine) => engine.split === nextSplit);
            push(nextSplit, first?.unit ?? 1);
          }}
        >
          <option value="train">Train</option>
          <option value="test">Test</option>
        </select>
      </label>
      <label className="field">
        <span>Engine</span>
        <select value={unit ?? 1} onChange={(event) => push(split, Number(event.target.value))}>
          {choices.map((engine) => (
            <option key={engine.unit} value={engine.unit}>
              Unit {engine.unit}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function UnitSelect({ units }: { units: number[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requested = Number(params.get("unit") ?? units[0] ?? 1);
  const unit = units.includes(requested) ? requested : units[0];

  return (
    <label className="field">
      <span>Test engine</span>
      <select
        value={unit ?? 1}
        onChange={(event) => {
          const next = new URLSearchParams(params.toString());
          next.set("unit", event.target.value);
          if (!next.get("fleet")) next.set("fleet", "FD001");
          router.push(`${pathname}?${next.toString()}`);
        }}
      >
        {units.map((id) => (
          <option key={id} value={id}>
            Unit {id}
          </option>
        ))}
      </select>
    </label>
  );
}
